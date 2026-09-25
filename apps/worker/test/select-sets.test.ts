import { games, sets } from "@tcg/db";
import { createTestDb, truncateAll } from "@tcg/db/testing";
import type { ProviderUsage } from "@tcg/pricing";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { remainingDailyRequests, selectSetsToSync } from "../src/sync/select-sets.ts";

const { db, close } = await createTestDb();
afterAll(close);

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
      cardsCount: 10,
      pricesSyncedAt: new Date("2026-09-01"),
    },
    { id: "never", gameId: "pokemon", name: "Never", cardsCount: 40, pricesSyncedAt: null },
    {
      id: "august",
      gameId: "pokemon",
      name: "August",
      cardsCount: 100,
      pricesSyncedAt: new Date("2026-08-01"),
    },
    {
      id: "disabled-game",
      gameId: "yugioh",
      name: "Disabled",
      cardsCount: 5,
      pricesSyncedAt: null,
    },
  ]);
});

const select = async (params: {
  plan: "free" | "starter";
  allowlist?: string[];
  dailyBudget?: number;
}) =>
  (
    await selectSetsToSync({
      db,
      plan: params.plan,
      allowlist: params.allowlist ?? [],
      cardsPerRequest: 20,
      dailyBudget: params.dailyBudget ?? 1000,
    })
  ).map((set) => set.id);

describe("selectSetsToSync", () => {
  it("syncs nothing on the free plan without an allowlist", async () => {
    expect(await select({ plan: "free" })).toEqual([]);
  });

  it("syncs only allowlisted sets on the free plan, stalest first", async () => {
    expect(await select({ plan: "free", allowlist: ["september", "never", "unknown"] })).toEqual([
      "never",
      "september",
    ]);
  });

  it("syncs every set of an enabled game on paid plans, never-synced first then oldest", async () => {
    expect(await select({ plan: "starter", allowlist: ["september"] })).toEqual([
      "never",
      "august",
      "september",
    ]);
  });

  it("stops at the first set that would overrun the budget", async () => {
    expect(await select({ plan: "starter", dailyBudget: 7 })).toEqual(["never", "august"]);
    expect(await select({ plan: "starter", dailyBudget: 6 })).toEqual(["never"]);
    expect(await select({ plan: "starter", dailyBudget: 1 })).toEqual([]);
  });

  it("counts an empty set as the one request that finds it empty", async () => {
    await db.insert(sets).values({ id: "empty", gameId: "pokemon", name: "Empty", cardsCount: 0 });
    expect(await select({ plan: "starter", dailyBudget: 2 })).toEqual(["empty"]);
  });
});

describe("remainingDailyRequests", () => {
  const now = new Date("2026-09-25T05:00:00Z");
  const usage = (dailyUsed: number, reportedAt: string): ProviderUsage => ({
    plan: "Starter",
    monthlyLimit: 10_000,
    monthlyUsed: 2_000,
    dailyLimit: 1000,
    dailyUsed,
    perMinuteLimit: 50,
    reportedAt: new Date(reportedAt),
  });

  it("assumes the plan's daily quota minus the reserve before any usage is reported", () => {
    expect(remainingDailyRequests(null, "free", now)).toBe(95);
    expect(remainingDailyRequests(null, "enterprise", now)).toBe(49_995);
  });

  it("subtracts today's reported usage and the reserve", () => {
    expect(remainingDailyRequests(usage(400, "2026-09-25T03:00:00Z"), "starter", now)).toBe(595);
    expect(remainingDailyRequests(usage(999, "2026-09-25T03:00:00Z"), "starter", now)).toBe(0);
  });

  it("treats usage reported on an earlier UTC day as reset", () => {
    expect(remainingDailyRequests(usage(990, "2026-09-24T23:59:00Z"), "starter", now)).toBe(995);
  });
});
