import { Router } from "express";
import { db } from "@workspace/db";
import {
  campaignsTable, contactsTable, smsMessagesTable, activityEventsTable
} from "@workspace/db";
import { eq, desc, inArray, and, sql } from "drizzle-orm";

const router = Router();

// ── List campaigns ────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { status } = req.query as { status?: string };
    let campaigns = await db
      .select()
      .from(campaignsTable)
      .orderBy(desc(campaignsTable.createdAt));
    if (status) campaigns = campaigns.filter(c => c.status === status);
    res.json(campaigns.map(serializeCampaign));
  } catch (err) {
    req.log.error({ err }, "Failed to list campaigns");
    res.status(500).json({ error: "Failed to list campaigns" });
  }
});

// ── Create campaign ───────────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const { name, message } = req.body;
    if (!name?.trim()) { res.status(400).json({ error: "Campaign name required" }); return; }
    if (!message?.trim()) { res.status(400).json({ error: "Message required" }); return; }
    const [campaign] = await db
      .insert(campaignsTable)
      .values({ name: name.trim(), message: message.trim() })
      .returning();
    res.status(201).json(serializeCampaign(campaign));
  } catch (err) {
    req.log.error({ err }, "Failed to create campaign");
    res.status(500).json({ error: "Failed to create campaign" });
  }
});

// ── Get campaign ──────────────────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id)).limit(1);
    if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }
    res.json(serializeCampaign(campaign));
  } catch (err) {
    req.log.error({ err }, "Failed to get campaign");
    res.status(500).json({ error: "Failed to get campaign" });
  }
});

// ── Update campaign ───────────────────────────────────────────────────────────
router.patch("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, message } = req.body;
    const [campaign] = await db
      .update(campaignsTable)
      .set({ name, message, updatedAt: new Date() })
      .where(eq(campaignsTable.id, id))
      .returning();
    if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }
    res.json(serializeCampaign(campaign));
  } catch (err) {
    req.log.error({ err }, "Failed to update campaign");
    res.status(500).json({ error: "Failed to update campaign" });
  }
});

// ── Delete campaign ───────────────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(smsMessagesTable).where(eq(smsMessagesTable.campaignId, id));
    await db.delete(contactsTable).where(eq(contactsTable.campaignId, id));
    await db.delete(campaignsTable).where(eq(campaignsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete campaign");
    res.status(500).json({ error: "Failed to delete campaign" });
  }
});

// ── Start campaign ────────────────────────────────────────────────────────────
router.post("/:id/start", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [campaign] = await db
      .select()
      .from(campaignsTable)
      .where(eq(campaignsTable.id, id))
      .limit(1);
    if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }

    if (campaign.status === "completed" || campaign.status === "cancelled") {
      res.status(400).json({ error: `Cannot start a ${campaign.status} campaign` });
      return;
    }

    if (campaign.status === "running") {
      res.json({ success: true, message: "Campaign already running" });
      return;
    }

    // Get all contacts
    const contacts = await db
      .select()
      .from(contactsTable)
      .where(eq(contactsTable.campaignId, id));

    if (contacts.length === 0) {
      res.status(400).json({ error: "No contacts to send to. Upload contacts first." });
      return;
    }

    // Find contacts that already have a QUEUED/SENT_TO_DEVICE/SENDING/SUCCESS/FAILED message
    // so we don't re-queue them on resume.
    const alreadyQueued = await db
      .select({ phoneNumber: smsMessagesTable.phoneNumber })
      .from(smsMessagesTable)
      .where(
        and(
          eq(smsMessagesTable.campaignId, id),
          inArray(smsMessagesTable.status, ["QUEUED", "SENT_TO_DEVICE", "SENDING", "ASSIGNED"])
        )
      );

    const alreadyQueuedNums = new Set(alreadyQueued.map(m => m.phoneNumber));
    const toQueue = contacts.filter(c => !alreadyQueuedNums.has(c.phoneNumber));

    if (toQueue.length > 0) {
      await db.insert(smsMessagesTable).values(
        toQueue.map(c => ({
          campaignId: id,
          phoneNumber: c.phoneNumber,
          message: campaign.message,
          status: "QUEUED",
        }))
      );
    }

    // Recalculate accurate pending count
    const [pendingRow] = await db
      .select({ pendingCount: sql<number>`count(*)::int` })
      .from(smsMessagesTable)
      .where(and(
        eq(smsMessagesTable.campaignId, id),
        inArray(smsMessagesTable.status, ["QUEUED", "SENT_TO_DEVICE", "SENDING", "ASSIGNED"])
      ));
    const pendingCount = pendingRow?.pendingCount ?? toQueue.length;

    await db.update(campaignsTable)
      .set({ pendingCount: pendingCount ?? toQueue.length, updatedAt: new Date() })
      .where(eq(campaignsTable.id, id));

    await setCampaignStatus(id, "running");
    res.json({ success: true, message: "Campaign started", queued: toQueue.length });
  } catch (err) {
    req.log.error({ err }, "Failed to start campaign");
    res.status(500).json({ error: "Failed to start campaign" });
  }
});

