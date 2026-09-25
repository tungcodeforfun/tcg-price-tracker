import { evaluateAlerts, snapshotPortfolios } from "@tcg/core";
import { PgBoss } from "pg-boss";
import { deliverAlertEmails } from "./alerts/run.ts";
import { loadConfig } from "./config.ts";
import { createImageSources, describeSetImages, syncSetImages } from "./images/sync.ts";
import { describeCatalog, describeDueSets, describeSetPrices } from "./report.ts";
import { createServices, setsDueForPrices } from "./services.ts";
import { syncCatalog } from "./sync/catalog.ts";
import { syncSetPrices } from "./sync/set-prices.ts";

const SYNC_CATALOG = "sync-catalog";
const SYNC_PRICES = "sync-prices";
const SYNC_SET_PRICES = "sync-set-prices";
const SNAPSHOT_PORTFOLIOS = "snapshot-portfolios";
const DELIVER_NOTIFICATIONS = "deliver-notifications";

interface SetPricesJob {
  setId: string;
}

const config = loadConfig();
const services = createServices(config);
const { db, provider } = services;
const imageSources = createImageSources({ disabledGames: config.imagesDisabledGames });

const boss = new PgBoss(config.databaseUrl);
boss.on("error", (error) => console.error("[pg-boss]", error));
await boss.start();

// `exclusive` allows one queued-or-active job per queue (per set for set prices), so a slow run is
// never doubled up. Failed runs retry after a delay instead of hammering the provider.
const retry = { retryDelay: 5 * 60, retryBackoff: true };
await boss.createQueue(SYNC_CATALOG, { policy: "exclusive", ...retry });
await boss.createQueue(SYNC_PRICES, { policy: "exclusive", ...retry });
await boss.createQueue(SYNC_SET_PRICES, {
  policy: "exclusive",
  expireInSeconds: 60 * 60,
  ...retry,
});

await boss.schedule(SYNC_CATALOG, "0 3 * * *", null, { tz: "UTC" });
await boss.createQueue(SNAPSHOT_PORTFOLIOS, { policy: "exclusive", ...retry });
// Singleton: at most one queued delivery; row locks make overlapping runs safe anyway.
await boss.createQueue(DELIVER_NOTIFICATIONS, { policy: "singleton" });
await boss.schedule(SYNC_PRICES, "0 5 * * *", null, { tz: "UTC" });
// End of the UTC day, after that day's price sync.
await boss.schedule(SNAPSHOT_PORTFOLIOS, "30 23 * * *", null, { tz: "UTC" });
// Picks up retries of failed sends; fresh alerts are delivered right after each set sync.
await boss.schedule(DELIVER_NOTIFICATIONS, "*/5 * * * *", null, { tz: "UTC" });

await boss.work(SYNC_CATALOG, async () => {
  const result = await syncCatalog({ db, provider, enabledGames: config.enabledGames });
  console.log(`[${SYNC_CATALOG}] ${describeCatalog(result)}`);
  return result;
});

await boss.work(SYNC_PRICES, async () => {
  const due = await setsDueForPrices(services);
  let queued = 0;
  for (const { id: setId } of due.sets) {
    const jobId = await boss.send(SYNC_SET_PRICES, { setId } satisfies SetPricesJob, {
      singletonKey: setId,
    });
    if (jobId) queued += 1;
  }
  console.log(`[${SYNC_PRICES}] ${describeDueSets(due)}; queued ${queued}`);
  return { dailyBudget: due.dailyBudget, due: due.sets.length, queued };
});

await boss.work(SNAPSHOT_PORTFOLIOS, async () => {
  const day = new Date().toISOString().slice(0, 10);
  const written = await snapshotPortfolios(db, day);
  console.log(`[${SNAPSHOT_PORTFOLIOS}] ${day}: ${written} portfolios`);
  return { day, written };
});

await boss.work(DELIVER_NOTIFICATIONS, async () => {
  const result = await deliverAlertEmails(services);
  if (result.sent + result.failed + result.retrying > 0) {
    console.log(
      `[${DELIVER_NOTIFICATIONS}] sent ${result.sent}, retrying ${result.retrying}, failed ${result.failed}`,
    );
  }
  return result;
});

/** Card images are best effort: a failure is logged and never fails the price job. */
async function syncImages(setId: string): Promise<void> {
  try {
    const result = await syncSetImages({ db, sources: imageSources, setId });
    if (result.status !== "unsupported") {
      console.log(`[${SYNC_SET_PRICES}] ${describeSetImages(setId, result)}`);
    }
  } catch (error) {
    console.error(`[${SYNC_SET_PRICES}] images for ${setId} failed:`, error);
  }
}

// One set at a time keeps request pacing and quota checks serial.
await boss.work<SetPricesJob>(
  SYNC_SET_PRICES,
  { batchSize: 1, localConcurrency: 1 },
  async (jobs) => {
    for (const { data } of jobs) {
      const result = await syncSetPrices({ db, provider, setId: data.setId });
      console.log(`[${SYNC_SET_PRICES}] ${describeSetPrices(data.setId, result)}`);
      const alerts = await evaluateAlerts(db, { setId: data.setId });
      if (alerts.triggered > 0) await boss.send(DELIVER_NOTIFICATIONS, {});
      console.log(
        `[${SYNC_SET_PRICES}] alerts: ${alerts.triggered} triggered, ${alerts.rearmed} re-armed`,
      );
      if (result.status === "succeeded") await syncImages(data.setId);
    }
  },
);

console.log(
  `[worker] started (plan ${config.justTcgPlan}, games ${config.enabledGames.join(", ")})`,
);

let stopping: Promise<void> | undefined;
function shutdown(signal: NodeJS.Signals): void {
  stopping ??= (async () => {
    console.log(`[worker] ${signal} received, stopping`);
    await boss.stop({ graceful: true, timeout: 30_000 });
    await services.close();
  })().catch((error: unknown) => {
    console.error("[worker] shutdown failed", error);
    process.exitCode = 1;
  });
}
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
