import { createDb, type Db } from "@tcg/db";
import { JustTcgClient, type PriceProvider } from "@tcg/pricing";
import type { WorkerConfig } from "./config.ts";
import { remainingDailyRequests, selectSetsToSync, type SetToSync } from "./sync/select-sets.ts";
import { DrizzleUsageStore } from "./usage-store.ts";

export interface Services {
  config: WorkerConfig;
  db: Db;
  provider: PriceProvider;
  usageStore: DrizzleUsageStore;
  close(): Promise<void>;
}

export function createServices(config: WorkerConfig): Services {
  const { db, pool } = createDb(config.databaseUrl);
  const usageStore = new DrizzleUsageStore(db);
  const provider = new JustTcgClient({
    apiKey: config.justTcgApiKey,
    plan: config.justTcgPlan,
    usageStore,
  });
  return { config, db, provider, usageStore, close: () => pool.end() };
}

/** The sets whose prices fit in what is left of today's request budget, stalest first. */
export async function setsDueForPrices({
  config,
  db,
  provider,
  usageStore,
}: Services): Promise<{ dailyBudget: number; sets: SetToSync[] }> {
  const dailyBudget = remainingDailyRequests(await usageStore.load(), config.justTcgPlan);
  const sets = await selectSetsToSync({
    db,
    plan: config.justTcgPlan,
    allowlist: config.setAllowlist,
    cardsPerRequest: provider.cardsPerRequest,
    dailyBudget,
  });
  return { dailyBudget, sets };
}
