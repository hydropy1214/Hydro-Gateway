import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import type { Server } from "http";
import { db } from "@workspace/db";
import {
  devicesTable, activityEventsTable, systemLogsTable,
  smsMessagesTable, deviceLogsTable, campaignsTable
} from "@workspace/db";
import { eq, and, inArray, sql } from "drizzle-orm";
import { logger } from "./lib/logger.js";
import { getApiKey } from "./middleware/auth.js";

interface DeviceConnection {
  ws: WebSocket;
  deviceId: string;
  dbId: number;
  deviceName: string;
  lastHeartbeat: Date;
  replaced: boolean;
}

class HydroWss {
  private server: WebSocketServer | null = null;
  private connections = new Map<string, DeviceConnection>();
  /** Dashboard browser sockets that sent a valid SUBSCRIBE message */
  private dashboardSockets = new Set<WebSocket>();

  init(httpServer: Server) {
    this.server = new WebSocketServer({ server: httpServer, path: "/api/ws" });

    this.server.on("connection", (ws: WebSocket, req: IncomingMessage) => {
      const ip = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim()
        ?? req.socket.remoteAddress
        ?? "unknown";

      let connection: DeviceConnection | null = null;
      let subscribedAsDashboard = false;

      ws.on("message", async (raw) => {
        try {
          const msg = JSON.parse(raw.toString()) as Record<string, unknown>;

          // Dashboard SUBSCRIBE — validate API key before adding to broadcast set
          if (msg.type === "SUBSCRIBE") {
            const providedKey = msg.apiKey as string | undefined;
            if (!providedKey || providedKey !== getApiKey()) {
              ws.send(JSON.stringify({ type: "SUBSCRIBE_DENIED", reason: "Invalid API key" }));
              ws.close(1008, "Unauthorized");
              return;
            }
            if (!subscribedAsDashboard && !connection) {
              subscribedAsDashboard = true;
              this.dashboardSockets.add(ws);
            }
            ws.send(JSON.stringify({ type: "SUBSCRIBED" }));
            return;
          }

          const newConn = await this.handleMessage(ws, msg, ip, connection);
          if (newConn !== undefined) connection = newConn;
        } catch (err) {
          logger.error({ err }, "WS message handling error");
          ws.send(JSON.stringify({ type: "ERROR", message: "Internal error" }));
        }
      });

      ws.on("close", async () => {
        this.dashboardSockets.delete(ws);
        if (!connection || connection.replaced) return;
        if (this.connections.get(connection.deviceId) !== connection) return;
        this.connections.delete(connection.deviceId);
        await this.onDeviceDisconnected(connection);
      });

      ws.on("error", (err) => logger.error({ err }, "WebSocket error"));
    });

    setInterval(() => this.checkHeartbeats(), 30_000);
    logger.info("WebSocket server initialized at /api/ws");
  }

