import { Router } from "express";
import { db } from "@workspace/db";
import {
  campaignsTable, contactsTable, smsMessagesTable, activityEventsTable
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

// List campaigns
router.get("/", async (req, res) => {
  try {
    const { status } = req.query as { status?: string };
    let campaigns = await db
      .select()
      .from(campaignsTable)
      .orderBy(desc(campaignsTable.createdAt));

    if (status) campaigns = campaigns.filter(c => c.status === status);

    res.json(campaigns.map(c => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt?.toISOString() ?? null,
      startedAt: c.startedAt?.toISOString() ?? null,
      completedAt: c.completedAt?.toISOString() ?? null,
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to list campaigns");
    res.status(500).json({ error: "Failed to list campaigns" });
  }
});

// Create campaign
router.post("/", async (req, res) => {
  try {
    const { name, message } = req.body;
    const [campaign] = await db
      .insert(campaignsTable)
      .values({ name, message })
      .returning();

    res.status(201).json({
      ...campaign,
      createdAt: campaign.createdAt.toISOString(),
      updatedAt: null, startedAt: null, completedAt: null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create campaign");
    res.status(500).json({ error: "Failed to create campaign" });
  }
});

// Get campaign
router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [campaign] = await db
      .select().from(campaignsTable).where(eq(campaignsTable.id, id)).limit(1);
    if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }

    res.json({
      ...campaign,
      createdAt: campaign.createdAt.toISOString(),
      updatedAt: campaign.updatedAt?.toISOString() ?? null,
      startedAt: campaign.startedAt?.toISOString() ?? null,
      completedAt: campaign.completedAt?.toISOString() ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get campaign");
    res.status(500).json({ error: "Failed to get campaign" });
  }
});

// Update campaign
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
    res.json({
      ...campaign,
      createdAt: campaign.createdAt.toISOString(),
      updatedAt: campaign.updatedAt?.toISOString() ?? null,
      startedAt: campaign.startedAt?.toISOString() ?? null,
      completedAt: campaign.completedAt?.toISOString() ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update campaign");
    res.status(500).json({ error: "Failed to update campaign" });
  }
});

// Delete campaign
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(campaignsTable).where(eq(campaignsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete campaign");
    res.status(500).json({ error: "Failed to delete campaign" });
  }
});

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
      type: eventMap[status] ?? "campaign_started",
      message: `Campaign "${campaign.name}" ${status}`,
      campaignId: campaign.id,
      campaignName: campaign.name,
    });
  }

  return campaign;
}

router.post("/:id/start", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id)).limit(1);
    if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }

    // Queue all pending contacts as SMS messages
    const contacts = await db
      .select()
      .from(contactsTable)
      .where(eq(contactsTable.campaignId, id));

    if (contacts.length > 0) {
      await db.insert(smsMessagesTable).values(
        contacts.map(c => ({
          campaignId: id,
          phoneNumber: c.phoneNumber,
          message: campaign.message,
          status: "QUEUED",
        }))
      );
      await db.update(campaignsTable)
        .set({ pendingCount: contacts.length, updatedAt: new Date() })
        .where(eq(campaignsTable.id, id));
    }

    await setCampaignStatus(id, "running");
    res.json({ success: true, message: "Campaign started" });
  } catch (err) {
    req.log.error({ err }, "Failed to start campaign");
    res.status(500).json({ error: "Failed to start campaign" });
  }
});

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

router.post("/:id/cancel", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const campaign = await setCampaignStatus(id, "cancelled");
    if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }
    // Cancel all queued SMS for this campaign
    await db.update(smsMessagesTable)
      .set({ status: "CANCELLED" })
      .where(eq(smsMessagesTable.campaignId, id));
    res.json({ success: true, message: "Campaign cancelled" });
  } catch (err) {
    req.log.error({ err }, "Failed to cancel campaign");
    res.status(500).json({ error: "Failed to cancel campaign" });
  }
});

// Upload contacts
router.post("/:id/contacts", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { contacts } = req.body as {
      contacts: Array<{ phoneNumber: string; name?: string }>;
    };

    if (!contacts?.length) {
      res.status(400).json({ error: "No contacts provided" }); return;
    }

    await db.insert(contactsTable).values(
      contacts.map(c => ({ campaignId: id, phoneNumber: c.phoneNumber, name: c.name }))
    );

    await db
      .update(campaignsTable)
      .set({ totalContacts: contacts.length, pendingCount: contacts.length, updatedAt: new Date() })
      .where(eq(campaignsTable.id, id));

    res.json({ imported: contacts.length, skipped: 0 });
  } catch (err) {
    req.log.error({ err }, "Failed to upload contacts");
    res.status(500).json({ error: "Failed to upload contacts" });
  }
});

export default router;
