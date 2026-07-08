import { Router } from "express";
import { db } from "@workspace/db";
import { devicesTable, campaignsTable, smsMessagesTable } from "@workspace/db";
import { sql, and, gte, eq } from "drizzle-orm";

const router = Router();

router.get("/stats", async (req, res) => {
  try {
    const [deviceStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        online: sql<number>`count(*) filter (where status = 'online')::int`,
        offline: sql<number>`count(*) filter (where status = 'offline')::int`,
      })
      .from(devicesTable);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [smsStats] = await db
      .select({
        sentToday: sql<number>`count(*) filter (where status = 'SUCCESS' and created_at >= ${today})::int`,
        pending: sql<number>`count(*) filter (where status in ('CREATED','QUEUED','ASSIGNED','SENT_TO_DEVICE','SENDING'))::int`,
        failed: sql<number>`count(*) filter (where status = 'FAILED')::int`,
        total: sql<number>`count(*)::int`,
        success: sql<number>`count(*) filter (where status = 'SUCCESS')::int`,
      })
      .from(smsMessagesTable);

    const [campaignStats] = await db
      .select({
        active: sql<number>`count(*) filter (where status = 'running')::int`,
        total: sql<number>`count(*)::int`,
      })
      .from(campaignsTable);

    const totalProcessed = (smsStats.success ?? 0) + (smsStats.failed ?? 0);
    const successRate = totalProcessed > 0
      ? Math.round(((smsStats.success ?? 0) / totalProcessed) * 10000) / 100
      : 0;

    res.json({
      totalDevices: deviceStats.total ?? 0,
      onlineDevices: deviceStats.online ?? 0,
      offlineDevices: deviceStats.offline ?? 0,
      smsSentToday: smsStats.sentToday ?? 0,
      smsPending: smsStats.pending ?? 0,
      smsFailed: smsStats.failed ?? 0,
      activeCampaigns: campaignStats.active ?? 0,
      totalCampaigns: campaignStats.total ?? 0,
      queuedMessages: smsStats.pending ?? 0,
      successRate,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get dashboard stats");
    res.status(500).json({ error: "Failed to get stats" });
  }
});

export default router;
