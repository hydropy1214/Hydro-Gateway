import { Router } from "express";
import { db } from "@workspace/db";
import { appVersionsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// apk-storage lives alongside the compiled output (dist/ → parent is artifacts/api-server/)
const APK_DIR = path.resolve(__dirname, "..", "apk-storage");
if (!fs.existsSync(APK_DIR)) fs.mkdirSync(APK_DIR, { recursive: true });
const PREBUILT_APK = path.join(APK_DIR, "HYDROPY-Gateway.apk");

// List APK versions
router.get("/versions", async (req, res) => {
  try {
    const versions = await db
      .select()
      .from(appVersionsTable)
      .orderBy(desc(appVersionsTable.createdAt));

    res.json(versions.map(v => ({
      ...v,
      createdAt: v.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to list APK versions");
    res.status(500).json({ error: "Failed to list APK versions" });
  }
});

// Get latest APK
router.get("/latest", async (req, res) => {
  try {
    const [latest] = await db
      .select()
      .from(appVersionsTable)
      .where(eq(appVersionsTable.isLatest, true))
      .limit(1);

    if (!latest) {
      // No DB record yet — serve info derived from the pre-built APK on disk
      const fileSize = fs.existsSync(PREBUILT_APK)
        ? fs.statSync(PREBUILT_APK).size
        : null;
      const fileMtime = fs.existsSync(PREBUILT_APK)
        ? fs.statSync(PREBUILT_APK).mtime.toISOString()
        : new Date().toISOString();
      res.json({
        id: 0,
        version: "1.0.0",
        filename: "HYDROPY-Gateway.apk",
        size: fileSize,
        isLatest: true,
        downloadUrl: "/api/apk/latest/download",
        changelog: "• Fixed pairing WebSocket path (/api/ws)\n• Permissions requested at app launch\n• Bulk SMS worker with carrier rate limiting\n• SMS result buffering & replay on reconnect\n• Orphaned SENDING row recovery on restart\n• Multipart SMS single-callback fix\n• Exponential reconnect backoff",
        createdAt: fileMtime,
      });
      return;
    }

    res.json({ ...latest, createdAt: latest.createdAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to get latest APK");
    res.status(500).json({ error: "Failed to get latest APK" });
  }
});

// Download latest APK (convenience alias used by the dashboard)
router.get("/latest/download", (_req, res) => {
  if (fs.existsSync(PREBUILT_APK)) {
    res.setHeader("Content-Disposition", 'attachment; filename="HYDROPY-Gateway.apk"');
    res.setHeader("Content-Type", "application/vnd.android.package-archive");
    return res.sendFile(PREBUILT_APK);
  }
  res.status(404).json({ error: "APK file not found on server." });
});

// Download APK by id (id=0 → pre-built release)
router.get("/:id/download", async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (id === 0) {
      if (fs.existsSync(PREBUILT_APK)) {
        res.setHeader("Content-Disposition", 'attachment; filename="HYDROPY-Gateway.apk"');
        res.setHeader("Content-Type", "application/vnd.android.package-archive");
        return res.sendFile(PREBUILT_APK);
      }
      res.status(404).json({ error: "APK not yet built." });
      return;
    }

    const [version] = await db
      .select()
      .from(appVersionsTable)
      .where(eq(appVersionsTable.id, id))
      .limit(1);

    if (!version) { res.status(404).json({ error: "APK version not found" }); return; }

    const filePath = version.filePath ?? path.join(APK_DIR, version.filename);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: "APK file not found on server" }); return;
    }

    res.setHeader("Content-Disposition", `attachment; filename="${version.filename}"`);
    res.setHeader("Content-Type", "application/vnd.android.package-archive");
    res.sendFile(filePath);
  } catch (err) {
    req.log.error({ err }, "Failed to download APK");
    res.status(500).json({ error: "Failed to download APK" });
  }
});

export default router;
