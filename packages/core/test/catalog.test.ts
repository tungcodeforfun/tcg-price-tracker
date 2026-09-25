import { randomUUID } from "node:crypto";
import { cards, games, sets, variants, type Db } from "@tcg/db";
import { createTestDb, truncateAll } from "@tcg/db/testing";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  defaultVariant,
  getCard,
  getGame,
  getHomeHighlights,
  getSet,
  listGames,
  searchCards,
} from "../src/catalog.ts";

let db: Db;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});
afterAll(() => close());

interface VariantSeed {
  condition: string;
  printing?: string;
  priceCents: number | null;
}

async function seedCard(name: string, variantSeeds: VariantSeed[], setId = "base-set") {
  const [set] = await db
    .select()
    .from(sets)
    .where(sql`${sets.id} = ${setId}`);
  const id = randomUUID();
  await db.insert(cards).values({
    id,
    slug: `${setId}-${name.toLowerCase().replace(/\W+/g, "-")}-${id.slice(0, 4)}`,
    gameId: set!.gameId,
    setId,
    name,
  });
  if (variantSeeds.length) {
    await db.insert(variants).values(
      variantSeeds.map((v) => ({
        id: randomUUID(),
        cardId: id,
        condition: v.condition,
        printing: v.printing ?? "Normal",
        language: "English",
        priceCents: v.priceCents,
      })),
    );
  }
  return id;
}

const nm = (priceCents: number | null): VariantSeed[] => [{ condition: "Near Mint", priceCents }];

beforeEach(async () => {
  await truncateAll(db);
  await db.insert(games).values([
    { id: "pokemon", name: "Pokemon", enabled: true },
    { id: "one-piece", name: "One Piece", enabled: true },
    { id: "yugioh", name: "Yu-Gi-Oh!", enabled: false },
  ]);
  const synced = new Date("2026-09-01T00:00:00Z");
  await db.insert(sets).values([
    { id: "base-set", gameId: "pokemon", name: "Base Set", pricesSyncedAt: synced },
    { id: "unsynced-set", gameId: "pokemon", name: "Future Set" },
    { id: "op-01", gameId: "one-piece", name: "Romance Dawn", pricesSyncedAt: synced },
    { id: "lob", gameId: "yugioh", name: "Legend of Blue Eyes", pricesSyncedAt: synced },
  ]);
});

describe("searchCards", () => {
  it("ranks an exact name first, then prefix matches, then substring matches", async () => {
    await seedCard("Raichu with Pikachu", nm(100));
    await seedCard("Pikachu Illustrator", nm(100));
    await seedCard("Pikachu", nm(100));
    const { cards: found } = await searchCards(db, { query: "pikachu" });
    expect(found.map((c) => c.name)).toEqual([
      "Pikachu",
      "Pikachu Illustrator",
      "Raichu with Pikachu",
    ]);
  });

  it("tolerates a typo", async () => {
    await seedCard("Charizard", nm(100));
    const { cards: found } = await searchCards(db, { query: "charizrd" });
    expect(found.map((c) => c.name)).toEqual(["Charizard"]);
  });

  it("treats LIKE wildcards in the query literally", async () => {
    await seedCard("1000 Energy", nm(100));
    await seedCard("100% Energy", nm(100));
    const { cards: found } = await searchCards(db, { query: "00%" });
    expect(found.map((c) => c.name)).toEqual(["100% Energy"]);
  });

  it("filters by game and never returns cards from disabled games", async () => {
    await seedCard("Dragon Shenron", nm(100));
    await seedCard("Dragon Luffy", nm(100), "op-01");
    await seedCard("Blue-Eyes White Dragon", nm(100), "lob");
    const all = await searchCards(db, { query: "dragon" });
    expect(all.cards.map((c) => c.name).sort()).toEqual(["Dragon Luffy", "Dragon Shenron"]);
    const onePiece = await searchCards(db, { query: "dragon", gameId: "one-piece" });
    expect(onePiece.cards.map((c) => c.name)).toEqual(["Dragon Luffy"]);
  });

  it("sorts by price with unpriced cards last", async () => {
    await seedCard("Mew A", nm(500));
    await seedCard("Mew B", nm(null));
    await seedCard("Mew C", nm(9000));
    const desc = await searchCards(db, { query: "mew", sort: "price-desc" });
    expect(desc.cards.map((c) => c.name)).toEqual(["Mew C", "Mew A", "Mew B"]);
    const asc = await searchCards(db, { query: "mew", sort: "price-asc" });
    expect(asc.cards.map((c) => c.name)).toEqual(["Mew A", "Mew C", "Mew B"]);
  });

  it("pages with hasMore", async () => {
    for (const n of ["A", "B", "C"]) await seedCard(`Eevee ${n}`, nm(100));
    const first = await searchCards(db, { query: "eevee", sort: "name", limit: 2 });
    expect(first).toMatchObject({ hasMore: true });
    const second = await searchCards(db, { query: "eevee", sort: "name", limit: 2, offset: 2 });
    expect(second.cards.map((c) => c.name)).toEqual(["Eevee C"]);
    expect(second.hasMore).toBe(false);
  });

  it("ignores queries shorter than three characters, which the trigram index can't serve", async () => {
    await seedCard("Mu", nm(100));
    expect((await searchCards(db, { query: " mu " })).cards).toEqual([]);
  });
});

