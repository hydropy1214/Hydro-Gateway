import { Router } from "express";
import healthRouter from "./health.js";
import dashboardRouter from "./dashboard.js";
import devicesRouter from "./devices.js";
import apkRouter from "./apk.js";
import campaignsRouter from "./campaigns.js";
import smsRouter from "./sms.js";
import activityRouter from "./activity.js";
import logsRouter from "./logs.js";
import systemRouter from "./system.js";
import configRouter from "./config.js";

const router = Router();

router.use("/healthz", healthRouter);
// Public: returns the API key so the dashboard can self-configure
router.use("/config", configRouter);
router.use("/dashboard", dashboardRouter);
router.use("/devices", devicesRouter);
router.use("/apk", apkRouter);
router.use("/campaigns", campaignsRouter);
router.use("/sms", smsRouter);
router.use("/activity", activityRouter);
router.use("/logs", logsRouter);
router.use("/system", systemRouter);

export default router;
