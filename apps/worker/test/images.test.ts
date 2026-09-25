import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { cards, games, sets } from "@tcg/db";
import { createTestDb, truncateAll } from "@tcg/db/testing";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Fetch } from "../src/images/http.ts";
import { clearGameImages, createImageSources, syncSetImages } from "../src/images/sync.ts";

const { db, close } = await createTestDb();
afterAll(close);

const TCGDEX = "https://api.tcgdex.net/v2/en";
const LORCAST = "https://api.lorcast.com/v0";
/** Recorded API responses (arrays trimmed to a few items), by request URL. */
const RESPONSES: Record<string, string> = {
  [`${TCGDEX}/sets`]: "tcgdex-sets.json",
  [`${TCGDEX}/sets/me05`]: "tcgdex-set-me05.json",
  [`${TCGDEX}/sets/30th`]: "tcgdex-set-30th.json",
  [`${TCGDEX}/cards/me05-001`]: "tcgdex-card-me05-001.json",
  [`${TCGDEX}/cards/me05-002`]: "tcgdex-card-me05-002.json",
  [`${TCGDEX}/cards/me05-100`]: "tcgdex-card-me05-100.json",
  [`${TCGDEX}/cards/30th-001`]: "tcgdex-card-30th-001.json",
  [`${TCGDEX}/cards/30th-002`]: "tcgdex-card-30th-002.json",
  [`${LORCAST}/sets`]: "lorcast-sets.json",
  [`${LORCAST}/sets/set_57c6817823c14dda8eccbca4b555d858/cards`]: "lorcast-set-13-cards.json",
};

const fakeFetch: Fetch = async (url) => {
  const name = RESPONSES[url];
  if (!name) return new Response("not found", { status: 404 });
  const body = readFileSync(new URL(`./fixtures/images/${name}`, import.meta.url), "utf8");
  return new Response(body, { headers: { "content-type": "application/json" } });
};

const sources = (disabledGames: string[] = []) =>
  createImageSources({ fetch: fakeFetch, gapMs: 0, disabledGames });

const PITCH_BLACK = "me05-pitch-black-pokemon";
const VINE = "attack-of-the-vine-disney-lorcana";
const NOW = new Date("2026-09-25T12:00:00Z");
const daysAfter = (days: number) => new Date(NOW.getTime() + days * 86_400_000);

async function addSet(id: string, gameId: string, name: string, tcgplayerIds: string[]) {
  await db.insert(sets).values({ id, gameId, name });
  await db.insert(cards).values(
    tcgplayerIds.map((tcgplayerId) => ({
      id: randomUUID(),
      slug: `${id}-${tcgplayerId}`,
      gameId,
      setId: id,
      name: tcgplayerId,
      tcgplayerId,
    })),
  );
}

async function image(setId: string, tcgplayerId: string) {
  const [row] = await db
    .select({ url: cards.imageUrl, source: cards.imageSource, at: cards.imageUpdatedAt })
    .from(cards)
    .where(eq(cards.slug, `${setId}-${tcgplayerId}`));
  return row!;
}

beforeEach(async () => {
  await truncateAll(db);
  await db.insert(games).values([
    { id: "pokemon", name: "Pokemon", enabled: true },
    { id: "disney-lorcana", name: "Disney Lorcana", enabled: true },
    { id: "one-piece-card-game", name: "One Piece Card Game", enabled: true },
  ]);
  // Tropius, Grubbin, Rampardos ex, and a sealed booster box TCGdex doesn't list.
  await addSet(PITCH_BLACK, "pokemon", "ME05: Pitch Black", ["704758", "704759", "704857", "1"]);
  // Woody, Ming Lee, Isabela Madrigal.
  await addSet(VINE, "disney-lorcana", "Attack of the Vine!", ["702669", "702670", "704540"]);
});

