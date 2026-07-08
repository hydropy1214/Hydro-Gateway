import { pgTable, serial, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const devicesTable = pgTable("devices", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  deviceId: text("device_id").notNull().unique(),
  status: text("status").notNull().default("offline"), // online, offline, disabled
  battery: integer("battery"),
  androidVersion: text("android_version"),
  phoneModel: text("phone_model"),
  phoneNumber: text("phone_number"),   // SIM phone number if readable
  simInfo: text("sim_info"),
  signalStrength: integer("signal_strength"),
  lastHeartbeat: timestamp("last_heartbeat"),
  smsCount: integer("sms_count").notNull().default(0),
  currentTask: text("current_task"),
  ipAddress: text("ip_address"),
  authToken: text("auth_token"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export const deviceSessionsTable = pgTable("device_sessions", {
  id: serial("id").primaryKey(),
  deviceId: integer("device_id").notNull().references(() => devicesTable.id),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  endedAt: timestamp("ended_at"),
  ipAddress: text("ip_address"),
});

export const pairCodesTable = pgTable("pair_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertDeviceSchema = createInsertSchema(devicesTable).omit({
  id: true, createdAt: true, updatedAt: true, smsCount: true,
});
export type InsertDevice = z.infer<typeof insertDeviceSchema>;
export type Device = typeof devicesTable.$inferSelect;
export type DeviceSession = typeof deviceSessionsTable.$inferSelect;
export type PairCode = typeof pairCodesTable.$inferSelect;