  private async handleMessage(
    ws: WebSocket,
    msg: Record<string, unknown>,
    ip: string,
    currentConn: DeviceConnection | null
  ): Promise<DeviceConnection | null | undefined> {
    const safeMsg = { ...msg };
    if (safeMsg.token) safeMsg.token = "[REDACTED]";
    await this.logWs(msg.type as string, JSON.stringify(safeMsg));

    switch (msg.type) {

      case "AUTH": {
        const token = msg.token as string;
        const [device] = await db
          .select()
          .from(devicesTable)
          .where(eq(devicesTable.authToken, token))
          .limit(1);

        if (!device) {
          ws.send(JSON.stringify({ type: "AUTH_FAILED", message: "Invalid credentials" }));
          ws.close(1008, "AUTH_FAILED");
          return null;
        }

        const existing = this.connections.get(device.deviceId);
        if (existing && existing.ws !== ws) {
          existing.replaced = true;
          existing.ws.close(1000, "replaced by new connection");
        }

        const conn: DeviceConnection = {
          ws,
          deviceId: device.deviceId,
          dbId: device.id,
          deviceName: device.name,
          lastHeartbeat: new Date(),
          replaced: false,
        };
        this.connections.set(device.deviceId, conn);

        await db.update(devicesTable).set({
          status: "online",
          ipAddress: ip,
          lastHeartbeat: new Date(),
          updatedAt: new Date(),
        }).where(eq(devicesTable.id, device.id));

        ws.send(JSON.stringify({ type: "AUTH_OK", deviceId: device.id }));
        await this.onDeviceConnected(conn);
        return conn;
      }

      case "HEARTBEAT": {
        if (!currentConn) return undefined;
        currentConn.lastHeartbeat = new Date();
        await db.update(devicesTable).set({
          lastHeartbeat: new Date(),
          battery: typeof msg.battery === "number" ? msg.battery : undefined,
          signalStrength: typeof msg.signal === "number" && msg.signal !== -1 ? msg.signal : undefined,
          updatedAt: new Date(),
        }).where(eq(devicesTable.id, currentConn.dbId));
        ws.send(JSON.stringify({ type: "HEARTBEAT_ACK" }));
        this.broadcastToDashboard({
          type: "device_telemetry",
          deviceId: currentConn.dbId,
          battery: msg.battery,
          signal: msg.signal,
        });
        return undefined;
      }

      case "SMS_RESULT": {
        if (!currentConn) return undefined;
        const smsId = msg.smsId as number;
        const status = msg.status as string;
        const error = msg.error as string | undefined;
        const success = status === "SUCCESS";

        // Update the SMS message row
        await db.update(smsMessagesTable).set({
          status: success ? "SUCCESS" : "FAILED",
          errorMessage: error ?? null,
          resultAt: new Date(),
          ...(success ? { sentAt: new Date() } : {}),
        }).where(eq(smsMessagesTable.id, smsId));

        // Increment device SMS count
        await db.update(devicesTable).set({
          smsCount: sql`${devicesTable.smsCount} + 1`,
          updatedAt: new Date(),
        }).where(eq(devicesTable.id, currentConn.dbId));

        // Update campaign counters
        const [smsRow] = await db
          .select({ campaignId: smsMessagesTable.campaignId })
          .from(smsMessagesTable)
          .where(eq(smsMessagesTable.id, smsId))
          .limit(1);

        if (smsRow?.campaignId) {
          const campaignId = smsRow.campaignId;
          if (success) {
            await db.update(campaignsTable).set({
              sentCount: sql`${campaignsTable.sentCount} + 1`,
              pendingCount: sql`GREATEST(${campaignsTable.pendingCount} - 1, 0)`,
              updatedAt: new Date(),
            }).where(eq(campaignsTable.id, campaignId));
          } else {
            await db.update(campaignsTable).set({
              failedCount: sql`${campaignsTable.failedCount} + 1`,
              pendingCount: sql`GREATEST(${campaignsTable.pendingCount} - 1, 0)`,
              updatedAt: new Date(),
            }).where(eq(campaignsTable.id, campaignId));
          }

          // Check if campaign is now fully completed
          await this.checkCampaignComplete(campaignId);
        }

        await db.insert(activityEventsTable).values({
          type: success ? "sms_sent" : "sms_failed",
          message: success
            ? `SMS delivered by ${currentConn.deviceName}`
            : `SMS failed on ${currentConn.deviceName}: ${error ?? "unknown"}`,
          deviceId: currentConn.dbId,
          deviceName: currentConn.deviceName,
          metadata: JSON.stringify({ smsId, status }),
        });

        await this.logDevice(currentConn.dbId, success ? "info" : "warn",
          `SMS #${smsId} ${success ? "delivered" : "failed"}: ${error ?? "ok"}`);

        this.broadcastToDashboard({ type: "sms_result", deviceId: currentConn.dbId, smsId, status });
        return undefined;
      }

      case "SMS_STATUS": {
        // Android acknowledges receipt of a SEND_SMS command
        if (!currentConn) return undefined;
        const smsId = msg.smsId as number;
        const status = msg.status as string; // typically "ASSIGNED"
        if (smsId && status) {
          await db.update(smsMessagesTable)
            .set({ status } as any)
            .where(eq(smsMessagesTable.id, smsId));
        }
        return undefined;
      }

      case "DEVICE_INFO": {
        if (!currentConn) return undefined;
        const updates: Record<string, unknown> = { updatedAt: new Date() };
        if (typeof msg.phoneModel === "string")     updates.phoneModel = msg.phoneModel;
        if (typeof msg.androidVersion === "string") updates.androidVersion = msg.androidVersion;
        if (typeof msg.simInfo === "string")        updates.simInfo = msg.simInfo;
        if (typeof msg.battery === "number")        updates.battery = msg.battery;
        if (typeof msg.signal === "number" && msg.signal !== -1) updates.signalStrength = msg.signal;
        if (typeof msg.phoneNumber === "string" && msg.phoneNumber) updates.phoneNumber = msg.phoneNumber;
        await db.update(devicesTable).set(updates as any).where(eq(devicesTable.id, currentConn.dbId));
        this.broadcastToDashboard({ type: "device_updated", deviceId: currentConn.dbId });
        return undefined;
      }

      default:
        logger.warn({ type: msg.type }, "Unknown WS message type");
        return undefined;
    }
  }

