import { games, sets, syncRuns } from "@tcg/db";
import { createTestDb, truncateAll } from "@tcg/db/testing";
import { asc, eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { syncCatalog } from "../src/sync/catalog.ts";
import { FakeProvider, MCD_2014 } from "./fake-provider.ts";

const { db, close } = await createTestDb();
afterAll(close);
beforeEach(() => truncateAll(db));

const enabledGameIds = async () =>
  (
    await db
      .select({ id: games.id })
      .from(games)
      .where(eq(games.enabled, true))
      .orderBy(asc(games.id))
  ).map((game) => game.id);

describe("syncCatalog", () => {
  it("mirrors every game, enables only the configured ones and lists sets for those alone", async () => {
    const provider = new FakeProvider();

    const result = await syncCatalog({ db, provider, enabledGames: ["pokemon", "disney-lorcana"] });

    expect(result).toMatchObject({
      status: "succeeded",
      games: 20,
      enabledGames: 2,
      sets: 218,
      requests: 3,
    });
    expect(provider.setsRequested.sort()).toEqual(["disney-lorcana", "pokemon"]);
    expect(await db.select().from(games)).toHaveLength(20);
    expect(await enabledGameIds()).toEqual(["disney-lorcana", "pokemon"]);
    expect(await db.select().from(sets)).toHaveLength(218);
    const [set] = await db.select().from(sets).where(eq(sets.id, MCD_2014));
    expect(set).toMatchObject({
      gameId: "pokemon",
      releaseDate: "2014-05-23",
      cardsCount: 12,
      pricesSyncedAt: null,
    });
    const [run] = await db.select().from(syncRuns);
    expect(run).toMatchObject({ kind: "catalog", target: null, status: "succeeded", requests: 3 });
  });

  it("updates games and sets in place on re-sync, following config changes and keeping sync state", async () => {
    const provider = new FakeProvider();
    await syncCatalog({ db, provider, enabledGames: ["pokemon", "disney-lorcana"] });
    const syncedAt = new Date("2026-09-20T05:00:00Z");
    await db.update(sets).set({ pricesSyncedAt: syncedAt }).where(eq(sets.id, MCD_2014));

    const renamed = provider.setsByGame.pokemon!.find((set) => set.id === MCD_2014)!;
    renamed.name = "McDonald's Collection 2014";
    renamed.cardsCount = 13;
    await syncCatalog({ db, provider, enabledGames: ["pokemon"] });

    expect(await db.select().from(games)).toHaveLength(20);
    expect(await enabledGameIds()).toEqual(["pokemon"]);
    expect(await db.select().from(sets)).toHaveLength(218);
    const [set] = await db.select().from(sets).where(eq(sets.id, MCD_2014));
    expect(set).toMatchObject({
      name: "McDonald's Collection 2014",
      cardsCount: 13,
      pricesSyncedAt: syncedAt,
    });
  });
});
