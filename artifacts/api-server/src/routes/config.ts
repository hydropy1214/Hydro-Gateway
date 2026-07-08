import { Router } from "express";
import { getApiKey } from "../middleware/auth.js";

const router = Router();

/**
 * Public endpoint: returns the API key so the dashboard can authenticate
 * without requiring manual config. Relies on CORS being origin-locked in
 * production to prevent cross-origin leakage.
 */
router.get("/", (_req, res) => {
  res.json({ apiKey: getApiKey() });
});

export default router;
