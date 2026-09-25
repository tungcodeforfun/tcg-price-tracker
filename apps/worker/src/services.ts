import { createDb, type Db } from "@tcg/db";
import { createSmtpMailer, type Mailer } from "@tcg/email";
import { JustTcgClient, type PriceProvider } from "@tcg/pricing";
import type { WorkerConfig } from "./config.ts";
import { requestBudget, selectSetsToSync, type SetToSync } from "./sync/select-sets.ts";
import { DrizzleUsageStore } from "./usage-store.ts";

export interface Services {
  config: WorkerConfig;
  db: Db;
  provider: PriceProvider;
  usageStore: DrizzleUsageStore;
  mailer: Mailer;
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
  const mailer = createSmtpMailer({ url: config.smtpUrl, from: config.emailFrom });
  return { config, db, provider, usageStore, mailer, close: () => pool.end() };
}

/** The sets whose prices fit in what is left of today's request budget, stalest first. */
export async function setsDueForPrices({
  config,
  db,
  provider,
  usageStore,
}: Services): Promise<{ dailyBudget: number; sets: SetToSync[] }> {
  const dailyBudget = requestBudget(await usageStore.load(), config.justTcgPlan);
  const sets = await selectSetsToSync({
    db,
    plan: config.justTcgPlan,
    allowlist: config.setAllowlist,
    newestPerGame: config.newestSetsPerGame,
    minRefreshHours: config.minRefreshHours,
    cardsPerRequest: provider.cardsPerRequest,
    budget: dailyBudget,
  });
  return { dailyBudget, sets };
}
