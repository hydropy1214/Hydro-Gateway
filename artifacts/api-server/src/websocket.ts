import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import type { Server } from "http";
import { db } from "@workspace/db";
import {
  devicesTable, activityEventsTable, systemLogsTable,
  smsMessagesTable, deviceLogsTable
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./lib/logger.js";
import { getApiKey } from "./middleware/auth.js";

interface DeviceConnection {
  ws: WebSocket;
  deviceId: string;
  dbId: number;
  deviceName: string;
  lastHeartbeat: Date;
  /** Set to true when this connection is intentionally replaced by a new auth */
  replaced: boolean;
}

class HydroWss {
  private server: WebSocketServer | null = null;
  // keyed by Android hardware device ID
  private connections = new Map<string, DeviceConnection>();
  // Dashboard browser connections that explicitly sent SUBSCRIBE — receive broadcast events
  private dashboardSockets = new Set<WebSocket>();

  init(httpServer: Server) {
    this.server = new WebSocketServer({ server: httpServer, path: "/api/ws" });

    this.server.on("connection", (ws: WebSocket, req: IncomingMessage) => {
      const ip = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim()
        ?? req.socket.remoteAddress
        ?? "unknown";

      // Connection state — only set once AUTH or SUBSCRIBE succeeds
      let connection: DeviceConnection | null = null;
      let subscribedAsDashboard = false;

      ws.on("message", async (raw) => {
        try {
          const msg = JSON.parse(raw.toString()) as Record<string, unknown>;

          // Dashboard browser sends SUBSCRIBE {apiKey} to opt-in to live events.
          // Validate the API key so only authenticated dashboard sessions can receive broadcasts.
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
        // Clean up dashboard subscription
        this.dashboardSockets.delete(ws);

        if (!connection) return;
        if (connection.replaced) return;
        if (this.connections.get(connection.deviceId) !== connection) return;
        this.connections.delete(connection.deviceId);
        await this.onDeviceDisconnected(connection);
      });

      ws.on("error", (err) => {
        logger.error({ err }, "WebSocket error");
      });
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

        // Authenticate by token alone — token is a 32-byte random hex and unique per device.
        // We do NOT compare msg.deviceId against device.deviceId (the Android hardware ID)
        // because the Android app stores and sends the numeric DB id as deviceId, not the hardware ID.
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

        // If an existing connection exists for this device, mark it replaced and close it
        const existing = this.connections.get(device.deviceId);
        if (existing && existing.ws !== ws) {
          existing.replaced = true;
          existing.ws.close(1000, "replaced by new connection");
          logger.info({ deviceId: device.deviceId }, "Replaced stale connection");
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
          signalStrength: typeof msg.signal === "number" ? msg.signal : undefined,
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

        await db.update(smsMessagesTable).set({
          status: success ? "SUCCESS" : "FAILED",
          errorMessage: error ?? null,
          resultAt: new Date(),
          ...(success ? { sentAt: new Date() } : {}),
        }).where(eq(smsMessagesTable.id, smsId));

        await db.insert(activityEventsTable).values({
          type: success ? "sms_sent" : "sms_failed",
          message: success
            ? `SMS delivered by ${currentConn.deviceName}`
            : `SMS failed on ${currentConn.deviceName}: ${error ?? "unknown error"}`,
          deviceId: currentConn.dbId,
          deviceName: currentConn.deviceName,
          metadata: JSON.stringify({ smsId, status }),
        });

        await this.logDevice(currentConn.dbId, success ? "info" : "warn",
          `SMS ${smsId} ${success ? "delivered" : "failed"}: ${error ?? "ok"}`);

        this.broadcastToDashboard({ type: "sms_result", deviceId: currentConn.dbId, smsId, status });
        return undefined;
      }

      case "DEVICE_INFO": {
        if (!currentConn) return undefined;
        await db.update(devicesTable).set({
          phoneModel: typeof msg.phoneModel === "string" ? msg.phoneModel : undefined,
          androidVersion: typeof msg.androidVersion === "string" ? msg.androidVersion : undefined,
          simInfo: typeof msg.simInfo === "string" ? msg.simInfo : undefined,
          battery: typeof msg.battery === "number" ? msg.battery : undefined,
          signalStrength: typeof msg.signal === "number" ? msg.signal : undefined,
          updatedAt: new Date(),
        }).where(eq(devicesTable.id, currentConn.dbId));
        this.broadcastToDashboard({ type: "device_updated", deviceId: currentConn.dbId });
        return undefined;
      }

      default:
        logger.warn({ type: msg.type }, "Unknown WS message type");
        return undefined;
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
    this.broadcastToDashboard({
      type: "device_connected",
      deviceId: conn.dbId,
      deviceName: conn.deviceName,
    });
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
    this.broadcastToDashboard({
      type: "device_disconnected",
      deviceId: conn.dbId,
      deviceName: conn.deviceName,
    });
  }

  private async checkHeartbeats() {
    const now = new Date();
    const stale: DeviceConnection[] = [];
    for (const conn of this.connections.values()) {
      if (now.getTime() - conn.lastHeartbeat.getTime() > 90_000) {
        stale.push(conn);
      }
    }
    for (const conn of stale) {
      conn.replaced = true;
      conn.ws.terminate();
      this.connections.delete(conn.deviceId);
      await this.onDeviceDisconnected(conn);
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

  getConnectedCount(): number {
    return this.connections.size;
  }

  private async logWs(type: string, data: string) {
    try {
      await db.insert(systemLogsTable).values({
        level: "info",
        category: "websocket",
        message: `WS: ${type}`,
        data: data.substring(0, 500),
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
