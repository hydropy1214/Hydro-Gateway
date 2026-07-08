import { pgTable, serial, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";

export const appVersionsTable = pgTable("app_versions", {
  id: serial("id").primaryKey(),
  version: text("version").notNull(),
  filename: text("filename").notNull(),
  size: integer("size"),
  isLatest: boolean("is_latest").notNull().default(false),
  downloadUrl: text("download_url").notNull(),
  changelog: text("changelog"),
  filePath: text("file_path"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type AppVersion = typeof appVersionsTable.$inferSelect;
