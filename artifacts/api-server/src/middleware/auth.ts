import { Request, Response, NextFunction } from "express";
import { createHash, randomBytes } from "crypto";
import { logger } from "../lib/logger.js";

let apiKey: string;

/**
 * Must be called once at startup before the server accepts requests.
 * Priority: HYDROPY_API_KEY env var → derived from SESSION_SECRET → random (changes on restart).
 */
export function initApiKey(): string {
  apiKey = process.env.HYDROPY_API_KEY ?? "";
  if (!apiKey) {
    const secret = process.env.SESSION_SECRET ?? "";
    if (secret) {
      apiKey = createHash("sha256").update(secret + ":hydropy-api").digest("hex").substring(0, 40);
      logger.warn("HYDROPY_API_KEY not set — key derived from SESSION_SECRET (stable across restarts)");
    } else {
      apiKey = randomBytes(20).toString("hex");
      logger.warn({ key: apiKey }, "HYDROPY_API_KEY and SESSION_SECRET both unset — using random key (changes on restart!)");
    }
  }
  logger.info(`API key initialised (length=${apiKey.length})`);
  return apiKey;
}

/**
 * Express middleware: requires a valid API key in one of:
 *   Authorization: Bearer <key>
 *   X-API-Key: <key>
 *   ?apiKey=<key>  (dev convenience only)
 */
export function getApiKey(): string {
  return apiKey ?? "";
}

export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const bearerToken = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  const headerKey = req.headers["x-api-key"] as string | undefined;
  const queryKey = req.query.apiKey as string | undefined;

  const provided = bearerToken ?? headerKey ?? queryKey;

  if (!provided || provided !== apiKey) {
    logger.warn({ url: req.url, ip: req.ip }, "Unauthorized API request");
    res.status(401).json({ error: "Unauthorized: invalid or missing API key" });
    return;
  }
  next();
}
