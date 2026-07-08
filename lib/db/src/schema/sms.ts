import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { devicesTable } from "./devices";
import { campaignsTable } from "./campaigns";

export const smsMessagesTable = pgTable("sms_messages", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").references(() => campaignsTable.id),
  deviceId: integer("device_id").references(() => devicesTable.id),
  phoneNumber: text("phone_number").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("CREATED"),
  // CREATED, QUEUED, ASSIGNED, SENT_TO_DEVICE, SENDING, SUCCESS, FAILED
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  sentAt: timestamp("sent_at"),
  resultAt: timestamp("result_at"),
});

export const smsLogsTable = pgTable("sms_logs", {
  id: serial("id").primaryKey(),
  smsId: integer("sms_id").notNull().references(() => smsMessagesTable.id),
  event: text("event").notNull(),
  data: text("data"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSmsMessageSchema = createInsertSchema(smsMessagesTable).omit({
  id: true, createdAt: true, sentAt: true, resultAt: true,
});
export type InsertSmsMessage = z.infer<typeof insertSmsMessageSchema>;
export type SmsMessage = typeof smsMessagesTable.$inferSelect;
