import { cards, games, pricePoints, sets, syncRuns, variants } from "@tcg/db";
import { createTestDb, truncateAll } from "@tcg/db/testing";
import { JustTcgError, QuotaExhaustedError } from "@tcg/pricing";
import { and, count, eq } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { syncSetPrices } from "../src/sync/set-prices.ts";
import { FakeProvider, MCD_2014 } from "./fake-provider.ts";

const { db, close } = await createTestDb();
afterAll(close);

beforeEach(async () => {
  await truncateAll(db);
  await db.insert(games).values({ id: "pokemon", name: "Pokemon", enabled: true });
  await db
    .insert(sets)
    .values({ id: MCD_2014, gameId: "pokemon", name: "McDonald's Promos 2014", cardsCount: 12 });
});

const rowCount = async (table: PgTable) => (await db.select({ n: count() }).from(table))[0]!.n;

const pricesSyncedAt = async () =>
  (await db.select({ at: sets.pricesSyncedAt }).from(sets).where(eq(sets.id, MCD_2014)))[0]!.at;

const quotaError = () =>
  new QuotaExhaustedError("JustTCG daily quota reserve reached", {
    plan: "Free Tier",
    monthlyLimit: 1000,
    monthlyUsed: 100,
    dailyLimit: 100,
    dailyUsed: 95,
    perMinuteLimit: 10,
    reportedAt: new Date(),
  });

describe("syncSetPrices", () => {
  it("persists the set's cards, variants and one price point per variant per day", async () => {
    const provider = new FakeProvider();

    const result = await syncSetPrices({ db, provider, setId: MCD_2014 });

    expect(result).toMatchObject({
      status: "succeeded",
      requests: 1,
      cardsUpserted: 12,
      variantsUpserted: 60,
    });
    expect(await rowCount(cards)).toBe(12);
    expect(await rowCount(variants)).toBe(60);
    // Seven history days per variant; the current price lands on the last of them.
    expect(await rowCount(pricePoints)).toBe(60 * 7);

    const [card] = await db
      .select()
      .from(cards)
      .where(eq(cards.slug, "pokemon-mcdonald-s-promos-2014-pikachu-5-12-promo"));
    expect(card).toMatchObject({
      id: "bb155dcc-5741-5f15-b6da-923e7a1044fe",
      gameId: "pokemon",
      setId: MCD_2014,
    });
    const [variant] = await db
      .select()
      .from(variants)
      .where(eq(variants.id, "3675f55e-9d52-50c3-b3f7-3526a86c6434"));
    expect(variant).toMatchObject({ cardId: card!.id, priceCents: 4277, priceChange7dPct: 1.21 });
    expect(variant!.priceUpdatedAt).toEqual(new Date(1790301652 * 1000));

    expect(await pricesSyncedAt()).toBeInstanceOf(Date);
    const [run] = await db.select().from(syncRuns);
    expect(run).toMatchObject({
      kind: "set-prices",
      target: MCD_2014,
      status: "succeeded",
      requests: 1,
      cardsUpserted: 12,
      variantsUpserted: 60,
      error: null,
    });
    expect(run!.finishedAt).toBeInstanceOf(Date);
  });

  it("is idempotent on re-run and lets the latest price overwrite its day", async () => {
    const provider = new FakeProvider();
    await syncSetPrices({ db, provider, setId: MCD_2014 });
    const pointsAfterFirstRun = await rowCount(pricePoints);

    const variantId = "3675f55e-9d52-50c3-b3f7-3526a86c6434";
    const changed = provider.cards[0]!.variants.find((variant) => variant.id === variantId)!;
    changed.priceCents = 5000;
    await syncSetPrices({ db, provider, setId: MCD_2014 });

    expect(await rowCount(cards)).toBe(12);
    expect(await rowCount(variants)).toBe(60);
    expect(await rowCount(pricePoints)).toBe(pointsAfterFirstRun);
    const [variant] = await db.select().from(variants).where(eq(variants.id, variantId));
    expect(variant!.priceCents).toBe(5000);
    const [point] = await db
      .select()
      .from(pricePoints)
      .where(and(eq(pricePoints.variantId, variantId), eq(pricePoints.day, "2026-09-25")));
    expect(point!.priceCents).toBe(5000);
    expect(await db.select().from(syncRuns)).toHaveLength(2);
  });

  it("pages through the set until the provider has no more cards", async () => {
    const provider = new FakeProvider({ cardsPerRequest: 5 });

    const result = await syncSetPrices({ db, provider, setId: MCD_2014 });

    expect(provider.offsetsRequested).toEqual([0, 5, 10]);
    expect(result).toMatchObject({
      status: "succeeded",
      requests: 3,
      cardsUpserted: 12,
      variantsUpserted: 60,
    });
    expect(await rowCount(cards)).toBe(12);
    expect(await pricesSyncedAt()).toBeInstanceOf(Date);
  });

  it("skips the run when the quota runs out mid-set, keeping the pages already written", async () => {
    const provider = new FakeProvider({ cardsPerRequest: 5 });
    provider.failAt = { offset: 5, error: quotaError() };

    const result = await syncSetPrices({ db, provider, setId: MCD_2014 });

    expect(result).toMatchObject({
      status: "skipped",
      requests: 1,
      cardsUpserted: 5,
      error: "JustTCG daily quota reserve reached",
    });
    expect(await rowCount(cards)).toBe(5);
    expect(await pricesSyncedAt()).toBeNull();
    const [run] = await db.select().from(syncRuns);
    expect(run).toMatchObject({
      status: "skipped",
      requests: 1,
      cardsUpserted: 5,
      error: "JustTCG daily quota reserve reached",
    });
  });

  it("fails the run and rethrows on any other provider error", async () => {
    const provider = new FakeProvider({ cardsPerRequest: 5 });
    provider.failAt = {
      offset: 5,
      error: new JustTcgError("Internal server error", 500, "INTERNAL"),
    };

    await expect(syncSetPrices({ db, provider, setId: MCD_2014 })).rejects.toThrow(
      "Internal server error",
    );

    expect(await rowCount(cards)).toBe(5);
    expect(await pricesSyncedAt()).toBeNull();
    const [run] = await db.select().from(syncRuns);
    expect(run).toMatchObject({ status: "failed", error: "Internal server error" });
    expect(run!.finishedAt).toBeInstanceOf(Date);
  });
});
