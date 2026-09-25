import { evaluateAlerts, snapshotPortfolios } from "@tcg/core";
import { deliverAlertEmails } from "./alerts/run.ts";
import { loadConfig } from "./config.ts";
import { describeCatalog, describeDueSets, describeSetPrices } from "./report.ts";
import { createServices, setsDueForPrices, type Services } from "./services.ts";
import { syncCatalog } from "./sync/catalog.ts";
import { syncSetPrices } from "./sync/set-prices.ts";

const USAGE =
  "usage: pnpm --filter @tcg/worker sync <catalog | set <setId> | prices | snapshot | alerts>";

async function catalog({ config, db, provider }: Services): Promise<void> {
  console.log(
    describeCatalog(await syncCatalog({ db, provider, enabledGames: config.enabledGames })),
  );
}

async function setPrices({ db, provider }: Services, setId: string): Promise<void> {
  console.log(describeSetPrices(setId, await syncSetPrices({ db, provider, setId })));
}

/** Syncs every due set in turn, like the scheduled job, stopping once the quota runs out. */
async function prices(services: Services): Promise<void> {
  const due = await setsDueForPrices(services);
  console.log(describeDueSets(due));
  for (const set of due.sets) {
    try {
      const result = await syncSetPrices({
        db: services.db,
        provider: services.provider,
        setId: set.id,
      });
      console.log(describeSetPrices(set.id, result));
      if (result.status === "skipped") break;
    } catch (error) {
      console.error(`set ${set.id} failed:`, error);
      process.exitCode = 1;
    }
  }
}

async function snapshot({ db }: Services): Promise<void> {
  const day = new Date().toISOString().slice(0, 10);
  console.log(`snapshot ${day}: ${await snapshotPortfolios(db, day)} portfolios`);
}

/** Evaluates every active alert against current prices, then emails what fired. */
async function alerts(services: Services): Promise<void> {
  const evaluated = await evaluateAlerts(services.db);
  const delivered = await deliverAlertEmails(services);
  console.log(
    `alerts: ${evaluated.triggered} triggered, ${evaluated.rearmed} re-armed; emails sent ${delivered.sent}, retrying ${delivered.retrying}, failed ${delivered.failed}`,
  );
}

function parseCommand([command, setId]: string[]): ((services: Services) => Promise<void>) | null {
  if (command === "catalog") return catalog;
  if (command === "prices") return prices;
  if (command === "snapshot") return snapshot;
  if (command === "alerts") return alerts;
  if (command === "set" && setId) return (services) => setPrices(services, setId);
  return null;
}

const run = parseCommand(process.argv.slice(2));

if (!run) {
  console.error(USAGE);
  process.exitCode = 2;
} else {
  const services = createServices(loadConfig());
  try {
    await run(services);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await services.close();
  }
}
