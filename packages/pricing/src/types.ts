export type JustTcgPlan = "free" | "starter" | "professional" | "enterprise";

/** Maximum cards returned per `GET /v1/cards` request on each plan. */
export const CARDS_PER_REQUEST: Record<JustTcgPlan, number> = {
  free: 20,
  starter: 100,
  professional: 100,
  enterprise: 200,
};

/** Usage as last reported by the provider in a response's `_metadata`. */
export interface ProviderUsage {
  plan: string;
  monthlyLimit: number;
  monthlyUsed: number;
  dailyLimit: number;
  dailyUsed: number;
  perMinuteLimit: number;
  reportedAt: Date;
}

/** Persists usage across processes so every worker respects the same hard quota. */
export interface UsageStore {
  load(): Promise<ProviderUsage | null>;
  save(usage: ProviderUsage): Promise<void>;
}

export interface ProviderGame {
  id: string;
  name: string;
  cardsCount: number;
  setsCount: number;
}

export interface ProviderSet {
  id: string;
  gameId: string;
  name: string;
  /** `YYYY-MM-DD`. */
  releaseDate: string | null;
  cardsCount: number;
}

export interface ProviderPricePoint {
  /** UTC day, `YYYY-MM-DD`. */
  day: string;
  priceCents: number;
}

export interface ProviderVariant {
  /** Provider UUID. */
  id: string;
  condition: string;
  printing: string;
  language: string;
  tcgplayerSkuId: string | null;
  priceCents: number | null;
  priceChange7dPct: number | null;
  priceUpdatedAt: Date | null;
  /** At most one point per UTC day, ascending. */
  history: ProviderPricePoint[];
}

export interface ProviderCard {
  /** Provider UUID. */
  id: string;
  /** Provider slug id. */
  slug: string;
  gameId: string;
  setId: string;
  name: string;
  number: string | null;
  rarity: string | null;
  tcgplayerId: string | null;
  details: string | null;
  variants: ProviderVariant[];
}

export interface CardsPage {
  cards: ProviderCard[];
  total: number;
  hasMore: boolean;
}

export interface PriceProvider {
  readonly cardsPerRequest: number;
  /** Requests this instance has sent, including retries. */
  readonly requestCount: number;
  listGames(): Promise<ProviderGame[]>;
  listSets(gameId: string): Promise<ProviderSet[]>;
  listCardsPage(params: { gameId: string; setId: string; offset: number }): Promise<CardsPage>;
}

/** Thrown before sending a request that would eat into the reserved daily/monthly quota. */
export class QuotaExhaustedError extends Error {
  readonly usage: ProviderUsage;
  constructor(message: string, usage: ProviderUsage) {
    super(message);
    this.name = "QuotaExhaustedError";
    this.usage = usage;
  }
}

export class JustTcgError extends Error {
  readonly status: number;
  readonly code: string | null;
  constructor(message: string, status: number, code: string | null) {
    super(message);
    this.name = "JustTcgError";
    this.status = status;
    this.code = code;
  }
}
