import { randomUUID } from "node:crypto";
import { cards, collectionItems, games, sets, users, variants, type Db } from "@tcg/db";
import { createTestDb, truncateAll } from "@tcg/db/testing";
import { parse } from "csv-parse/sync";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { exportHoldingsCsv, exportSalesCsv, importHoldingsCsv } from "../src/portfolio-csv.ts";
import { addLot, listHoldings, sellFromLot } from "../src/portfolio.ts";

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => {
  ({ db, close } = await createTestDb());
});
afterAll(() => close());

const ALICE = "alice";
const BOB = "bob";
const ids: Record<string, string> = {};

beforeEach(async () => {
  await truncateAll(db);
  await db.insert(users).values([
    { id: ALICE, name: "Alice", email: "alice@example.com" },
    { id: BOB, name: "Bob", email: "bob@example.com" },
  ]);
  await db.insert(games).values({ id: "pokemon", name: "Pokemon", enabled: true });
  await db.insert(sets).values({ id: "base1", gameId: "pokemon", name: "Base Set" });
  const pikachu = randomUUID();
  await db.insert(cards).values({
    id: pikachu,
    slug: "pikachu",
    gameId: "pokemon",
    setId: "base1",
    name: "Pikachu",
    number: "58/102",
  });
  const rows = [
    ["pikaNmNormal", "Near Mint", "Normal", "111"],
    ["pikaNmHolo", "Near Mint", "Holofoil", "222"],
    ["pikaLpNormal", "Lightly Played", "Normal", "333"],
  ] as const;
  for (const [key, condition, printing, sku] of rows) {
    ids[key] = randomUUID();
    await db.insert(variants).values({
      id: ids[key]!,
      cardId: pikachu,
      condition,
      printing,
      language: "English",
      tcgplayerSkuId: sku,
      priceCents: 1000,
    });
  }
});

const csv = (...lines: string[]) => lines.join("\n");

describe("importHoldingsCsv", () => {
  it("round-trips an export into another account", async () => {
    await addLot(db, ALICE, ids.pikaNmHolo!, {
      quantity: 2,
      unitCostCents: 1250,
      acquiredOn: "2026-03-01",
      notes: 'from "LGS", graded later',
    });
    await addLot(db, ALICE, ids.pikaLpNormal!, {
      quantity: 1,
      unitCostCents: null,
      acquiredOn: null,
      notes: null,
    });
    const result = await importHoldingsCsv(db, BOB, await exportHoldingsCsv(db, ALICE));
    expect(result).toEqual({ ok: true, imported: 2 });
    const pick = (h: Awaited<ReturnType<typeof listHoldings>>[number]) => [
      h.variantId,
      h.quantity,
      h.unitCostCents,
      h.acquiredOn,
      h.notes,
    ];
    expect((await listHoldings(db, BOB)).map(pick).sort()).toEqual(
      (await listHoldings(db, ALICE)).map(pick).sort(),
    );
  });

  it("resolves rows by TCGplayer SKU and by set name + number + condition + printing", async () => {
    const result = await importHoldingsCsv(
      db,
      ALICE,
      csv(
        "tcgplayer_sku_id,set,number,condition,printing,quantity,unit_cost",
        "333,,,,,1,2.00",
        ',base set,58/102,near mint,holofoil,3,"$1,000.00"',
      ),
    );
    expect(result).toEqual({ ok: true, imported: 2 });
    const holdings = await listHoldings(db, ALICE);
    expect(holdings.map((h) => [h.variantId, h.quantity, h.unitCostCents]).sort()).toEqual(
      [
        [ids.pikaLpNormal, 1, 200],
        [ids.pikaNmHolo, 3, 100000],
      ].sort(),
    );
  });

  it("asks for a printing when set + number + condition is ambiguous", async () => {
    const result = await importHoldingsCsv(
      db,
      ALICE,
      csv("set,number,condition,quantity", "base1,58/102,Near Mint,1"),
    );
    expect(result).toEqual({
      ok: false,
      errors: [{ line: 2, message: "Add a printing column: this card comes in Normal, Holofoil" }],
    });
  });

  it("imports nothing when any row is bad, reporting every bad line", async () => {
    const result = await importHoldingsCsv(
      db,
      ALICE,
      csv(
        "variant_id,quantity,unit_cost,acquired_on",
        `${ids.pikaNmNormal},1,5.00,2026-01-01`,
        `${randomUUID()},1,5.00,`,
        `${ids.pikaNmNormal},0,5.00,`,
        `${ids.pikaNmNormal},1,5.999,`,
        `${ids.pikaNmNormal},1,5.00,2026-13-01`,
      ),
    );
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors.map((e) => e.line)).toEqual([3, 4, 5, 6]);
    expect(await db.select().from(collectionItems)).toEqual([]);
  });

  it("reports the real file line when a quoted field spans lines", async () => {
    const result = await importHoldingsCsv(
      db,
      ALICE,
      csv(
        "variant_id,quantity,notes",
        `${ids.pikaNmNormal},1,"two`,
        `line note"`,
        `${ids.pikaNmNormal},0,`,
      ),
    );
    expect(!result.ok && result.errors.map((e) => e.line)).toEqual([4]);
  });

  it("uses a language column to pick between otherwise identical variants", async () => {
    const [card] = await db.select({ id: cards.id }).from(cards);
    const japanese = randomUUID();
    await db.insert(variants).values({
      id: japanese,
      cardId: card!.id,
      condition: "Lightly Played",
      printing: "Normal",
      language: "Japanese",
      priceCents: 900,
    });
    const header = "set,number,condition,language,quantity";
    expect(
      await importHoldingsCsv(db, ALICE, csv(header, "base1,58/102,Lightly Played,,1")),
    ).toEqual({
      ok: false,
      errors: [{ line: 2, message: "Add a language column: this card comes in English, Japanese" }],
    });
    expect(
      await importHoldingsCsv(db, ALICE, csv(header, "base1,58/102,Lightly Played,japanese,1")),
    ).toEqual({
      ok: true,
      imported: 1,
    });
    expect((await listHoldings(db, ALICE)).map((h) => h.variantId)).toEqual([japanese]);
  });

  it("rejects an empty file and one with no way to identify the card", async () => {
    expect(await importHoldingsCsv(db, ALICE, "variant_id,quantity\n")).toMatchObject({
      ok: false,
    });
    const result = await importHoldingsCsv(db, ALICE, csv("card,quantity", "Pikachu,1"));
    expect(!result.ok && result.errors[0]?.line).toBe(2);
  });
});

describe("exportSalesCsv", () => {
  it("writes proceeds, cost basis and realized P&L per sale", async () => {
    const itemId = await addLot(db, ALICE, ids.pikaNmNormal!, {
      quantity: 2,
      unitCostCents: 1000,
      acquiredOn: null,
      notes: null,
    });
    await sellFromLot(db, ALICE, itemId, {
      quantity: 2,
      unitPriceCents: 1500,
      feesCents: 250,
      soldOn: "2026-09-01",
      notes: null,
    });
    const [row] = parse(await exportSalesCsv(db, ALICE), { columns: true }) as Record<
      string,
      string
    >[];
    expect(row).toMatchObject({
      quantity: "2",
      unit_price: "15.00",
      fees: "2.50",
      proceeds: "27.50",
      cost_basis: "20.00",
      realized: "7.50",
    });
  });
});
