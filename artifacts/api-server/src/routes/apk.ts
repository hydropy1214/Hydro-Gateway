import { Router } from "express";
import { db } from "@workspace/db";
import { appVersionsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// apk-storage is placed alongside the compiled dist/ output; resolve one level up
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
    res.json(versions.map(v => ({ ...v, createdAt: v.createdAt.toISOString() })));
  } catch (err) {
    req.log.error({ err }, "Failed to list APK versions");
    res.status(500).json({ error: "Failed to list APK versions" });
  }
});

// Get latest APK metadata
router.get("/latest", async (req, res) => {
  try {
    const [latest] = await db
      .select()
      .from(appVersionsTable)
      .where(eq(appVersionsTable.isLatest, true))
      .limit(1);

    if (!latest) {
      // No DB record — derive info from the pre-built APK on disk
      const fileSize = fs.existsSync(PREBUILT_APK) ? fs.statSync(PREBUILT_APK).size : null;
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
        changelog:
          "• WebSocket authentication fix (token-based, no deviceId mismatch)\n" +
          "• Dashboard real-time device status via WebSocket broadcasts\n" +
          "• Bulk SMS worker with 700 ms carrier rate limiting\n" +
          "• SMS result buffering & replay on reconnect\n" +
          "• Orphaned SENDING row recovery on service restart\n" +
          "• Multipart SMS single-callback fix\n" +
          "• Exponential reconnect backoff (3 s → 30 s)\n" +
          "• Auto-start on phone reboot via BootReceiver",
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

// Download latest APK — public, no auth required
router.get("/latest/download", (_req, res) => {
  if (fs.existsSync(PREBUILT_APK)) {
    res.setHeader("Content-Disposition", 'attachment; filename="HYDROPY-Gateway.apk"');
    res.setHeader("Content-Type", "application/vnd.android.package-archive");
    return res.sendFile(PREBUILT_APK);
  }
  res.status(404).json({ error: "APK not yet built. See README for build instructions." });
});

// Download APK by id — public, no auth required
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

    if (!version) {
      res.status(404).json({ error: "APK version not found" });
      return;
    }

    const filePath = version.filePath ?? path.join(APK_DIR, version.filename);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: "APK file not found on server" });
      return;
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
