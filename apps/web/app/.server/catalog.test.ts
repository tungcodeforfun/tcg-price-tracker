import * as core from "@tcg/core";
import type { CardDetail, CardMover, CardSummary } from "@tcg/core";
import type { Db } from "@tcg/db";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCard, getHomeHighlights, getSet, hideDisabledImage, searchCards } from "./catalog";

vi.mock("./env", () => ({ env: { imagesDisabledGames: ["pokemon"] } }));
vi.mock("@tcg/core", async (importOriginal) => ({
  ...(await importOriginal<typeof core>()),
  getCard: vi.fn(),
  getSet: vi.fn(),
  searchCards: vi.fn(),
  getHomeHighlights: vi.fn(),
}));

const db = {} as Db;

function summary(gameId: string, imageUrl: string | null = `https://img.test/${gameId}.webp`) {
  return {
    slug: `${gameId}-card`,
    name: "Card",
    number: "001",
    rarity: "Rare",
    setId: `${gameId}-set`,
    setName: "Set",
    gameId,
    priceCents: 1234,
    imageUrl,
  } satisfies CardSummary;
}

const pokemon = summary("pokemon");
const lorcana = summary("disney-lorcana");
const withoutImage = (card: CardSummary) => ({ ...card, imageUrl: null });

afterEach(() => vi.resetAllMocks());

describe("hideDisabledImage", () => {
  it("blanks the image of a disabled game", () => {
    expect(hideDisabledImage(pokemon, ["disney-lorcana", "pokemon"])).toEqual(
      withoutImage(pokemon),
    );
  });

  it("keeps the image of any other game", () => {
    expect(hideDisabledImage(lorcana, ["pokemon"])).toBe(lorcana);
    expect(hideDisabledImage(pokemon, [])).toBe(pokemon);
  });

  it("matches whole game ids only", () => {
    const japanese = summary("pokemon-japan");
    expect(hideDisabledImage(japanese, ["pokemon"])).toBe(japanese);
  });

  it("does not mutate the card", () => {
    hideDisabledImage(pokemon, ["pokemon"]);
    expect(pokemon.imageUrl).toBe("https://img.test/pokemon.webp");
  });
});

describe("public catalog queries", () => {
  it("getCard hides the image and keeps every other field", async () => {
    const card: CardDetail = {
      ...pokemon,
      id: "card-1",
      gameName: "Pokémon",
      details: "HP 60",
      tcgplayerId: "632829",
      variants: [],
    };
    vi.mocked(core.getCard).mockResolvedValue(card);
    expect(await getCard(db, "slug")).toEqual(withoutImage(card));
    expect(core.getCard).toHaveBeenCalledWith(db, "slug");
  });

  it("getCard passes a missing card through", async () => {
    vi.mocked(core.getCard).mockResolvedValue(null);
    expect(await getCard(db, "missing")).toBeNull();
  });

  it("getSet hides images per card and keeps the set", async () => {
    const set = {
      id: "set",
      gameId: "pokemon",
      gameName: "Pokémon",
      name: "Set",
      releaseDate: "2026-09-16",
      cardsCount: 2,
      pricesSyncedAt: new Date("2026-09-20T00:00:00Z"),
    };
    vi.mocked(core.getSet).mockResolvedValue({ set, cards: [pokemon, lorcana] });
    expect(await getSet(db, "set")).toEqual({ set, cards: [withoutImage(pokemon), lorcana] });
  });

  it("searchCards hides images and keeps hasMore", async () => {
    vi.mocked(core.searchCards).mockResolvedValue({ cards: [lorcana, pokemon], hasMore: true });
    const params = { query: "card", sort: "name" as const };
    expect(await searchCards(db, params)).toEqual({
      cards: [lorcana, withoutImage(pokemon)],
      hasMore: true,
    });
    expect(core.searchCards).toHaveBeenCalledWith(db, params);
  });

  it("getHomeHighlights hides images in top cards and movers", async () => {
    const mover: CardMover = { ...pokemon, change7dPct: -12.5 };
    const counts = { games: 2, sets: 3, cards: 4 };
    vi.mocked(core.getHomeHighlights).mockResolvedValue({
      counts,
      topCards: [pokemon, lorcana],
      movers: [mover],
    });
    expect(await getHomeHighlights(db, 4)).toEqual({
      counts,
      topCards: [withoutImage(pokemon), lorcana],
      movers: [{ ...mover, imageUrl: null }],
    });
    expect(core.getHomeHighlights).toHaveBeenCalledWith(db, 4);
  });
});
