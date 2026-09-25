import { cards, games, pricePoints, sets, variants, type Db } from "@tcg/db";
import { and, asc, count, eq, gte, inArray, isNotNull, sql, type SQL } from "drizzle-orm";

/** Conditions whose price represents a card's headline value. */
const HEADLINE_CONDITIONS = ["Near Mint", "Sealed"];

const CONDITION_ORDER = [
  "Sealed",
  "Near Mint",
  "Lightly Played",
  "Moderately Played",
  "Heavily Played",
  "Damaged",
];

export interface GameSummary {
  id: string;
  name: string;
  setsCount: number;
}

export interface SetSummary {
  id: string;
  gameId: string;
  name: string;
  releaseDate: string | null;
  cardsCount: number;
  pricesSyncedAt: Date | null;
}

export interface CardSummary {
  slug: string;
  name: string;
  number: string | null;
  rarity: string | null;
  setId: string;
  setName: string;
  gameId: string;
  /** Lowest Near Mint/Sealed price across printings, USD cents. */
  priceCents: number | null;
}

export interface VariantDetail {
  id: string;
  condition: string;
  printing: string;
  language: string;
  priceCents: number | null;
  priceChange7dPct: number | null;
  priceUpdatedAt: Date | null;
}

export interface CardDetail extends CardSummary {
  id: string;
  gameName: string;
  details: string | null;
  tcgplayerId: string | null;
  variants: VariantDetail[];
}

export interface PricePoint {
  day: string;
  priceCents: number;
}

const headlinePrice = sql<number | null>`(
  select min(${variants.priceCents}) from ${variants}
  where ${variants.cardId} = ${cards.id}
    and ${variants.condition} in (${sql.join(
      HEADLINE_CONDITIONS.map((c) => sql`${c}`),
      sql`, `,
    )})
)`.as("price_cents");

const cardSummaryColumns = {
  slug: cards.slug,
  name: cards.name,
  number: cards.number,
  rarity: cards.rarity,
  setId: cards.setId,
  setName: sets.name,
  gameId: cards.gameId,
  priceCents: headlinePrice,
};

/** Enabled games; `setsCount` is the number of sets with synced prices (the public ones). */
export async function listGames(db: Db): Promise<GameSummary[]> {
  return db
    .select({
      id: games.id,
      name: games.name,
      setsCount: sql<number>`(
        select count(*)::int from ${sets} s
        where s.game_id = ${games}.id and s.prices_synced_at is not null
      )`,
    })
    .from(games)
    .where(eq(games.enabled, true))
    .orderBy(asc(games.name));
}

export async function getGame(
  db: Db,
  gameId: string,
): Promise<{ game: GameSummary; sets: SetSummary[] } | null> {
  const [game] = await db
    .select({ id: games.id, name: games.name, setsCount: games.setsCount })
    .from(games)
    .where(and(eq(games.id, gameId), eq(games.enabled, true)));
  if (!game) return null;
  const gameSets = await db
    .select({
      id: sets.id,
      gameId: sets.gameId,
      name: sets.name,
      releaseDate: sets.releaseDate,
      cardsCount: sets.cardsCount,
      pricesSyncedAt: sets.pricesSyncedAt,
    })
    .from(sets)
    .where(and(eq(sets.gameId, gameId), isNotNull(sets.pricesSyncedAt)))
    .orderBy(sql`${sets.releaseDate} desc nulls last`, asc(sets.name));
  return { game, sets: gameSets };
}

export async function getSet(
  db: Db,
  setId: string,
): Promise<{ set: SetSummary & { gameName: string }; cards: CardSummary[] } | null> {
  const [set] = await db
    .select({
      id: sets.id,
      gameId: sets.gameId,
      gameName: games.name,
      name: sets.name,
      releaseDate: sets.releaseDate,
      cardsCount: sets.cardsCount,
      pricesSyncedAt: sets.pricesSyncedAt,
    })
    .from(sets)
    .innerJoin(games, eq(games.id, sets.gameId))
    .where(and(eq(sets.id, setId), eq(games.enabled, true), isNotNull(sets.pricesSyncedAt)));
  if (!set) return null;
  const setCards = await db
    .select(cardSummaryColumns)
    .from(cards)
    .innerJoin(sets, eq(sets.id, cards.setId))
    .where(eq(cards.setId, setId))
    .orderBy(sql`${cards.number} asc nulls last`, asc(cards.name));
  return { set, cards: setCards };
}

