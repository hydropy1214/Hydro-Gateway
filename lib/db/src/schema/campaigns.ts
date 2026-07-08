import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const campaignsTable = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status").notNull().default("draft"), // draft, running, paused, completed, cancelled
  message: text("message").notNull(),
  totalContacts: integer("total_contacts").notNull().default(0),
  sentCount: integer("sent_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  pendingCount: integer("pending_count").notNull().default(0),
  assignedDevices: integer("assigned_devices").notNull().default(0),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export const contactsTable = pgTable("contacts", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => campaignsTable.id),
  phoneNumber: text("phone_number").notNull(),
  name: text("name"),
  status: text("status").notNull().default("pending"), // pending, sent, failed
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCampaignSchema = createInsertSchema(campaignsTable).omit({
  id: true, createdAt: true, updatedAt: true,
  totalContacts: true, sentCount: true, failedCount: true, pendingCount: true, assignedDevices: true,
});
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Campaign = typeof campaignsTable.$inferSelect;
export type Contact = typeof contactsTable.$inferSelect;
