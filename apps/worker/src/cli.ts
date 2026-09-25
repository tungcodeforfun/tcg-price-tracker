import {
  createInviteCodes,
  disableInviteCode,
  evaluateAlerts,
  listInviteCodes,
  snapshotPortfolios,
  topPageViews,
} from "@tcg/core";
import { deliverAlertEmails } from "./alerts/run.ts";
import { loadConfig } from "./config.ts";
import {
  clearGameImages,
  createImageSources,
  describeSetImages,
  setsWithImageSource,
  syncSetImages,
} from "./images/sync.ts";
import { describeCatalog, describeDueSets, describeSetPrices } from "./report.ts";
import { createServices, setsDueForPrices, type Services } from "./services.ts";
import { syncCatalog } from "./sync/catalog.ts";
import { syncSetPrices } from "./sync/set-prices.ts";

const USAGE = `usage: pnpm --filter @tcg/worker sync <command>
  catalog | set <setId> | prices | due | snapshot | alerts
  images <setId> | images all | images clear <gameId>
  invites create <count> [maxUses] [note…] | invites list | invites disable <code>
  views [days]`;

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

/** Shows which sets the next price sync would pick, without calling the provider. */
async function due(services: Services): Promise<void> {
  const result = await setsDueForPrices(services);
  console.log(describeDueSets(result));
  for (const set of result.sets) console.log(`  ${set.id} (${set.requests} requests)`);
}

async function invites({ db, config }: Services, [action, ...args]: string[]): Promise<void> {
  if (action === "create") {
    const [count = "1", maxUses = "1", ...note] = args;
    const codes = await createInviteCodes(db, {
      count: Number(count),
      maxUses: Number(maxUses),
      note: note.join(" ") || null,
    });
    for (const code of codes) console.log(`${code}  ${config.appUrl}/signup?invite=${code}`);
  } else if (action === "list") {
    for (const c of await listInviteCodes(db)) {
      const status = c.disabledAt ? "disabled" : c.uses >= c.maxUses ? "used up" : "open";
      console.log(`${c.code}  ${c.uses}/${c.maxUses}  ${status}${c.note ? `  ${c.note}` : ""}`);
    }
  } else if (action === "disable" && args[0]) {
    console.log(
      (await disableInviteCode(db, args[0])) ? "disabled" : "no open code with that value",
    );
  } else {
    console.error(USAGE);
    process.exitCode = 2;
  }
}

async function views({ db }: Services, days: number): Promise<void> {
  const rows = await topPageViews(db, days);
  console.log(`top pages, last ${days} days:`);
  for (const row of rows) console.log(`${String(row.views).padStart(7)}  ${row.path}`);
}

/** Card images for one set, or `all` sets with cards in a game that has an image source. */
async function images({ config, db }: Services, target: string): Promise<void> {
  const sources = createImageSources({ disabledGames: config.imagesDisabledGames });
  const setIds = target === "all" ? await setsWithImageSource(db, sources) : [target];
  const started = performance.now();
  let requests = 0;
  for (const setId of setIds) {
    try {
      const result = await syncSetImages({ db, sources, setId });
      requests += result.requests;
      console.log(describeSetImages(setId, result));
    } catch (error) {
      console.error(`images ${setId} failed:`, error);
      process.exitCode = 1;
    }
  }
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  console.log(`images: ${setIds.length} sets, ${requests} requests, ${seconds}s`);
}

/** Kill switch: blanks the game's images; IMAGES_DISABLED_GAMES keeps syncs from refilling them. */
async function clearImages({ config, db }: Services, gameId: string): Promise<void> {
  console.log(`cleared images on ${await clearGameImages(db, gameId)} ${gameId} cards`);
  if (createImageSources({ disabledGames: config.imagesDisabledGames }).has(gameId)) {
    console.log(`add ${gameId} to IMAGES_DISABLED_GAMES, or the next price sync refills them`);
  }
}

function parseCommand([command, ...args]: string[]):
  ((services: Services) => Promise<void>) | null {
  const [setId, gameId] = args;
  if (command === "due") return due;
  if (command === "invites") return (services) => invites(services, args);
  if (command === "views") return (services) => views(services, Number(args[0] ?? 7) || 7);
  if (command === "catalog") return catalog;
  if (command === "prices") return prices;
  if (command === "snapshot") return snapshot;
  if (command === "alerts") return alerts;
  if (command === "set" && setId) return (services) => setPrices(services, setId);
  if (command === "images" && setId === "clear") {
    return gameId ? (services) => clearImages(services, gameId) : null;
  }
  if (command === "images" && setId) return (services) => images(services, setId);
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
