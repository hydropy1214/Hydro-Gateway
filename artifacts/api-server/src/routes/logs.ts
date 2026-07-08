import { Router } from "express";
import { db } from "@workspace/db";
import { systemLogsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

router.get("/api", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const logs = await db
      .select()
      .from(systemLogsTable)
      .where(eq(systemLogsTable.category, "api"))
      .orderBy(desc(systemLogsTable.createdAt))
      .limit(limit);

    res.json(logs.map(l => ({ ...l, createdAt: l.createdAt.toISOString() })));
  } catch (err) {
    req.log.error({ err }, "Failed to get API logs");
    res.status(500).json({ error: "Failed to get API logs" });
  }
});

router.get("/websocket", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const logs = await db
      .select()
      .from(systemLogsTable)
      .where(eq(systemLogsTable.category, "websocket"))
      .orderBy(desc(systemLogsTable.createdAt))
      .limit(limit);

    res.json(logs.map(l => ({ ...l, createdAt: l.createdAt.toISOString() })));
  } catch (err) {
    req.log.error({ err }, "Failed to get WebSocket logs");
    res.status(500).json({ error: "Failed to get WebSocket logs" });
  }
});

export default router;
