import { Router } from "express";
import { db } from "@workspace/db";
import {
  devicesTable, deviceLogsTable, pairCodesTable, activityEventsTable
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import crypto from "crypto";

const router = Router();

// Generate pair code
router.get("/pair-code", async (req, res) => {
  try {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await db.insert(pairCodesTable).values({ code, expiresAt });
    res.json({ pairCode: code, expiresAt: expiresAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to generate pair code");
    res.status(500).json({ error: "Failed to generate pair code" });
  }
});

// Pair a device
router.post("/pair", async (req, res) => {
  try {
    const { pairCode, deviceId, phoneModel, androidVersion, simInfo } = req.body;

    const [code] = await db
      .select()
      .from(pairCodesTable)
      .where(eq(pairCodesTable.code, pairCode))
      .limit(1);

    if (!code || code.usedAt || new Date() > code.expiresAt) {
      res.status(400).json({ error: "Invalid or expired pair code" });
      return;
    }

    const authToken = crypto.randomBytes(32).toString("hex");
    const [existing] = await db
      .select()
      .from(devicesTable)
      .where(eq(devicesTable.deviceId, deviceId))
      .limit(1);

    let device;
    if (existing) {
      [device] = await db
        .update(devicesTable)
        .set({ status: "offline", authToken, phoneModel, androidVersion, simInfo, updatedAt: new Date() })
        .where(eq(devicesTable.id, existing.id))
        .returning();
    } else {
      [device] = await db
        .insert(devicesTable)
        .values({
          name: phoneModel ?? `Device-${deviceId.substring(0, 6)}`,
          deviceId,
          status: "offline",
          phoneModel,
          androidVersion,
          simInfo,
          authToken,
        })
        .returning();
    }

    await db.update(pairCodesTable).set({ usedAt: new Date() }).where(eq(pairCodesTable.id, code.id));

    res.json({ success: true, deviceId: device.id, token: authToken, wsUrl: "/ws" });
  } catch (err) {
    req.log.error({ err }, "Failed to pair device");
    res.status(500).json({ error: "Failed to pair device" });
  }
});

// List devices
router.get("/", async (req, res) => {
  try {
    const { status } = req.query as { status?: string };
    const devices = await db.select().from(devicesTable).orderBy(desc(devicesTable.createdAt));
    const filtered = status && status !== "all" ? devices.filter(d => d.status === status) : devices;
    res.json(filtered.map(d => ({
      ...d,
      authToken: undefined,
      lastHeartbeat: d.lastHeartbeat?.toISOString() ?? null,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt?.toISOString() ?? null,
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to list devices");
    res.status(500).json({ error: "Failed to list devices" });
  }
});

// Create device
router.post("/", async (req, res) => {
  try {
    const { name, deviceId, phoneModel, androidVersion } = req.body;
    const [device] = await db.insert(devicesTable).values({ name, deviceId, phoneModel, androidVersion }).returning();
    res.status(201).json({ ...device, authToken: undefined, createdAt: device.createdAt.toISOString(), updatedAt: null, lastHeartbeat: null });
  } catch (err) {
    req.log.error({ err }, "Failed to create device");
    res.status(500).json({ error: "Failed to create device" });
  }
});

// Get device
router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [device] = await db.select().from(devicesTable).where(eq(devicesTable.id, id)).limit(1);
    if (!device) {
      res.status(404).json({ error: "Device not found" });
      return;
    }
    res.json({ ...device, authToken: undefined, lastHeartbeat: device.lastHeartbeat?.toISOString() ?? null, createdAt: device.createdAt.toISOString(), updatedAt: device.updatedAt?.toISOString() ?? null });
  } catch (err) {
    req.log.error({ err }, "Failed to get device");
    res.status(500).json({ error: "Failed to get device" });
  }
});

// Update device
router.patch("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, status } = req.body;
    const [device] = await db.update(devicesTable).set({ name, status, updatedAt: new Date() }).where(eq(devicesTable.id, id)).returning();
    if (!device) {
      res.status(404).json({ error: "Device not found" });
      return;
    }
    res.json({ ...device, authToken: undefined, lastHeartbeat: device.lastHeartbeat?.toISOString() ?? null, createdAt: device.createdAt.toISOString(), updatedAt: device.updatedAt?.toISOString() ?? null });
  } catch (err) {
    req.log.error({ err }, "Failed to update device");
    res.status(500).json({ error: "Failed to update device" });
  }
});

// Delete device
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(devicesTable).where(eq(devicesTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete device");
    res.status(500).json({ error: "Failed to delete device" });
  }
});

// Send test SMS
router.post("/:id/test-sms", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [device] = await db.select().from(devicesTable).where(eq(devicesTable.id, id)).limit(1);
    if (!device) {
      res.status(404).json({ error: "Device not found" });
      return;
    }
    const { wss } = await import("../websocket.js");
    const dispatched = wss.sendToDevice(device.deviceId, { type: "SEND_SMS", number: req.body.phoneNumber, message: req.body.message, smsId: -1 });
    if (!dispatched) {
      res.status(503).json({ error: "Device is not currently connected via WebSocket" });
      return;
    }
    res.json({ success: true, message: "Test SMS dispatched to device" });
  } catch (err) {
    req.log.error({ err }, "Failed to send test SMS");
    res.status(500).json({ error: "Failed to send test SMS" });
  }
});

// Restart device
router.post("/:id/restart", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [device] = await db.select().from(devicesTable).where(eq(devicesTable.id, id)).limit(1);
    if (!device) {
      res.status(404).json({ error: "Device not found" });
      return;
    }
    const { wss } = await import("../websocket.js");
    const dispatched = wss.sendToDevice(device.deviceId, { type: "RESTART" });
    if (!dispatched) {
      res.status(503).json({ error: "Device is not currently connected via WebSocket" });
      return;
    }
    res.json({ success: true, message: "Restart command sent to device" });
  } catch (err) {
    req.log.error({ err }, "Failed to restart device");
    res.status(500).json({ error: "Failed to restart device" });
  }
});

// Disable device
router.post("/:id/disable", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.update(devicesTable).set({ status: "disabled", updatedAt: new Date() }).where(eq(devicesTable.id, id));
    res.json({ success: true, message: "Device disabled" });
  } catch (err) {
    req.log.error({ err }, "Failed to disable device");
    res.status(500).json({ error: "Failed to disable device" });
  }
});

// Get device logs
router.get("/:id/logs", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const logs = await db.select().from(deviceLogsTable).where(eq(deviceLogsTable.deviceId, id)).orderBy(desc(deviceLogsTable.createdAt)).limit(50);
    res.json(logs.map(l => ({ ...l, createdAt: l.createdAt.toISOString() })));
  } catch (err) {
    req.log.error({ err }, "Failed to get device logs");
    res.status(500).json({ error: "Failed to get device logs" });
  }
});

export default router;
