import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { pinoHttp } from "pino-http";
import { logger } from "./lib/logger.js";
import router from "./routes/index.js";
import { requireApiKey } from "./middleware/auth.js";

const app = express();

// CORS: lock to same-origin in production, permissive in dev
const corsOrigin = process.env.NODE_ENV === "production"
  ? (process.env.ALLOWED_ORIGIN ?? false)
  : true;
app.use(cors({ origin: corsOrigin, credentials: true }));

app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(pinoHttp({ logger }));

// Apply auth to /api/* — carve out public paths inline so the router is only mounted once
app.use("/api", (req, res, next) => {
  const isPublic =
    req.path === "/healthz" ||
    req.path.startsWith("/healthz/") ||
    // Dashboard fetches the derived API key on startup for self-configuration
    req.path === "/config" ||
    // Android app pairs using a short-lived pair code — no API key needed at this step
    req.path === "/devices/pair";
  if (isPublic) return next();
  return requireApiKey(req, res, next);
}, router);

export default app;