  private async checkCampaignComplete(campaignId: number) {
    try {
      const [campaign] = await db
        .select()
        .from(campaignsTable)
        .where(eq(campaignsTable.id, campaignId))
        .limit(1);

      if (!campaign || campaign.status !== "running") return;

      // Count remaining unfinished messages
      const [{ remaining }] = await db
        .select({ remaining: sql<number>`count(*)::int` })
        .from(smsMessagesTable)
        .where(and(
          eq(smsMessagesTable.campaignId, campaignId),
          inArray(smsMessagesTable.status, ["QUEUED", "SENT_TO_DEVICE", "SENDING", "ASSIGNED"])
        ));

      if ((remaining ?? 0) === 0) {
        await db.update(campaignsTable).set({
          status: "completed",
          completedAt: new Date(),
          pendingCount: 0,
          updatedAt: new Date(),
        }).where(eq(campaignsTable.id, campaignId));

        await db.insert(activityEventsTable).values({
          type: "campaign_completed",
          message: `Campaign "${campaign.name}" completed`,
          campaignId: campaign.id,
          campaignName: campaign.name,
        });

        this.broadcastToDashboard({ type: "campaign_completed", campaignId });
      }
    } catch (err) {
      logger.error({ err }, "checkCampaignComplete error");
    }
  }

  private async onDeviceConnected(conn: DeviceConnection) {
    await db.insert(activityEventsTable).values({
      type: "device_connected",
      message: `Device "${conn.deviceName}" connected`,
      deviceId: conn.dbId,
      deviceName: conn.deviceName,
    });
    logger.info({ deviceId: conn.deviceId }, "Device connected");
    this.broadcastToDashboard({ type: "device_connected", deviceId: conn.dbId, deviceName: conn.deviceName });
  }

  private async onDeviceDisconnected(conn: DeviceConnection) {
    await db.update(devicesTable).set({ status: "offline", updatedAt: new Date() })
      .where(eq(devicesTable.id, conn.dbId));
    await db.insert(activityEventsTable).values({
      type: "device_disconnected",
      message: `Device "${conn.deviceName}" disconnected`,
      deviceId: conn.dbId,
      deviceName: conn.deviceName,
    });
    logger.info({ deviceId: conn.deviceId }, "Device disconnected");
    this.broadcastToDashboard({ type: "device_disconnected", deviceId: conn.dbId, deviceName: conn.deviceName });
  }

  private async checkHeartbeats() {
    const now = new Date();
    for (const conn of this.connections.values()) {
      if (now.getTime() - conn.lastHeartbeat.getTime() > 90_000) {
        conn.replaced = true;
        conn.ws.terminate();
        this.connections.delete(conn.deviceId);
        await this.onDeviceDisconnected(conn);
      }
    }
  }

  sendToDevice(deviceId: string, payload: Record<string, unknown>): boolean {
    const conn = this.connections.get(deviceId);
    if (conn && conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }

  broadcast(payload: Record<string, unknown>) {
    const data = JSON.stringify(payload);
    for (const conn of this.connections.values()) {
      if (conn.ws.readyState === WebSocket.OPEN) conn.ws.send(data);
    }
  }

  private broadcastToDashboard(payload: Record<string, unknown>) {
    if (this.dashboardSockets.size === 0) return;
    const data = JSON.stringify(payload);
    for (const ws of this.dashboardSockets) {
      if (ws.readyState === WebSocket.OPEN) {
        try { ws.send(data); } catch (_) { /* non-fatal */ }
      }
    }
  }

  getConnectedCount() { return this.connections.size; }

  private async logWs(type: string, data: string) {
    try {
      await db.insert(systemLogsTable).values({
        level: "info", category: "websocket",
        message: `WS: ${type}`, data: data.substring(0, 500),
      });
    } catch (_) { /* non-fatal */ }
  }

  private async logDevice(deviceId: number, level: string, message: string) {
    try {
      await db.insert(deviceLogsTable).values({ deviceId, level, message });
    } catch (_) { /* non-fatal */ }
  }
}

export const wss = new HydroWss();
