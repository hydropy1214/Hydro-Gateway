import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { devicesTable } from "./devices";

export const deviceLogsTable = pgTable("device_logs", {
  id: serial("id").primaryKey(),
  deviceId: integer("device_id").notNull().references(() => devicesTable.id),
  level: text("level").notNull().default("info"), // info, warn, error, debug
  message: text("message").notNull(),
  data: text("data"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const systemLogsTable = pgTable("system_logs", {
  id: serial("id").primaryKey(),
  level: text("level").notNull().default("info"),
  category: text("category").notNull(), // api, websocket, campaign, queue
  message: text("message").notNull(),
  data: text("data"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const activityEventsTable = pgTable("activity_events", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // device_connected, campaign_started, sms_sent, etc.
  message: text("message").notNull(),
  deviceId: integer("device_id"),
  deviceName: text("device_name"),
  campaignId: integer("campaign_id"),
  campaignName: text("campaign_name"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type DeviceLog = typeof deviceLogsTable.$inferSelect;
export type SystemLog = typeof systemLogsTable.$inferSelect;
export type ActivityEvent = typeof activityEventsTable.$inferSelect;
