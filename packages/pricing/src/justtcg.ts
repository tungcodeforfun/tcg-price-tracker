import { setTimeout as delay } from "node:timers/promises";
import {
  CARDS_PER_REQUEST,
  JustTcgError,
  QuotaExhaustedError,
  type CardsPage,
  type JustTcgPlan,
  type PriceProvider,
  type ProviderCard,
  type ProviderGame,
  type ProviderPricePoint,
  type ProviderSet,
  type ProviderUsage,
  type ProviderVariant,
  type UsageStore,
} from "./types.ts";

export interface JustTcgClientOptions {
  apiKey: string;
  plan: JustTcgPlan;
  usageStore: UsageStore;
  fetch?: typeof fetch;
  baseUrl?: string;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
  /** Daily requests kept in reserve; the client refuses to spend them. */
  dailyReserve?: number;
  /** Monthly requests kept in reserve; the client refuses to spend them. */
  monthlyReserve?: number;
}

const DEFAULT_BASE_URL = "https://api.justtcg.com";
const PRICE_HISTORY_DURATION = "30d";
const RATE_WINDOW_MS = 60_000;
const MAX_429_RETRIES = 3;
const DEFAULT_429_BACKOFF_MS = 60_000;

const DEFAULT_PER_MINUTE: Record<JustTcgPlan, number> = {
  free: 10,
  starter: 50,
  professional: 100,
  enterprise: 500,
};

interface ApiMetadata {
  apiPlan: string;
  apiRequestLimit: number;
  apiRequestsUsed: number;
  apiDailyLimit: number;
  apiDailyRequestsUsed: number;
  apiRateLimit: number;
}

interface ApiGame {
  id: string;
  name: string;
  cards_count: number;
  sets_count: number;
}

interface ApiSet {
  id: string;
  name: string;
  game_id: string;
  release_date: string | null;
  cards_count: number;
}

interface ApiVariant {
  uuid: string;
  condition: string;
  printing: string;
  language: string;
  tcgplayerSkuId?: unknown;
  price?: number | null;
  lastUpdated?: number | null;
  priceChange7d?: number | null;
  priceHistory?: { p: number | null; t: number }[] | null;
}

interface ApiCard {
  id: string;
  uuid: string;
  name: string;
  set: string;
  number?: unknown;
  rarity?: unknown;
  tcgplayerId?: unknown;
  details?: unknown;
  variants: ApiVariant[];
}

interface ApiList<T> {
  data: T[];
}

interface ApiCardsResponse extends ApiList<ApiCard> {
  meta: { total: number; hasMore: boolean };
}

const utcDay = (date: Date): string => date.toISOString().slice(0, 10);

function optionalString(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return null;
}

function toReleaseDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : utcDay(date);
}

function toHistory(points: ApiVariant["priceHistory"]): ProviderPricePoint[] {
  const latestByDay = new Map<string, { t: number; p: number }>();
  for (const { p, t } of points ?? []) {
    if (typeof p !== "number") continue;
    const day = utcDay(new Date(t * 1000));
    const current = latestByDay.get(day);
    if (!current || t > current.t) latestByDay.set(day, { t, p });
  }
  return [...latestByDay]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([day, { p }]) => ({ day, priceCents: Math.round(p * 100) }));
}

function toVariant(variant: ApiVariant): ProviderVariant {
  return {
    id: variant.uuid,
    condition: variant.condition,
    printing: variant.printing,
    language: variant.language,
    tcgplayerSkuId: optionalString(variant.tcgplayerSkuId),
    priceCents: typeof variant.price === "number" ? Math.round(variant.price * 100) : null,
    priceChange7dPct: variant.priceChange7d ?? null,
    priceUpdatedAt:
      typeof variant.lastUpdated === "number" ? new Date(variant.lastUpdated * 1000) : null,
    history: toHistory(variant.priceHistory),
  };
}

function toCard(card: ApiCard, gameId: string): ProviderCard {
  return {
    id: card.uuid,
    slug: card.id,
    gameId,
    setId: card.set,
    name: card.name,
    number: optionalString(card.number),
    rarity: optionalString(card.rarity),
    tcgplayerId: optionalString(card.tcgplayerId),
    details: optionalString(card.details),
    variants: card.variants.map(toVariant),
  };
}

function toUsage(metadata: ApiMetadata, reportedAt: Date): ProviderUsage {
  return {
    plan: metadata.apiPlan,
    monthlyLimit: metadata.apiRequestLimit,
    monthlyUsed: metadata.apiRequestsUsed,
    dailyLimit: metadata.apiDailyLimit,
    dailyUsed: metadata.apiDailyRequestsUsed,
    perMinuteLimit: metadata.apiRateLimit,
    reportedAt,
  };
}

function metadataOf(body: unknown): ApiMetadata | null {
  if (typeof body !== "object" || body === null || !("_metadata" in body)) return null;
  const metadata = body._metadata;
  return typeof metadata === "object" && metadata !== null ? (metadata as ApiMetadata) : null;
}

function toError(status: number, body: unknown): JustTcgError {
  const fields =
    typeof body === "object" && body !== null ? (body as { error?: unknown; code?: unknown }) : {};
  const message =
    typeof fields.error === "string" ? fields.error : `JustTCG request failed with HTTP ${status}`;
  return new JustTcgError(message, status, typeof fields.code === "string" ? fields.code : null);
}

