import http from "http";
import app from "./app.js";
import { logger } from "./lib/logger.js";
import { wss } from "./websocket.js";
import { initApiKey } from "./middleware/auth.js";
import { startCampaignWorker } from "./workers/campaignWorker.js";

const rawPort = process.env["PORT"];
if (!rawPort) throw new Error("PORT environment variable is required but was not provided.");

const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) throw new Error(`Invalid PORT value: "${rawPort}"`);

initApiKey();

const httpServer = http.createServer(app);
wss.init(httpServer);

httpServer.listen(port, (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "HYDROPY server listening");
  startCampaignWorker();
});
