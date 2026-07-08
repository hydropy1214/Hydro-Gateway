import { Router } from "express";
import { db } from "@workspace/db";
import { devicesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router = Router();
const startTime = Date.now();

router.get("/health", async (req, res) => {
  try {
    let dbStatus: "healthy" | "degraded" | "down" = "healthy";
    try {
      await db.execute(sql`SELECT 1`);
    } catch {
      dbStatus = "down";
    }

    const { wss } = await import("../websocket.js");
    const connectedCount = wss.getConnectedCount();

    res.json({
      database: dbStatus,
      backend: "healthy",
      websocket: "healthy",
      queueWorker: "healthy",
      connectedDevices: connectedCount,
      uptime: (Date.now() - startTime) / 1000,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get system health");
    res.status(500).json({ error: "Failed to get system health" });
  }
});

export default router;
