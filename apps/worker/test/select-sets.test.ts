import { games, sets } from "@tcg/db";
import { createTestDb, truncateAll } from "@tcg/db/testing";
import type { ProviderUsage } from "@tcg/pricing";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { requestBudget, selectSetsToSync } from "../src/sync/select-sets.ts";

const { db, close } = await createTestDb();
afterAll(close);

const now = new Date("2026-09-25T05:00:00Z");

beforeEach(async () => {
  await truncateAll(db);
  await db.insert(games).values([
    { id: "pokemon", name: "Pokemon", enabled: true },
    { id: "yugioh", name: "YuGiOh", enabled: false },
  ]);
  // At 20 cards per request: never-synced 2 requests, august 5, september 1.
  await db.insert(sets).values([
    {
      id: "september",
      gameId: "pokemon",
      name: "September",
      releaseDate: "2026-09-01",
      cardsCount: 10,
      pricesSyncedAt: new Date("2026-09-01"),
    },
    { id: "never", gameId: "pokemon", name: "Never", releaseDate: "2026-07-01", cardsCount: 40 },
    {
      id: "august",
      gameId: "pokemon",
      name: "August",
      releaseDate: "2026-08-01",
      cardsCount: 100,
      pricesSyncedAt: new Date("2026-08-01"),
    },
    {
      id: "disabled-game",
      gameId: "yugioh",
      name: "Disabled",
      releaseDate: "2026-09-10",
      cardsCount: 5,
    },
  ]);
});

const select = async (params: {
  plan: "free" | "starter";
  allowlist?: string[];
  newestPerGame?: number;
  minRefreshHours?: number;
  budget?: number;
}) =>
  (
    await selectSetsToSync({
      db,
      plan: params.plan,
      allowlist: params.allowlist ?? [],
      newestPerGame: params.newestPerGame ?? 3,
      minRefreshHours: params.minRefreshHours ?? 1,
      cardsPerRequest: 20,
      budget: params.budget ?? 1000,
      now,
    })
  ).map((set) => set.id);

describe("selectSetsToSync", () => {
  it("syncs only allowlisted sets on the free plan, stalest first", async () => {
    expect(await select({ plan: "free", allowlist: ["september", "never", "unknown"] })).toEqual([
      "never",
      "september",
    ]);
  });

  it("without an allowlist, the free plan syncs each enabled game's newest released sets with cards", async () => {
    await db.insert(sets).values([
      {
        id: "unreleased",
        gameId: "pokemon",
        name: "Next",
        releaseDate: "2026-11-06",
        cardsCount: 90,
      },
      {
        id: "no-cards",
        gameId: "pokemon",
        name: "Promo",
        releaseDate: "2026-09-20",
        cardsCount: 0,
      },
    ]);
    expect(await select({ plan: "free", newestPerGame: 2 })).toEqual(["august", "september"]);
  });

  it("syncs every set of an enabled game on paid plans, never-synced first then oldest", async () => {
    expect(await select({ plan: "starter", allowlist: ["september"] })).toEqual([
      "never",
      "august",
      "september",
    ]);
  });

  it("skips sets synced within the refresh interval", async () => {
    // september was synced 24 days before `now`, august 55 days before.
    expect(await select({ plan: "starter", minRefreshHours: 30 * 24 })).toEqual([
      "never",
      "august",
    ]);
  });

  it("skips a set that doesn't fit the budget and keeps filling with smaller ones", async () => {
    expect(await select({ plan: "starter", budget: 7 })).toEqual(["never", "august"]);
    expect(await select({ plan: "starter", budget: 6 })).toEqual(["never", "september"]);
    expect(await select({ plan: "starter", budget: 1 })).toEqual(["september"]);
  });

  it("counts an empty set as the one request that finds it empty", async () => {
    await db.insert(sets).values({ id: "empty", gameId: "pokemon", name: "Empty", cardsCount: 0 });
    expect(await select({ plan: "starter", budget: 2 })).toEqual(["empty", "september"]);
  });
});

describe("requestBudget", () => {
  const usage = (overrides: Partial<ProviderUsage>): ProviderUsage => ({
    plan: "Free Tier",
    monthlyLimit: 1_000,
    monthlyUsed: 0,
    dailyLimit: 100,
    dailyUsed: 0,
    perMinuteLimit: 10,
    reportedAt: new Date("2026-09-25T03:00:00Z"),
    ...overrides,
  });

  it("spreads the free tier's monthly quota over the rest of the month", () => {
    // Sept 25 → 6 days left including today: (1000 − 20 reserve) / 6 = 163, capped by 95 daily.
    expect(requestBudget(null, "free", now)).toBe(95);
    // After 800 used this month: (1000 − 800 − 20) / 6 = 30 per day.
    expect(requestBudget(usage({ monthlyUsed: 800 }), "free", now)).toBe(30);
    // On the 1st of a 30-day month with nothing used: (1000 − 20) / 30 = 32.
    expect(requestBudget(null, "free", new Date("2026-09-01T05:00:00Z"))).toBe(32);
  });

  it("is limited by today's remaining daily quota", () => {
    expect(requestBudget(usage({ dailyUsed: 90 }), "free", now)).toBe(5);
    expect(requestBudget(usage({ dailyUsed: 99 }), "free", now)).toBe(0);
  });

  it("treats usage reported on an earlier day or month as reset", () => {
    const lastMonth = usage({
      dailyUsed: 99,
      monthlyUsed: 990,
      reportedAt: new Date("2026-08-31T23:00:00Z"),
    });
    expect(requestBudget(lastMonth, "free", now)).toBe(95);
    const yesterday = usage({
      dailyUsed: 99,
      monthlyUsed: 800,
      reportedAt: new Date("2026-09-24T23:00:00Z"),
    });
    expect(requestBudget(yesterday, "free", now)).toBe(30);
  });

  it("never goes negative when the month is already over quota", () => {
    expect(requestBudget(usage({ monthlyUsed: 1_000 }), "free", now)).toBe(0);
  });
});
