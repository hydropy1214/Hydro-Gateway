import { Router } from "express";
import { db } from "@workspace/db";
import { appVersionsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import fs from "fs";
import path from "path";

const router = Router();
const APK_DIR = path.resolve(process.cwd(), "apk-storage");
if (!fs.existsSync(APK_DIR)) fs.mkdirSync(APK_DIR, { recursive: true });

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
      // Return a placeholder if no APK has been uploaded
      res.json({
        id: 0,
        version: "1.0.0",
        filename: "HYDROPY-Gateway.apk",
        size: null,
        isLatest: true,
        downloadUrl: "/api/apk/0/download",
        changelog: "Initial release",
        createdAt: new Date().toISOString(),
      });
      return;
    }

    res.json({ ...latest, createdAt: latest.createdAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to get latest APK");
    res.status(500).json({ error: "Failed to get latest APK" });
  }
});

// Download APK
router.get("/:id/download", async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (id === 0) {
      // Serve the pre-built APK from the android-gateway directory
      const prebuiltPath = path.resolve(process.cwd(), "android-gateway", "app", "build", "outputs", "apk", "release", "HYDROPY-Gateway.apk");
      if (fs.existsSync(prebuiltPath)) {
        res.setHeader("Content-Disposition", 'attachment; filename="HYDROPY-Gateway.apk"');
        res.setHeader("Content-Type", "application/vnd.android.package-archive");
        return res.sendFile(prebuiltPath);
      }
      res.status(404).json({ error: "APK not yet built. Build the Android project to generate the APK." });
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