export async function getCard(db: Db, slug: string): Promise<CardDetail | null> {
  const [card] = await db
    .select({
      ...cardSummaryColumns,
      gameName: games.name,
      details: cards.details,
      tcgplayerId: cards.tcgplayerId,
      id: cards.id,
    })
    .from(cards)
    .innerJoin(sets, eq(sets.id, cards.setId))
    .innerJoin(games, eq(games.id, cards.gameId))
    .where(and(eq(cards.slug, slug), eq(games.enabled, true)));
  if (!card) return null;
  const cardVariants = await db
    .select({
      id: variants.id,
      condition: variants.condition,
      printing: variants.printing,
      language: variants.language,
      priceCents: variants.priceCents,
      priceChange7dPct: variants.priceChange7dPct,
      priceUpdatedAt: variants.priceUpdatedAt,
    })
    .from(variants)
    .where(eq(variants.cardId, card.id));
  cardVariants.sort(
    (a, b) =>
      a.printing.localeCompare(b.printing) ||
      conditionRank(a.condition) - conditionRank(b.condition) ||
      a.language.localeCompare(b.language),
  );
  return { ...card, variants: cardVariants };
}

export function conditionRank(condition: string): number {
  const index = CONDITION_ORDER.indexOf(condition);
  return index === -1 ? CONDITION_ORDER.length : index;
}

/** The variant a card page shows by default: cheapest headline-condition variant, else the first priced one. */
export function defaultVariant(variantList: VariantDetail[]): VariantDetail | undefined {
  const priced = variantList.filter((v) => v.priceCents !== null);
  const headline = priced
    .filter((v) => HEADLINE_CONDITIONS.includes(v.condition))
    .sort((a, b) => (a.priceCents ?? 0) - (b.priceCents ?? 0));
  return headline[0] ?? priced[0] ?? variantList[0];
}

export async function getPriceHistory(
  db: Db,
  variantId: string,
  days: number,
  now: Date = new Date(),
): Promise<PricePoint[]> {
  const since = new Date(now.getTime() - days * 86_400_000).toISOString().slice(0, 10);
  return db
    .select({ day: pricePoints.day, priceCents: pricePoints.priceCents })
    .from(pricePoints)
    .where(and(eq(pricePoints.variantId, variantId), gte(pricePoints.day, since)))
    .orderBy(asc(pricePoints.day));
}

export type SearchSort = "relevance" | "price-desc" | "price-asc" | "name";

export interface SearchParams {
  query: string;
  gameId?: string;
  sort?: SearchSort;
  limit?: number;
  offset?: number;
}

/** Trigram indexes can't serve shorter patterns; they would fall back to a full scan. */
export const MIN_QUERY_LENGTH = 3;

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/**
 * Name search backed by the `cards_name_trgm_idx` GIN index: substring matches plus
 * typo-tolerant word similarity (`<%`), ranked with exact/prefix matches first.
 */
export async function searchCards(
  db: Db,
  params: SearchParams,
): Promise<{ cards: CardSummary[]; hasMore: boolean }> {
  const query = params.query.trim();
  if (query.length < MIN_QUERY_LENGTH) return { cards: [], hasMore: false };
  const limit = params.limit ?? 24;
  const pattern = `%${escapeLike(query)}%`;

  const conditions: SQL[] = [
    sql`(${cards.name} ilike ${pattern} or ${query} <% ${cards.name})`,
    eq(games.enabled, true),
  ];
  if (params.gameId) conditions.push(eq(cards.gameId, params.gameId));

  const relevance = [
    sql`(lower(${cards.name}) = lower(${query})) desc`,
    sql`(${cards.name} ilike ${`${escapeLike(query)}%`}) desc`,
    sql`word_similarity(${query}, ${cards.name}) desc`,
    asc(cards.name),
  ];
  const orderBy = {
    relevance,
    "price-desc": [sql`price_cents desc nulls last`, asc(cards.name)],
    "price-asc": [sql`price_cents asc nulls last`, asc(cards.name)],
    name: [asc(cards.name), asc(sets.name)],
  }[params.sort ?? "relevance"];

  const rows = await db
    .select(cardSummaryColumns)
    .from(cards)
    .innerJoin(sets, eq(sets.id, cards.setId))
    .innerJoin(games, eq(games.id, cards.gameId))
    .where(and(...conditions))
    .orderBy(...orderBy)
    .limit(limit + 1)
    .offset(params.offset ?? 0);
  return { cards: rows.slice(0, limit), hasMore: rows.length > limit };
}