// ── Pause campaign ────────────────────────────────────────────────────────────
router.post("/:id/pause", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const campaign = await setCampaignStatus(id, "paused");
    if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }
    res.json({ success: true, message: "Campaign paused" });
  } catch (err) {
    req.log.error({ err }, "Failed to pause campaign");
    res.status(500).json({ error: "Failed to pause campaign" });
  }
});

// ── Resume campaign ───────────────────────────────────────────────────────────
router.post("/:id/resume", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const campaign = await setCampaignStatus(id, "running");
    if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }
    res.json({ success: true, message: "Campaign resumed" });
  } catch (err) {
    req.log.error({ err }, "Failed to resume campaign");
    res.status(500).json({ error: "Failed to resume campaign" });
  }
});

// ── Cancel campaign ───────────────────────────────────────────────────────────
router.post("/:id/cancel", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const campaign = await setCampaignStatus(id, "cancelled");
    if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }
    // Cancel all queued SMS for this campaign so they stop dispatching
    await db.update(smsMessagesTable)
      .set({ status: "CANCELLED" as any })
      .where(
        and(
          eq(smsMessagesTable.campaignId, id),
          inArray(smsMessagesTable.status, ["QUEUED", "SENT_TO_DEVICE"])
        )
      );
    res.json({ success: true, message: "Campaign cancelled" });
  } catch (err) {
    req.log.error({ err }, "Failed to cancel campaign");
    res.status(500).json({ error: "Failed to cancel campaign" });
  }
});

// ── Upload contacts ───────────────────────────────────────────────────────────
// Accepts multiple formats:
//   JSON:  { contacts: [{phoneNumber, name?}] }
//   Plain: { numbers: "+1234\n+5678" }  (newline or comma separated)
//   Plain: { numbers: "+1234,+5678,John Doe" }
router.post("/:id/contacts", async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id)).limit(1);
    if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }

    let parsed: Array<{ phoneNumber: string; name?: string }> = [];

    // Format 1: JSON array of objects
    if (Array.isArray(req.body.contacts)) {
      for (const c of req.body.contacts) {
        const num = normalizePhone(c.phoneNumber ?? c.phone_number ?? c.number ?? String(c));
        if (num) parsed.push({ phoneNumber: num, name: c.name?.toString() });
      }
    }
    // Format 2: raw text (one per line or comma-separated)
    else if (typeof req.body.numbers === "string" || typeof req.body.text === "string") {
      const raw: string = req.body.numbers ?? req.body.text;
      parsed = parsePhoneLines(raw);
    }
    // Format 3: JSON array of strings
    else if (Array.isArray(req.body)) {
      for (const item of req.body) {
        if (typeof item === "string") {
          const num = normalizePhone(item);
          if (num) parsed.push({ phoneNumber: num });
        } else if (item?.phoneNumber) {
          const num = normalizePhone(item.phoneNumber);
          if (num) parsed.push({ phoneNumber: num, name: item.name });
        }
      }
    }

    if (!parsed.length) {
      res.status(400).json({ error: "No valid phone numbers found. Provide JSON array or plain text, one number per line." });
      return;
    }

    // Deduplicate within the upload
    const seen = new Set<string>();
    const deduped = parsed.filter(c => {
      if (seen.has(c.phoneNumber)) return false;
      seen.add(c.phoneNumber);
      return true;
    });

    // Find existing contacts to avoid duplicates
    const existing = await db
      .select({ phoneNumber: contactsTable.phoneNumber })
      .from(contactsTable)
      .where(eq(contactsTable.campaignId, id));
    const existingNums = new Set(existing.map(c => c.phoneNumber));

    const newContacts = deduped.filter(c => !existingNums.has(c.phoneNumber));
    const skipped = deduped.length - newContacts.length;

    if (newContacts.length > 0) {
      await db.insert(contactsTable).values(
        newContacts.map(c => ({ campaignId: id, phoneNumber: c.phoneNumber, name: c.name ?? null }))
      );
    }

    const totalNow = existing.length + newContacts.length;
    await db.update(campaignsTable)
      .set({ totalContacts: totalNow, pendingCount: totalNow, updatedAt: new Date() })
      .where(eq(campaignsTable.id, id));

    res.json({ imported: newContacts.length, skipped, total: totalNow });
  } catch (err) {
    req.log.error({ err }, "Failed to upload contacts");
    res.status(500).json({ error: "Failed to upload contacts" });
  }
});