function retryAfterMs(response: Response): number {
  const header = response.headers.get("retry-after");
  const seconds = header === null || header.trim() === "" ? Number.NaN : Number(header);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : DEFAULT_429_BACKOFF_MS;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export class JustTcgClient implements PriceProvider {
  readonly cardsPerRequest: number;
  #requestCount = 0;
  readonly #apiKey: string;
  readonly #plan: JustTcgPlan;
  readonly #usageStore: UsageStore;
  readonly #fetch: typeof fetch;
  readonly #baseUrl: string;
  readonly #now: () => Date;
  readonly #sleep: (ms: number) => Promise<void>;
  readonly #dailyReserve: number;
  readonly #monthlyReserve: number;
  /** Send times (epoch ms) of requests inside the rolling rate-limit window, oldest first. */
  readonly #sentAt: number[] = [];

  constructor(options: JustTcgClientOptions) {
    this.#apiKey = options.apiKey;
    this.#plan = options.plan;
    this.#usageStore = options.usageStore;
    this.#fetch = options.fetch ?? ((input, init) => fetch(input, init));
    this.#baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.#now = options.now ?? (() => new Date());
    this.#sleep = options.sleep ?? delay;
    this.#dailyReserve = options.dailyReserve ?? 5;
    this.#monthlyReserve = options.monthlyReserve ?? 20;
    this.cardsPerRequest = CARDS_PER_REQUEST[options.plan];
  }

  get requestCount(): number {
    return this.#requestCount;
  }

  async listGames(): Promise<ProviderGame[]> {
    const body = await this.#get<ApiList<ApiGame>>("/v1/games", {});
    return body.data.map((game) => ({
      id: game.id,
      name: game.name,
      cardsCount: game.cards_count,
      setsCount: game.sets_count,
    }));
  }

  async listSets(gameId: string): Promise<ProviderSet[]> {
    const body = await this.#get<ApiList<ApiSet>>("/v1/sets", { game: gameId });
    return body.data.map((set) => ({
      id: set.id,
      gameId: set.game_id,
      name: set.name,
      releaseDate: toReleaseDate(set.release_date),
      cardsCount: set.cards_count,
    }));
  }

  async listCardsPage(params: {
    gameId: string;
    setId: string;
    offset: number;
  }): Promise<CardsPage> {
    const body = await this.#get<ApiCardsResponse>("/v1/cards", {
      game: params.gameId,
      set: params.setId,
      limit: String(this.cardsPerRequest),
      offset: String(params.offset),
      priceHistoryDuration: PRICE_HISTORY_DURATION,
    });
    return {
      cards: body.data.map((card) => toCard(card, params.gameId)),
      total: body.meta.total,
      hasMore: body.meta.hasMore,
    };
  }

  async #get<T>(path: string, query: Record<string, string>): Promise<T> {
    const url = new URL(path, this.#baseUrl);
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);

    for (let attempt = 0; ; attempt++) {
      const usage = await this.#usageStore.load();
      this.#assertQuota(usage);
      await this.#throttle(usage?.perMinuteLimit ?? DEFAULT_PER_MINUTE[this.#plan]);

      this.#requestCount++;
      const response = await this.#fetch(url, {
        headers: { "x-api-key": this.#apiKey, accept: "application/json" },
      });
      const body = await readJson(response);
      const metadata = metadataOf(body);
      if (metadata) await this.#usageStore.save(toUsage(metadata, this.#now()));

      if (response.ok) {
        if (body === null)
          throw new JustTcgError(
            `JustTCG returned invalid JSON for ${path}`,
            response.status,
            null,
          );
        return body as T;
      }
      if (response.status === 429 && attempt < MAX_429_RETRIES) {
        await this.#sleep(retryAfterMs(response));
        continue;
      }
      throw toError(response.status, body);
    }
  }

  #assertQuota(usage: ProviderUsage | null): void {
    if (!usage) return;
    const today = utcDay(this.#now());
    const reportedDay = utcDay(usage.reportedAt);
    if (reportedDay === today && usage.dailyUsed >= usage.dailyLimit - this.#dailyReserve) {
      throw new QuotaExhaustedError(
        `JustTCG daily quota reserve reached: ${usage.dailyUsed}/${usage.dailyLimit} used, ${this.#dailyReserve} reserved`,
        usage,
      );
    }
    if (
      reportedDay.slice(0, 7) === today.slice(0, 7) &&
      usage.monthlyUsed >= usage.monthlyLimit - this.#monthlyReserve
    ) {
      throw new QuotaExhaustedError(
        `JustTCG monthly quota reserve reached: ${usage.monthlyUsed}/${usage.monthlyLimit} used, ${this.#monthlyReserve} reserved`,
        usage,
      );
    }
  }

  /** Waits until sending one more request keeps at most `limit` requests in the rolling window, then records it. */
  async #throttle(limit: number): Promise<void> {
    const capacity = Math.max(1, limit);
    for (;;) {
      const now = this.#now().getTime();
      while (this.#sentAt.length > 0 && (this.#sentAt[0] ?? 0) <= now - RATE_WINDOW_MS)
        this.#sentAt.shift();
      const oldest = this.#sentAt[0];
      if (oldest === undefined || this.#sentAt.length < capacity) {
        this.#sentAt.push(now);
        return;
      }
      await this.#sleep(oldest + RATE_WINDOW_MS - now);
    }
  }
}
