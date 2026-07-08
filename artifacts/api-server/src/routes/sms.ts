import { Router } from "express";
import { db } from "@workspace/db";
import { smsMessagesTable, devicesTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const { status, campaign_id, limit = "50", offset = "0" } = req.query as Record<string, string>;
    const lim = Math.min(parseInt(limit) || 50, 500);
    const off = parseInt(offset) || 0;

    const messages = await db.select().from(smsMessagesTable).orderBy(desc(smsMessagesTable.createdAt)).limit(lim).offset(off);
    const filtered = messages.filter(m => {
      if (status && m.status !== status) return false;
      if (campaign_id && m.campaignId !== parseInt(campaign_id)) return false;
      return true;
    });

    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(smsMessagesTable);

    res.json({
      messages: filtered.map(m => ({
        ...m,
        createdAt: m.createdAt.toISOString(),
        sentAt: m.sentAt?.toISOString() ?? null,
        resultAt: m.resultAt?.toISOString() ?? null,
      })),
      total: count ?? 0,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to list SMS messages");
    res.status(500).json({ error: "Failed to list SMS messages" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { phoneNumber, message, deviceId } = req.body;
    const [sms] = await db.insert(smsMessagesTable).values({ phoneNumber, message, deviceId, status: "QUEUED" }).returning();

    if (deviceId) {
      try {
        const { wss } = await import("../websocket.js");
        const [device] = await db.select().from(devicesTable).where(eq(devicesTable.id, deviceId)).limit(1);
        if (device) {
          wss.sendToDevice(device.deviceId, { type: "SEND_SMS", number: phoneNumber, message, smsId: sms.id });
          await db.update(smsMessagesTable).set({ status: "SENT_TO_DEVICE" }).where(eq(smsMessagesTable.id, sms.id));
        }
      } catch (_) { /* non-fatal */ }
    }

    res.status(201).json({ ...sms, createdAt: sms.createdAt.toISOString(), sentAt: null, resultAt: null });
  } catch (err) {
    req.log.error({ err }, "Failed to send SMS");
    res.status(500).json({ error: "Failed to send SMS" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [sms] = await db.select().from(smsMessagesTable).where(eq(smsMessagesTable.id, id)).limit(1);
    if (!sms) {
      res.status(404).json({ error: "SMS not found" });
      return;
    }
    res.json({ ...sms, createdAt: sms.createdAt.toISOString(), sentAt: sms.sentAt?.toISOString() ?? null, resultAt: sms.resultAt?.toISOString() ?? null });
  } catch (err) {
    req.log.error({ err }, "Failed to get SMS");
    res.status(500).json({ error: "Failed to get SMS" });
  }
});

export default router;
