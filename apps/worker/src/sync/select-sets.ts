import { games, sets, type Db } from "@tcg/db";
import type { JustTcgPlan, ProviderUsage } from "@tcg/pricing";
import { and, asc, eq, gt, inArray, isNull, lte, or, sql, type SQL } from "drizzle-orm";

/** Request quotas per plan, used until the provider has reported real usage. */
export const REQUEST_LIMITS: Record<JustTcgPlan, { daily: number; monthly: number }> = {
  free: { daily: 100, monthly: 1_000 },
  starter: { daily: 1_000, monthly: 10_000 },
  professional: { daily: 5_000, monthly: 50_000 },
  enterprise: { daily: 50_000, monthly: 500_000 },
};

/** Requests left unspent, matching the JustTCG client's own reserves. */
const DAILY_RESERVE = 5;
const MONTHLY_RESERVE = 20;

const utcDay = (date: Date): string => date.toISOString().slice(0, 10);
const utcMonth = (date: Date): string => date.toISOString().slice(0, 7);

/**
 * Requests the price sync may spend today: what's left of today's quota, capped so the monthly
 * quota is spread evenly over the rest of the month instead of being spent in the first days.
 * Usage reported on an earlier UTC day (or month) counts as reset, as the JustTCG client treats it.
 */
export function requestBudget(
  usage: ProviderUsage | null,
  plan: JustTcgPlan,
  now: Date = new Date(),
): number {
  const limits = REQUEST_LIMITS[plan];
  const dailyLimit = usage?.dailyLimit ?? limits.daily;
  const monthlyLimit = usage?.monthlyLimit ?? limits.monthly;
  const dailyUsed = usage && utcDay(usage.reportedAt) === utcDay(now) ? usage.dailyUsed : 0;
  const monthlyUsed = usage && utcMonth(usage.reportedAt) === utcMonth(now) ? usage.monthlyUsed : 0;
  const dailyLeft = dailyLimit - dailyUsed - DAILY_RESERVE;

  const daysInMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const daysLeft = daysInMonth - now.getUTCDate() + 1;
  const monthlyPace = Math.floor((monthlyLimit - monthlyUsed - MONTHLY_RESERVE) / daysLeft);
  return Math.max(0, Math.min(dailyLeft, monthlyPace));
}

export interface SetToSync {
  id: string;
  /** Card pages the sync will request. */
  requests: number;
}

export interface SelectSetsOptions {
  db: Db;
  plan: JustTcgPlan;
  /** Explicit set ids; when non-empty they are the only candidates on the free plan. */
  allowlist: string[];
  /** On the free plan without an allowlist: the newest released sets per enabled game. */
  newestPerGame: number;
  /** Sets synced more recently than this are skipped. */
  minRefreshHours: number;
  cardsPerRequest: number;
  budget: number;
  now?: Date;
}

/**
 * Picks the sets whose prices to sync, stalest first, skipping any set that doesn't fit what's
 * left of `budget` so one large set can't block the smaller ones behind it.
 */
export async function selectSetsToSync(options: SelectSetsOptions): Promise<SetToSync[]> {
  const now = options.now ?? new Date();
  const staleBefore = new Date(now.getTime() - options.minRefreshHours * 3_600_000);
  const due = or(isNull(sets.pricesSyncedAt), lte(sets.pricesSyncedAt, staleBefore))!;

  let scope: SQL;
  if (options.plan !== "free") {
    scope = eq(games.enabled, true);
  } else if (options.allowlist.length > 0) {
    scope = inArray(sets.id, options.allowlist);
  } else {
    const newest = await newestReleasedSets(options.db, options.newestPerGame, now);
    if (newest.length === 0) return [];
    scope = inArray(sets.id, newest);
  }

  const candidates = await options.db
    .select({ id: sets.id, cardsCount: sets.cardsCount })
    .from(sets)
    .innerJoin(games, eq(games.id, sets.gameId))
    .where(and(scope, due))
    .orderBy(sql`${sets.pricesSyncedAt} asc nulls first`, asc(sets.id));

  const selected: SetToSync[] = [];
  let spent = 0;
  for (const set of candidates) {
    // An empty set still costs the request that finds it empty.
    const requests = Math.max(1, Math.ceil(set.cardsCount / options.cardsPerRequest));
    if (spent + requests > options.budget) continue;
    spent += requests;
    selected.push({ id: set.id, requests });
  }
  return selected;
}

/** The `perGame` most recently released sets of each enabled game that have cards and are out. */
async function newestReleasedSets(db: Db, perGame: number, now: Date): Promise<string[]> {
  const ranked = db
    .select({
      id: sets.id,
      rank: sql<number>`row_number() over (partition by ${sets.gameId} order by ${sets.releaseDate} desc, ${sets.id})`.as(
        "rank",
      ),
    })
    .from(sets)
    .innerJoin(games, eq(games.id, sets.gameId))
    .where(and(eq(games.enabled, true), gt(sets.cardsCount, 0), lte(sets.releaseDate, utcDay(now))))
    .as("ranked");
  const rows = await db.select({ id: ranked.id }).from(ranked).where(lte(ranked.rank, perGame));
  return rows.map((row) => row.id);
}
