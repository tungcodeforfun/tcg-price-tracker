import { games, sets, type Db } from "@tcg/db";
import type { JustTcgPlan, ProviderUsage } from "@tcg/pricing";
import { asc, eq, inArray, sql } from "drizzle-orm";

/** Daily request quota per plan, used until the provider has reported real usage. */
export const DAILY_REQUEST_LIMIT: Record<JustTcgPlan, number> = {
  free: 100,
  starter: 1000,
  professional: 5000,
  enterprise: 50_000,
};

/** Requests left unspent each day, matching the client's own daily reserve. */
const DAILY_RESERVE = 5;

const utcDay = (date: Date): string => date.toISOString().slice(0, 10);

/**
 * Requests the price sync may spend today. Usage reported on an earlier UTC day counts as reset,
 * the same way the JustTCG client treats it.
 */
export function remainingDailyRequests(
  usage: ProviderUsage | null,
  plan: JustTcgPlan,
  now: Date = new Date(),
): number {
  const dailyLimit = usage?.dailyLimit ?? DAILY_REQUEST_LIMIT[plan];
  const dailyUsed = usage && utcDay(usage.reportedAt) === utcDay(now) ? usage.dailyUsed : 0;
  return Math.max(0, dailyLimit - dailyUsed - DAILY_RESERVE);
}

export interface SetToSync {
  id: string;
  /** Card pages the sync will request. */
  requests: number;
}

/**
 * Picks the sets whose prices to sync, stalest first, until the next one would overrun
 * `dailyBudget`. The free plan only ever syncs the allowlisted sets; paid plans take any set of an
 * enabled game.
 */
export async function selectSetsToSync({
  db,
  plan,
  allowlist,
  cardsPerRequest,
  dailyBudget,
}: {
  db: Db;
  plan: JustTcgPlan;
  allowlist: string[];
  cardsPerRequest: number;
  dailyBudget: number;
}): Promise<SetToSync[]> {
  if (plan === "free" && allowlist.length === 0) return [];

  const candidates = await db
    .select({ id: sets.id, cardsCount: sets.cardsCount })
    .from(sets)
    .innerJoin(games, eq(games.id, sets.gameId))
    .where(plan === "free" ? inArray(sets.id, allowlist) : eq(games.enabled, true))
    .orderBy(sql`${sets.pricesSyncedAt} asc nulls first`, asc(sets.id));

  const selected: SetToSync[] = [];
  let spent = 0;
  for (const set of candidates) {
    // An empty set still costs the request that finds it empty.
    const requests = Math.max(1, Math.ceil(set.cardsCount / cardsPerRequest));
    if (spent + requests > dailyBudget) break;
    spent += requests;
    selected.push({ id: set.id, requests });
  }
  return selected;
}