export interface SitemapEntry {
  path: string;
  lastModified: Date | null;
}

/** Sitemaps are capped at 50,000 URLs each; card URLs are split into pages of this size. */
export const SITEMAP_PAGE_SIZE = 40_000;

export async function listGameAndSetPaths(db: Db): Promise<SitemapEntry[]> {
  const enabled = eq(games.enabled, true);
  const [gameRows, setRows] = await Promise.all([
    db.select({ id: games.id, updatedAt: games.updatedAt }).from(games).where(enabled),
    db
      .select({ id: sets.id, updatedAt: sets.pricesSyncedAt })
      .from(sets)
      .innerJoin(games, eq(games.id, sets.gameId))
      .where(and(enabled, isNotNull(sets.pricesSyncedAt))),
  ]);
  return [
    ...gameRows.map((g) => ({ path: `/games/${g.id}`, lastModified: g.updatedAt })),
    ...setRows.map((s) => ({ path: `/sets/${s.id}`, lastModified: s.updatedAt })),
  ];
}

export async function countCardSitemapPages(db: Db): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(cards)
    .innerJoin(games, eq(games.id, cards.gameId))
    .where(eq(games.enabled, true));
  return Math.ceil((row?.total ?? 0) / SITEMAP_PAGE_SIZE);
}

/** One page (0-based) of card URLs, in stable id order. */
export async function listCardPaths(db: Db, page: number): Promise<SitemapEntry[]> {
  const rows = await db
    .select({ slug: cards.slug, updatedAt: cards.updatedAt })
    .from(cards)
    .innerJoin(games, eq(games.id, cards.gameId))
    .where(eq(games.enabled, true))
    .orderBy(asc(cards.id))
    .limit(SITEMAP_PAGE_SIZE)
    .offset(page * SITEMAP_PAGE_SIZE);
  return rows.map((c) => ({ path: `/cards/${c.slug}`, lastModified: c.updatedAt }));
}

export interface CardMover extends CardSummary {
  /** 7-day change of the headline variant, percent. */
  change7dPct: number;
}

export interface HomeHighlights {
  counts: { games: number; sets: number; cards: number };
  /** Most valuable cards by headline price. */
  topCards: CardSummary[];
  /** Largest absolute 7-day moves among Near Mint/Sealed variants. */
  movers: CardMover[];
}

export async function getHomeHighlights(db: Db, limit = 8): Promise<HomeHighlights> {
  const enabled = eq(games.enabled, true);
  const enabledGameIds = db.select({ id: games.id }).from(games).where(enabled);
  const [gameCount, setCount, cardCount] = await Promise.all([
    db.$count(games, enabled),
    db.$count(sets, and(inArray(sets.gameId, enabledGameIds), isNotNull(sets.pricesSyncedAt))),
    db.$count(cards, inArray(cards.gameId, enabledGameIds)),
  ]);
  const counts = { games: gameCount, sets: setCount, cards: cardCount };
  const topCards = await db
    .select(cardSummaryColumns)
    .from(cards)
    .innerJoin(sets, eq(sets.id, cards.setId))
    .innerJoin(games, eq(games.id, cards.gameId))
    .where(enabled)
    .orderBy(sql`price_cents desc nulls last`, asc(cards.name))
    .limit(limit);
  const movers = await db
    .selectDistinctOn([cards.id], {
      ...cardSummaryColumns,
      change7dPct: sql<number>`${variants.priceChange7dPct}`,
    })
    .from(cards)
    .innerJoin(sets, eq(sets.id, cards.setId))
    .innerJoin(games, eq(games.id, cards.gameId))
    .innerJoin(variants, eq(variants.cardId, cards.id))
    .where(
      and(
        enabled,
        sql`${variants.condition} in (${sql.join(
          HEADLINE_CONDITIONS.map((c) => sql`${c}`),
          sql`, `,
        )})`,
        isNotNull(variants.priceChange7dPct),
        sql`${variants.priceChange7dPct} <> 0`,
      ),
    )
    .orderBy(cards.id, sql`abs(${variants.priceChange7dPct}) desc`);
  movers.sort((a, b) => Math.abs(b.change7dPct) - Math.abs(a.change7dPct));
  return { counts, topCards, movers: movers.slice(0, limit) };
}
