import { Router } from "express";
import { db } from "@workspace/db";
import { activityEventsTable } from "@workspace/db";
import { desc } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const events = await db
      .select()
      .from(activityEventsTable)
      .orderBy(desc(activityEventsTable.createdAt))
      .limit(limit);

    res.json(events.map(e => ({
      ...e,
      createdAt: e.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get activity");
    res.status(500).json({ error: "Failed to get activity" });
  }
});

export default router;
