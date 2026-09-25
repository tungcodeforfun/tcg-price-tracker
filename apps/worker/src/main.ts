import { PgBoss } from "pg-boss";
import { loadConfig } from "./config.ts";
import { describeCatalog, describeDueSets, describeSetPrices } from "./report.ts";
import { createServices, setsDueForPrices } from "./services.ts";
import { syncCatalog } from "./sync/catalog.ts";
import { syncSetPrices } from "./sync/set-prices.ts";

const SYNC_CATALOG = "sync-catalog";
const SYNC_PRICES = "sync-prices";
const SYNC_SET_PRICES = "sync-set-prices";

interface SetPricesJob {
  setId: string;
}

const config = loadConfig();
const services = createServices(config);
const { db, provider } = services;

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
await boss.schedule(SYNC_PRICES, "0 5 * * *", null, { tz: "UTC" });

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

// One set at a time keeps request pacing and quota checks serial.
await boss.work<SetPricesJob>(
  SYNC_SET_PRICES,
  { batchSize: 1, localConcurrency: 1 },
  async (jobs) => {
    for (const { data } of jobs) {
      const result = await syncSetPrices({ db, provider, setId: data.setId });
      console.log(`[${SYNC_SET_PRICES}] ${describeSetPrices(data.setId, result)}`);
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
