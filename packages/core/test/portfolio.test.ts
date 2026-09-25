import { randomUUID } from "node:crypto";
import { cards, collectionItems, games, sets, users, variants, type Db } from "@tcg/db";
import { createTestDb, truncateAll } from "@tcg/db/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  InsufficientQuantityError,
  ValidationError,
  addLot,
  deleteLot,
  deleteSale,
  getHolding,
  getPortfolioHistory,
  getPortfolioSummary,
  listHoldings,
  listSales,
  sellFromLot,
  snapshotPortfolios,
  updateLot,
} from "../src/portfolio.ts";

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => {
  ({ db, close } = await createTestDb());
});
afterAll(() => close());

const ALICE = "alice";
const BOB = "bob";
let pricedVariant: string;
let unpricedVariant: string;

async function variantPriced(priceCents: number | null): Promise<string> {
  const cardId = randomUUID();
  await db
    .insert(cards)
    .values({ id: cardId, slug: `card-${cardId}`, gameId: "pokemon", setId: "base", name: "Card" });
  const id = randomUUID();
  await db.insert(variants).values({
    id,
    cardId,
    condition: "Near Mint",
    printing: "Normal",
    language: "English",
    priceCents,
  });
  return id;
}

const lot = (quantity: number, unitCostCents: number | null) => ({
  quantity,
  unitCostCents,
  acquiredOn: "2026-01-15",
  notes: null,
});
const sale = (quantity: number, unitPriceCents: number, feesCents = 0) => ({
  quantity,
  unitPriceCents,
  feesCents,
  soldOn: "2026-09-01",
  notes: null,
});

beforeEach(async () => {
  await truncateAll(db);
  await db.insert(users).values([
    { id: ALICE, name: "Alice", email: "alice@example.com" },
    { id: BOB, name: "Bob", email: "bob@example.com" },
  ]);
  await db.insert(games).values({ id: "pokemon", name: "Pokemon", enabled: true });
  await db.insert(sets).values({ id: "base", gameId: "pokemon", name: "Base Set" });
  pricedVariant = await variantPriced(1500);
  unpricedVariant = await variantPriced(null);
});

describe("P&L", () => {
  it("values a lot at market price and computes unrealized P&L", async () => {
    await addLot(db, ALICE, pricedVariant, lot(3, 1000));
    expect(await getPortfolioSummary(db, ALICE)).toMatchObject({
      valueCents: 4500,
      costBasisCents: 3000,
      unrealizedCents: 1500,
      realizedCents: 0,
      cardCount: 3,
    });
  });

  it("partial sell realizes P&L from the lot's cost, net of fees, and shrinks the lot", async () => {
    const itemId = await addLot(db, ALICE, pricedVariant, lot(3, 1000));
    const result = await sellFromLot(db, ALICE, itemId, sale(1, 2000, 100));
    expect(result).toMatchObject({ quantity: 1, costBasisCents: 1000, realizedCents: 900 });
    expect((await getHolding(db, ALICE, itemId))?.quantity).toBe(2);
    expect(await getPortfolioSummary(db, ALICE)).toMatchObject({
      valueCents: 3000,
      costBasisCents: 2000,
      unrealizedCents: 1000,
      realizedCents: 900,
    });
  });

  it("selling the whole lot removes it but keeps the sale", async () => {
    const itemId = await addLot(db, ALICE, pricedVariant, lot(2, 1000));
    await sellFromLot(db, ALICE, itemId, sale(2, 500));
    expect(await getHolding(db, ALICE, itemId)).toBeNull();
    expect((await listSales(db, ALICE)).map((s) => s.realizedCents)).toEqual([-1000]);
  });

  it("rejects overselling without changing anything", async () => {
    const itemId = await addLot(db, ALICE, pricedVariant, lot(2, 1000));
    await expect(sellFromLot(db, ALICE, itemId, sale(3, 500))).rejects.toThrow(
      InsufficientQuantityError,
    );
    expect((await getHolding(db, ALICE, itemId))?.quantity).toBe(2);
    expect(await listSales(db, ALICE)).toEqual([]);
  });

  it("zero-cost lots count fully as profit", async () => {
    const itemId = await addLot(db, ALICE, pricedVariant, lot(2, 0));
    await sellFromLot(db, ALICE, itemId, sale(1, 1200, 200));
    expect(await getPortfolioSummary(db, ALICE)).toMatchObject({
      costBasisCents: 0,
      unrealizedCents: 1500,
      realizedCents: 1000,
      unknownCostLots: 0,
    });
  });

  it("excludes lots with unknown cost from cost basis and both P&L figures", async () => {
    await addLot(db, ALICE, pricedVariant, lot(1, 1000));
    const unknown = await addLot(db, ALICE, pricedVariant, lot(2, null));
    const sold = await sellFromLot(db, ALICE, unknown, sale(1, 5000));
    expect(sold).toMatchObject({ costBasisCents: null, realizedCents: null });
    expect(await getPortfolioSummary(db, ALICE)).toMatchObject({
      valueCents: 3000,
      costBasisCents: 1000,
      unrealizedCents: 500,
      realizedCents: 0,
      unknownCostLots: 1,
    });
  });

  it("excludes unpriced variants from value and unrealized P&L", async () => {
    await addLot(db, ALICE, unpricedVariant, lot(4, 1000));
    await addLot(db, ALICE, pricedVariant, lot(1, 1000));
    expect(await getPortfolioSummary(db, ALICE)).toMatchObject({
      valueCents: 1500,
      costBasisCents: 5000,
      unrealizedCents: 500,
      unpricedLots: 1,
    });
    const [first, second] = await listHoldings(db, ALICE);
    expect([first?.valueCents, second?.valueCents]).toEqual([1500, null]);
  });

  it("totals beyond 32-bit integers without overflow", async () => {
    const expensive = await variantPriced(100_000_000);
    await addLot(db, ALICE, expensive, lot(100_000, 0));
    expect((await getPortfolioSummary(db, ALICE)).valueCents).toBe(10_000_000_000_000);
  });

  it("has an all-zero summary for an empty portfolio", async () => {
    expect(await getPortfolioSummary(db, ALICE)).toEqual({
      valueCents: 0,
      costBasisCents: 0,
      unrealizedCents: 0,
      realizedCents: 0,
      cardCount: 0,
      unpricedLots: 0,
      unknownCostLots: 0,
    });
  });
});

