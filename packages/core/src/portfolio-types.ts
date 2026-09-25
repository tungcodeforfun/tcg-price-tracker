/** One purchase lot the user owns, valued at the variant's current market price. */
export interface Holding {
  itemId: string;
  variantId: string;
  cardSlug: string;
  cardName: string;
  cardNumber: string | null;
  setName: string;
  gameId: string;
  condition: string;
  printing: string;
  language: string;
  quantity: number;
  unitCostCents: number | null;
  /** `YYYY-MM-DD`. */
  acquiredOn: string | null;
  notes: string | null;
  priceCents: number | null;
  priceChange7dPct: number | null;
  /** quantity × price; null when the variant has no price. */
  valueCents: number | null;
  /** value − quantity × unit cost; null when price or cost is unknown. */
  unrealizedCents: number | null;
}

export interface Sale {
  id: string;
  variantId: string;
  cardSlug: string;
  cardName: string;
  setName: string;
  condition: string;
  printing: string;
  quantity: number;
  unitPriceCents: number;
  feesCents: number;
  costBasisCents: number | null;
  /** quantity × unit price − fees − cost basis; null when cost basis is unknown. */
  realizedCents: number | null;
  soldOn: string;
  notes: string | null;
}

export interface PortfolioSummary {
  /** Market value of every priced lot. */
  valueCents: number;
  /** Total cost of lots with a known cost. */
  costBasisCents: number;
  /** Unrealized P&L over lots with both a known cost and a price. */
  unrealizedCents: number;
  /** Realized P&L over sales with a known cost basis. */
  realizedCents: number;
  /** Sum of lot quantities. */
  cardCount: number;
  /** Lots whose variant has no market price (excluded from value). */
  unpricedLots: number;
  /** Lots without a recorded cost (excluded from cost basis and unrealized P&L). */
  unknownCostLots: number;
}

export interface VariantOption {
  variantId: string;
  cardSlug: string;
  cardName: string;
  cardNumber: string | null;
  setName: string;
  condition: string;
  printing: string;
  language: string;
  priceCents: number | null;
}

export interface LotInput {
  quantity: number;
  unitCostCents: number | null;
  acquiredOn: string | null;
  notes: string | null;
}

export interface SaleInput {
  quantity: number;
  unitPriceCents: number;
  feesCents: number;
  soldOn: string;
  notes: string | null;
}

export type CsvImportResult =
  { ok: true; imported: number } | { ok: false; errors: { line: number; message: string }[] };

/** Thrown when a sale asks for more units than the lot holds. */
export class InsufficientQuantityError extends Error {
  readonly available: number;
  constructor(available: number) {
    super(`Only ${available} available in this lot`);
    this.name = "InsufficientQuantityError";
    this.available = available;
  }
}

/** Thrown when an input violates a domain rule (e.g. non-positive quantity). */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