// ── Get contacts ──────────────────────────────────────────────────────────────
router.get("/:id/contacts", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const contacts = await db
      .select()
      .from(contactsTable)
      .where(eq(contactsTable.campaignId, id))
      .orderBy(contactsTable.id);
    res.json(contacts);
  } catch (err) {
    req.log.error({ err }, "Failed to get contacts");
    res.status(500).json({ error: "Failed to get contacts" });
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function serializeCampaign(c: typeof campaignsTable.$inferSelect) {
  return {
    ...c,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt?.toISOString() ?? null,
    startedAt: c.startedAt?.toISOString() ?? null,
    completedAt: c.completedAt?.toISOString() ?? null,
  };
}

async function setCampaignStatus(id: number, status: string) {
  const updates: Record<string, unknown> = { status, updatedAt: new Date() };
  if (status === "running") updates.startedAt = new Date();
  if (status === "completed" || status === "cancelled") updates.completedAt = new Date();

  const [campaign] = await db
    .update(campaignsTable)
    .set(updates as any)
    .where(eq(campaignsTable.id, id))
    .returning();

  if (campaign) {
    const eventMap: Record<string, string> = {
      running: "campaign_started",
      paused: "campaign_paused",
      completed: "campaign_completed",
      cancelled: "campaign_cancelled",
    };
    await db.insert(activityEventsTable).values({
      type: eventMap[status] ?? "campaign_updated",
      message: `Campaign "${campaign.name}" ${status}`,
      campaignId: campaign.id,
      campaignName: campaign.name,
    });
  }

  return campaign;
}

/** Normalize a phone number string. Returns null if not phone-like. */
function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  // Strip everything except digits, +, and spaces
  const cleaned = raw.trim().replace(/[^\d+\s()\-]/g, "");
  // Must contain at least 7 digits
  if ((cleaned.match(/\d/g)?.length ?? 0) < 7) return null;
  // Preserve as-is after trimming
  return raw.trim().split(/\s+/)[0]; // take first token (the number part if "number name")
}

/** Parse a free-form text block of phone numbers (one per line, comma-separated, mixed). */
function parsePhoneLines(text: string): Array<{ phoneNumber: string; name?: string }> {
  const results: Array<{ phoneNumber: string; name?: string }> = [];
  // Split on newlines and commas
  const tokens = text.split(/[\n,;]+/);
  for (const token of tokens) {
    const trimmed = token.trim();
    if (!trimmed) continue;
    // Could be "number name" or "name,number" or just "number"
    const parts = trimmed.split(/\s+/);
    const possibleNum = parts.find(p => /^\+?\d[\d\s\-()]{6,}$/.test(p));
    if (possibleNum) {
      const name = parts.filter(p => p !== possibleNum).join(" ").trim() || undefined;
      results.push({ phoneNumber: possibleNum, name: name || undefined });
    }
  }
  return results;
}

export default router;