describe("ownership", () => {
  it("never lets one user read, change, sell or delete another user's lots and sales", async () => {
    const itemId = await addLot(db, ALICE, pricedVariant, lot(2, 1000));
    const aliceSale = await sellFromLot(db, ALICE, itemId, sale(1, 2000));
    expect(await getHolding(db, BOB, itemId)).toBeNull();
    expect(await updateLot(db, BOB, itemId, lot(99, 0))).toBe(false);
    expect(await sellFromLot(db, BOB, itemId, sale(1, 1))).toBeNull();
    expect(await deleteLot(db, BOB, itemId)).toBe(false);
    expect(await deleteSale(db, BOB, aliceSale!.id)).toBe(false);
    expect(await listHoldings(db, BOB)).toEqual([]);
    expect(await getHolding(db, ALICE, itemId)).toMatchObject({ quantity: 1, unitCostCents: 1000 });
    expect(await listSales(db, ALICE)).toHaveLength(1);
  });
});

describe("malformed ids", () => {
  it("treat a non-UUID id as not found instead of failing the query", async () => {
    await expect(getHolding(db, ALICE, "abc")).resolves.toBeNull();
    await expect(updateLot(db, ALICE, "abc", lot(1, 0))).resolves.toBe(false);
    await expect(deleteLot(db, ALICE, "")).resolves.toBe(false);
    await expect(sellFromLot(db, ALICE, "abc", sale(1, 1))).resolves.toBeNull();
    await expect(deleteSale(db, ALICE, "abc")).resolves.toBe(false);
    await expect(addLot(db, ALICE, "not-a-uuid", lot(1, 0))).rejects.toThrow(ValidationError);
  });
});

describe("validation", () => {
  it.each([
    ["zero quantity", lot(0, 100)],
    ["fractional quantity", lot(1.5, 100)],
    ["negative cost", lot(1, -1)],
    ["impossible date", { ...lot(1, 100), acquiredOn: "2026-02-30" }],
    ["overlong notes", { ...lot(1, 100), notes: "x".repeat(501) }],
  ])("rejects %s", async (_, input) => {
    await expect(addLot(db, ALICE, pricedVariant, input)).rejects.toThrow(ValidationError);
  });

  it("rejects an unknown variant", async () => {
    await expect(addLot(db, ALICE, randomUUID(), lot(1, 100))).rejects.toThrow(ValidationError);
  });

  it("stores blank notes as null", async () => {
    const itemId = await addLot(db, ALICE, pricedVariant, { ...lot(1, 100), notes: "   " });
    expect((await getHolding(db, ALICE, itemId))?.notes).toBeNull();
  });
});

describe("portfolio snapshots", () => {
  it("writes one row per user with lots, and rewriting the same day overwrites it", async () => {
    await addLot(db, ALICE, pricedVariant, lot(2, 1000));
    expect(await snapshotPortfolios(db, "2026-09-24")).toBe(1);
    await addLot(db, ALICE, pricedVariant, lot(1, 1000));
    await snapshotPortfolios(db, "2026-09-24");
    await snapshotPortfolios(db, "2026-09-25");
    const now = new Date("2026-09-25T12:00:00Z");
    expect(await getPortfolioHistory(db, ALICE, 30, now)).toEqual([
      { day: "2026-09-24", valueCents: 4500 },
      { day: "2026-09-25", valueCents: 4500 },
    ]);
    expect(await getPortfolioHistory(db, BOB, 30, now)).toEqual([]);
    const lots = await db.select().from(collectionItems);
    expect(lots).toHaveLength(2);
  });
});
