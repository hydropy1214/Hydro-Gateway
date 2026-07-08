/**
 * Campaign Dispatch Worker
 *
 * Polls for QUEUED SMS messages belonging to running campaigns and dispatches
 * them to online Android devices via WebSocket (SEND_SMS command).
 *
 * Runs on a 2-second loop. Round-robins across all online devices so no single
 * phone is overloaded. Each device's SMS worker enforces 700 ms between sends.
 */

import { db } from "@workspace/db";
import { smsMessagesTable, devicesTable, campaignsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";

const BATCH_SIZE = 30; // messages per dispatch tick
const POLL_MS = 2_000;

let running = false;
let timer: NodeJS.Timeout | null = null;

async function tick() {
  try {
    // 1. Find online devices
    const online = await db
      .select({ id: devicesTable.id, deviceId: devicesTable.deviceId, name: devicesTable.name })
      .from(devicesTable)
      .where(eq(devicesTable.status, "online"));

    if (online.length === 0) return; // no devices — wait

    // 2. Get QUEUED messages for running campaigns (oldest first)
    const queued = await db
      .select({
        id: smsMessagesTable.id,
        campaignId: smsMessagesTable.campaignId,
        phoneNumber: smsMessagesTable.phoneNumber,
        message: smsMessagesTable.message,
      })
      .from(smsMessagesTable)
      .innerJoin(
        campaignsTable,
        and(
          eq(smsMessagesTable.campaignId, campaignsTable.id),
          eq(campaignsTable.status, "running")
        )
      )
      .where(eq(smsMessagesTable.status, "QUEUED"))
      .orderBy(smsMessagesTable.id)
      .limit(BATCH_SIZE);

    if (queued.length === 0) return;

    // 3. Lazy-import wss to avoid circular deps at module load time
    const { wss } = await import("../websocket.js");

    let devIdx = 0;
    for (const msg of queued) {
      const device = online[devIdx % online.length];
      devIdx++;

      const delivered = wss.sendToDevice(device.deviceId, {
        type: "SEND_SMS",
        number: msg.phoneNumber,
        message: msg.message,
        smsId: msg.id,
      });

      if (delivered) {
        await db
          .update(smsMessagesTable)
          .set({
            status: "SENT_TO_DEVICE",
            deviceId: device.id,
            sentAt: new Date(),
          })
          .where(eq(smsMessagesTable.id, msg.id));
      }
    }
  } catch (err) {
    logger.error({ err }, "Campaign worker tick error");
  }
}

export function startCampaignWorker() {
  if (running) return;
  running = true;

  const loop = async () => {
    await tick();
    if (running) timer = setTimeout(loop, POLL_MS);
  };

  timer = setTimeout(loop, POLL_MS);
  logger.info("Campaign dispatch worker started");
}

export function stopCampaignWorker() {
  running = false;
  if (timer) { clearTimeout(timer); timer = null; }
  logger.info("Campaign dispatch worker stopped");
}