describe("headline price", () => {
  it("is the cheapest Near Mint or Sealed variant, ignoring played conditions", async () => {
    await seedCard("Gengar", [
      { condition: "Near Mint", printing: "Holofoil", priceCents: 4000 },
      { condition: "Near Mint", printing: "Normal", priceCents: 1500 },
      { condition: "Lightly Played", printing: "Normal", priceCents: 900 },
    ]);
    await seedCard("Booster Box", [{ condition: "Sealed", priceCents: 12000 }]);
    await seedCard("Only Played", [{ condition: "Damaged", priceCents: 50 }]);
    const { cards: found } = await getSet(db, "base-set").then((s) => s!);
    const prices = Object.fromEntries(found.map((c) => [c.name, c.priceCents]));
    expect(prices).toEqual({ Gengar: 1500, "Booster Box": 12000, "Only Played": null });
  });
});

describe("public catalog visibility", () => {
  it("hides sets that have never had prices synced", async () => {
    const game = await getGame(db, "pokemon");
    expect(game?.sets.map((s) => s.id)).toEqual(["base-set"]);
    expect(await getSet(db, "unsynced-set")).toBeNull();
    expect(await listGames(db)).toEqual([
      { id: "one-piece", name: "One Piece", setsCount: 1 },
      { id: "pokemon", name: "Pokemon", setsCount: 1 },
    ]);
  });

  it("hides disabled games and their cards", async () => {
    const id = await seedCard("Dark Magician", nm(100), "lob");
    const [card] = await db
      .select()
      .from(cards)
      .where(sql`${cards.id} = ${id}`);
    expect(await getGame(db, "yugioh")).toBeNull();
    expect(await getCard(db, card!.slug)).toBeNull();
  });
});

describe("card variants", () => {
  it("orders variants by printing then condition, and defaults to the cheapest Near Mint", async () => {
    const id = await seedCard("Snorlax", [
      { condition: "Damaged", printing: "Normal", priceCents: 100 },
      { condition: "Near Mint", printing: "Reverse Holofoil", priceCents: 700 },
      { condition: "Lightly Played", printing: "Normal", priceCents: 300 },
      { condition: "Near Mint", printing: "Normal", priceCents: 400 },
    ]);
    const [row] = await db
      .select()
      .from(cards)
      .where(sql`${cards.id} = ${id}`);
    const card = await getCard(db, row!.slug);
    expect(card?.variants.map((v) => `${v.printing}/${v.condition}`)).toEqual([
      "Normal/Near Mint",
      "Normal/Lightly Played",
      "Normal/Damaged",
      "Reverse Holofoil/Near Mint",
    ]);
    expect(defaultVariant(card!.variants)).toMatchObject({ printing: "Normal", priceCents: 400 });
  });
});

describe("getHomeHighlights", () => {
  it("counts only public data and ranks movers by absolute Near Mint/Sealed change", async () => {
    const cardWith = async (
      name: string,
      setId: string,
      seeds: (VariantSeed & { change?: number })[],
    ) => {
      const id = await seedCard(
        name,
        seeds.map((v) => ({
          condition: v.condition,
          printing: v.printing,
          priceCents: v.priceCents,
        })),
        setId,
      );
      for (const seed of seeds) {
        if (seed.change === undefined) continue;
        await db.execute(
          sql`update variants set price_change_7d_pct = ${seed.change}
              where card_id = ${id} and condition = ${seed.condition}`,
        );
      }
    };
    await cardWith("Riser", "base-set", [{ condition: "Near Mint", priceCents: 100, change: 12 }]);
    await cardWith("Faller", "op-01", [{ condition: "Near Mint", priceCents: 9000, change: -30 }]);
    await cardWith("Played only", "base-set", [
      { condition: "Damaged", priceCents: 50, change: 80 },
    ]);
    await cardWith("Flat", "base-set", [{ condition: "Near Mint", priceCents: 500, change: 0 }]);
    await cardWith("Hidden", "lob", [{ condition: "Near Mint", priceCents: 99999, change: 90 }]);

    const highlights = await getHomeHighlights(db);
    expect(highlights.counts).toEqual({ games: 2, sets: 2, cards: 4 });
    expect(highlights.topCards.map((c) => c.name)).toEqual([
      "Faller",
      "Flat",
      "Riser",
      "Played only",
    ]);
    expect(highlights.movers.map((m) => [m.name, m.change7dPct])).toEqual([
      ["Faller", -30],
      ["Riser", 12],
    ]);
  });
});