describe("syncSetImages", () => {
  it("fills Pokémon images from TCGdex by TCGplayer id and leaves unmatched cards null", async () => {
    const result = await syncSetImages({ db, sources: sources(), setId: PITCH_BLACK, now: NOW });

    expect(result).toMatchObject({
      status: "synced",
      source: "tcgdex",
      sourceSetId: "me05",
      cards: 4,
      due: 4,
      matched: 3,
      updated: 3,
      unmatched: 1,
      // Set list, set, and one detail per card with an image.
      requests: 5,
    });
    expect(await image(PITCH_BLACK, "704758")).toEqual({
      url: "https://assets.tcgdex.net/en/me/me05/001/high.webp",
      source: "tcgdex",
      at: NOW,
    });
    expect(await image(PITCH_BLACK, "704857")).toMatchObject({
      url: "https://assets.tcgdex.net/en/me/me05/100/high.webp",
    });
    expect(await image(PITCH_BLACK, "1")).toEqual({ url: null, source: null, at: null });
  });

  it("fills Lorcana images from Lorcast, then skips the source while none is due", async () => {
    const lorcast = sources();
    const first = await syncSetImages({ db, sources: lorcast, setId: VINE, now: NOW });

    expect(first).toMatchObject({ status: "synced", source: "lorcast", matched: 3, updated: 3 });
    expect(first.requests).toBe(2);
    expect(await image(VINE, "702669")).toEqual({
      url: "https://cards.lorcast.io/card/digital/large/crd_1792f6aa4efe42ce93bd680da01f7016.avif?1783188235",
      source: "lorcast",
      at: NOW,
    });

    const again = await syncSetImages({ db, sources: lorcast, setId: VINE, now: daysAfter(1) });
    expect(again).toMatchObject({ status: "up-to-date", due: 0, requests: 0 });
  });

  it("never overwrites a manual override (a URL without a source)", async () => {
    const manual = { imageUrl: "https://example.com/grubbin.png", imageSource: null };
    await db
      .update(cards)
      .set(manual)
      .where(eq(cards.slug, `${PITCH_BLACK}-704759`));

    const result = await syncSetImages({ db, sources: sources(), setId: PITCH_BLACK, now: NOW });

    expect(result).toMatchObject({ due: 3, matched: 2, updated: 2 });
    expect(await image(PITCH_BLACK, "704759")).toEqual({
      url: "https://example.com/grubbin.png",
      source: null,
      at: null,
    });
    await syncSetImages({ db, sources: sources(), setId: PITCH_BLACK, now: daysAfter(60) });
    expect((await image(PITCH_BLACK, "704759")).url).toBe("https://example.com/grubbin.png");
  });

  it("refreshes a source's image only once it is over 30 days old", async () => {
    await syncSetImages({ db, sources: sources(), setId: PITCH_BLACK, now: NOW });

    // Only the unmatched booster box is due within 30 days.
    const early = await syncSetImages({
      db,
      sources: sources(),
      setId: PITCH_BLACK,
      now: daysAfter(29),
    });
    expect(early).toMatchObject({ due: 1, updated: 0 });
    expect((await image(PITCH_BLACK, "704758")).at).toEqual(NOW);

    const late = await syncSetImages({
      db,
      sources: sources(),
      setId: PITCH_BLACK,
      now: daysAfter(31),
    });
    expect(late).toMatchObject({ due: 4, updated: 3 });
    expect((await image(PITCH_BLACK, "704758")).at).toEqual(daysAfter(31));
  });

  it("joins only on TCGplayer id: cards TCGdex lists without one stay null", async () => {
    // TCGdex has 30th Celebration's scans, but no TCGplayer ids for them yet.
    await addSet("me-30th-celebration-pokemon", "pokemon", "ME: 30th Celebration", ["716435"]);

    const result = await syncSetImages({
      db,
      sources: sources(),
      setId: "me-30th-celebration-pokemon",
      now: NOW,
    });

    expect(result).toMatchObject({ status: "synced", sourceSetId: "30th", matched: 0, updated: 0 });
    expect((await image("me-30th-celebration-pokemon", "716435")).url).toBeNull();
  });

  it("leaves the set alone when the source has no matching set", async () => {
    await addSet("pokemon-futsal-pokemon", "pokemon", "Pokemon Futsal Collection", ["2"]);

    const result = await syncSetImages({
      db,
      sources: sources(),
      setId: "pokemon-futsal-pokemon",
      now: NOW,
    });

    expect(result).toMatchObject({
      status: "unmatched",
      reason: 'no set with code (none) or name "Pokemon Futsal Collection"',
      unmatched: 1,
      requests: 1,
    });
    expect((await image("pokemon-futsal-pokemon", "2")).url).toBeNull();
  });

  it("skips games without a source and games in IMAGES_DISABLED_GAMES", async () => {
    await addSet("op-17-one-piece-card-game", "one-piece-card-game", "OP-17", ["3"]);

    const onePiece = await syncSetImages({
      db,
      sources: sources(),
      setId: "op-17-one-piece-card-game",
    });
    const disabled = await syncSetImages({
      db,
      sources: sources(["pokemon"]),
      setId: PITCH_BLACK,
    });

    expect(onePiece).toMatchObject({ status: "unsupported", requests: 0 });
    expect(disabled).toMatchObject({ status: "unsupported", requests: 0 });
    expect((await image(PITCH_BLACK, "704758")).url).toBeNull();
  });
});

describe("clearGameImages", () => {
  it("blanks every image of the game, manual overrides included, and no other game's", async () => {
    await syncSetImages({ db, sources: sources(), setId: PITCH_BLACK, now: NOW });
    await syncSetImages({ db, sources: sources(), setId: VINE, now: NOW });
    await db
      .update(cards)
      .set({ imageUrl: "https://example.com/box.png" })
      .where(eq(cards.slug, `${PITCH_BLACK}-1`));

    expect(await clearGameImages(db, "pokemon")).toBe(4);

    for (const id of ["704758", "704759", "704857", "1"]) {
      expect(await image(PITCH_BLACK, id)).toEqual({ url: null, source: null, at: null });
    }
    expect(await image(VINE, "702669")).toMatchObject({ source: "lorcast", at: NOW });
  });
});
