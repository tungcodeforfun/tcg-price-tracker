import { readFileSync } from "node:fs";
import type {
  CardsPage,
  PriceProvider,
  ProviderCard,
  ProviderGame,
  ProviderSet,
} from "@tcg/pricing";

interface RawGame {
  id: string;
  name: string;
  cards_count: number;
  sets_count: number;
}

interface RawSet {
  id: string;
  name: string;
  game_id: string;
  release_date: string | null;
  cards_count: number;
}

interface RawVariant {
  uuid: string;
  condition: string;
  printing: string;
  language: string;
  tcgplayerSkuId: string | null;
  price: number | null;
  lastUpdated: number | null;
  priceChange7d: number | null;
  priceHistory: { p: number; t: number }[];
}

interface RawCard {
  id: string;
  uuid: string;
  name: string;
  set: string;
  number: string | null;
  rarity: string | null;
  tcgplayerId: string | null;
  details: string | null;
  variants: RawVariant[];
}

const fixturesDir = new URL("../../../packages/pricing/test/fixtures/", import.meta.url);
const fixture = <T>(name: string): { data: T[] } =>
  JSON.parse(readFileSync(new URL(name, fixturesDir), "utf8"));
const utcDay = (unixSeconds: number): string =>
  new Date(unixSeconds * 1000).toISOString().slice(0, 10);

export const MCD_2014 = "mcdonald-s-promos-2014-pokemon";

export const fixtureGames: ProviderGame[] = fixture<RawGame>("games.json").data.map((game) => ({
  id: game.id,
  name: game.name,
  cardsCount: game.cards_count,
  setsCount: game.sets_count,
}));

export const fixturePokemonSets: ProviderSet[] = fixture<RawSet>("sets-pokemon.json").data.map(
  (set) => ({
    id: set.id,
    gameId: set.game_id,
    name: set.name,
    releaseDate: set.release_date?.slice(0, 10) ?? null,
    cardsCount: set.cards_count,
  }),
);

/** The 12 cards (60 variants) of McDonald's Promos 2014, each variant with 7 daily history points. */
export const fixtureCards: ProviderCard[] = fixture<RawCard>("cards-mcd2014-p0.json").data.map(
  (card) => ({
    id: card.uuid,
    slug: card.id,
    gameId: "pokemon",
    setId: card.set,
    name: card.name,
    number: card.number,
    rarity: card.rarity,
    tcgplayerId: card.tcgplayerId,
    details: card.details,
    variants: card.variants.map((variant) => ({
      id: variant.uuid,
      condition: variant.condition,
      printing: variant.printing,
      language: variant.language,
      tcgplayerSkuId: variant.tcgplayerSkuId,
      priceCents: variant.price === null ? null : Math.round(variant.price * 100),
      priceChange7dPct: variant.priceChange7d,
      priceUpdatedAt: variant.lastUpdated === null ? null : new Date(variant.lastUpdated * 1000),
      history: variant.priceHistory.map((point) => ({
        day: utcDay(point.t),
        priceCents: Math.round(point.p * 100),
      })),
    })),
  }),
);

/** Serves the fixtures like JustTCG would, counting requests and optionally failing one card page. */
export class FakeProvider implements PriceProvider {
  readonly cardsPerRequest: number;
  requestCount = 0;
  games: ProviderGame[];
  setsByGame: Record<string, ProviderSet[]>;
  cards: ProviderCard[];
  /** Thrown by the card page at this offset. */
  failAt: { offset: number; error: Error } | null = null;
  readonly setsRequested: string[] = [];
  readonly offsetsRequested: number[] = [];

  constructor(
    options: {
      cardsPerRequest?: number;
      cards?: ProviderCard[];
      setsByGame?: Record<string, ProviderSet[]>;
    } = {},
  ) {
    this.cardsPerRequest = options.cardsPerRequest ?? 20;
    this.games = structuredClone(fixtureGames);
    this.setsByGame = options.setsByGame ?? { pokemon: structuredClone(fixturePokemonSets) };
    this.cards = options.cards ?? structuredClone(fixtureCards);
  }

  async listGames(): Promise<ProviderGame[]> {
    this.requestCount += 1;
    return structuredClone(this.games);
  }

  async listSets(gameId: string): Promise<ProviderSet[]> {
    this.requestCount += 1;
    this.setsRequested.push(gameId);
    return structuredClone(this.setsByGame[gameId] ?? []);
  }

  async listCardsPage({
    setId,
    offset,
  }: {
    gameId: string;
    setId: string;
    offset: number;
  }): Promise<CardsPage> {
    // Fails before counting a request, as the real client's quota refusal does.
    if (this.failAt?.offset === offset) throw this.failAt.error;
    this.requestCount += 1;
    this.offsetsRequested.push(offset);
    const setCards = this.cards.filter((card) => card.setId === setId);
    const cards = setCards.slice(offset, offset + this.cardsPerRequest);
    return {
      cards: structuredClone(cards),
      total: setCards.length,
      hasMore: offset + cards.length < setCards.length,
    };
  }
}
