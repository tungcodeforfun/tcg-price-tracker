import {
  cards,
  collectionItems,
  portfolioSnapshots,
  sales,
  sets,
  variants,
  type Db,
} from "@tcg/db";
import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { conditionRank } from "./catalog.ts";
import {
  InsufficientQuantityError,
  ValidationError,
  type Holding,
  type LotInput,
  type PortfolioSummary,
  type Sale,
  type SaleInput,
  type VariantOption,
} from "./portfolio-types.ts";

export * from "./portfolio-types.ts";

const MAX_QUANTITY = 100_000;
const MAX_NOTES = 500;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ids arrive from URLs and form fields; anything that isn't a UUID can't match a row. */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function isValidDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

function checkQuantity(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
    throw new ValidationError(
      `Quantity must be a whole number from 1 to ${MAX_QUANTITY.toLocaleString("en-US")}`,
    );
  }
}

function checkAmount(cents: number | null, label: string): void {
  if (cents !== null && (!Number.isInteger(cents) || cents < 0)) {
    throw new ValidationError(`${label} must be zero or more`);
  }
}

function checkDate(value: string | null, label: string): void {
  if (value !== null && !isValidDate(value))
    throw new ValidationError(`${label} must be a valid date`);
}

function cleanNotes(notes: string | null): string | null {
  const trimmed = notes?.trim() ?? "";
  if (trimmed.length > MAX_NOTES)
    throw new ValidationError(`Notes must be ${MAX_NOTES} characters or fewer`);
  return trimmed || null;
}

export function validateLot(input: LotInput): LotInput {
  checkQuantity(input.quantity);
  checkAmount(input.unitCostCents, "Cost");
  checkDate(input.acquiredOn, "Acquired date");
  return { ...input, notes: cleanNotes(input.notes) };
}

const holdingColumns = {
  itemId: collectionItems.id,
  variantId: collectionItems.variantId,
  cardSlug: cards.slug,
  cardName: cards.name,
  cardNumber: cards.number,
  setName: sets.name,
  gameId: cards.gameId,
  condition: variants.condition,
  printing: variants.printing,
  language: variants.language,
  quantity: collectionItems.quantity,
  unitCostCents: collectionItems.unitCostCents,
  acquiredOn: collectionItems.acquiredOn,
  notes: collectionItems.notes,
  priceCents: variants.priceCents,
  priceChange7dPct: variants.priceChange7dPct,
};

type HoldingRow = Omit<Holding, "valueCents" | "unrealizedCents">;

function toHolding(row: HoldingRow): Holding {
  const valueCents = row.priceCents === null ? null : row.quantity * row.priceCents;
  const unrealizedCents =
    valueCents === null || row.unitCostCents === null
      ? null
      : valueCents - row.quantity * row.unitCostCents;
  return { ...row, valueCents, unrealizedCents };
}

function holdingsQuery(db: Db) {
  return db
    .select(holdingColumns)
    .from(collectionItems)
    .innerJoin(variants, eq(variants.id, collectionItems.variantId))
    .innerJoin(cards, eq(cards.id, variants.cardId))
    .innerJoin(sets, eq(sets.id, cards.setId));
}

export async function listHoldings(db: Db, userId: string): Promise<Holding[]> {
  const rows = await holdingsQuery(db)
    .where(eq(collectionItems.userId, userId))
    .orderBy(asc(cards.name), asc(collectionItems.createdAt));
  return rows.map(toHolding).sort((a, b) => (b.valueCents ?? -1) - (a.valueCents ?? -1));
}

export async function getHolding(db: Db, userId: string, itemId: string): Promise<Holding | null> {
  if (!isUuid(itemId)) return null;
  const [row] = await holdingsQuery(db).where(
    and(eq(collectionItems.id, itemId), eq(collectionItems.userId, userId)),
  );
  return row ? toHolding(row) : null;
}

export async function addLot(
  db: Db,
  userId: string,
  variantId: string,
  input: LotInput,
): Promise<string> {
  const lot = validateLot(input);
  if (!isUuid(variantId)) throw new ValidationError("That card variant doesn't exist");
  const [variant] = await db
    .select({ id: variants.id })
    .from(variants)
    .where(eq(variants.id, variantId));
  if (!variant) throw new ValidationError("That card variant doesn't exist");
  const [row] = await db
    .insert(collectionItems)
    .values({ userId, variantId, ...lot })
    .returning({ id: collectionItems.id });
  return row!.id;
}

export async function updateLot(
  db: Db,
  userId: string,
  itemId: string,
  input: LotInput,
): Promise<boolean> {
  const lot = validateLot(input);
  if (!isUuid(itemId)) return false;
  const updated = await db
    .update(collectionItems)
    .set(lot)
    .where(and(eq(collectionItems.id, itemId), eq(collectionItems.userId, userId)))
    .returning({ id: collectionItems.id });
  return updated.length > 0;
}

export async function deleteLot(db: Db, userId: string, itemId: string): Promise<boolean> {
  if (!isUuid(itemId)) return false;
  const deleted = await db
    .delete(collectionItems)
    .where(and(eq(collectionItems.id, itemId), eq(collectionItems.userId, userId)))
    .returning({ id: collectionItems.id });
  return deleted.length > 0;
}

const saleColumns = {
  id: sales.id,
  variantId: sales.variantId,
  cardSlug: cards.slug,
  cardName: cards.name,
  setName: sets.name,
  condition: variants.condition,
  printing: variants.printing,
  quantity: sales.quantity,
  unitPriceCents: sales.unitPriceCents,
  feesCents: sales.feesCents,
  costBasisCents: sales.costBasisCents,
  soldOn: sales.soldOn,
  notes: sales.notes,
};

function toSale(row: Omit<Sale, "realizedCents">): Sale {
  const realizedCents =
    row.costBasisCents === null
      ? null
      : row.quantity * row.unitPriceCents - row.feesCents - row.costBasisCents;
  return { ...row, realizedCents };
}

function salesQuery(db: Db) {
  return db
    .select(saleColumns)
    .from(sales)
    .innerJoin(variants, eq(variants.id, sales.variantId))
    .innerJoin(cards, eq(cards.id, variants.cardId))
    .innerJoin(sets, eq(sets.id, cards.setId));
}

/**
 * Sells units from one lot (specific identification): the lot's unit cost fixes the sale's
 * cost basis. Selling the whole lot removes it. Returns null when the lot isn't the user's.
 */
export async function sellFromLot(
  db: Db,
  userId: string,
  itemId: string,
  input: SaleInput,
): Promise<Sale | null> {
  checkQuantity(input.quantity);
  checkAmount(input.unitPriceCents, "Sale price");
  checkAmount(input.feesCents, "Fees");
  checkDate(input.soldOn, "Sold date");
  const notes = cleanNotes(input.notes);
  if (!isUuid(itemId)) return null;

  const saleId = await db.transaction(async (tx) => {
    const [lot] = await tx
      .select()
      .from(collectionItems)
      .where(and(eq(collectionItems.id, itemId), eq(collectionItems.userId, userId)))
      .for("update");
    if (!lot) return null;
    if (input.quantity > lot.quantity) throw new InsufficientQuantityError(lot.quantity);
    const [sale] = await tx
      .insert(sales)
      .values({
        userId,
        variantId: lot.variantId,
        quantity: input.quantity,
        unitPriceCents: input.unitPriceCents,
        feesCents: input.feesCents,
        costBasisCents: lot.unitCostCents === null ? null : lot.unitCostCents * input.quantity,
        soldOn: input.soldOn,
        notes,
      })
      .returning({ id: sales.id });
    if (input.quantity === lot.quantity) {
      await tx.delete(collectionItems).where(eq(collectionItems.id, lot.id));
    } else {
      await tx
        .update(collectionItems)
        .set({ quantity: lot.quantity - input.quantity })
        .where(eq(collectionItems.id, lot.id));
    }
    return sale!.id;
  });
  if (!saleId) return null;
  const [row] = await salesQuery(db).where(eq(sales.id, saleId));
  return toSale(row!);
}

export async function listSales(db: Db, userId: string): Promise<Sale[]> {
  const rows = await salesQuery(db)
    .where(eq(sales.userId, userId))
    .orderBy(desc(sales.soldOn), desc(sales.createdAt));
  return rows.map(toSale);
}

export async function deleteSale(db: Db, userId: string, saleId: string): Promise<boolean> {
  if (!isUuid(saleId)) return false;
  const deleted = await db
    .delete(sales)
    .where(and(eq(sales.id, saleId), eq(sales.userId, userId)))
    .returning({ id: sales.id });
  return deleted.length > 0;
}

/** Portfolio totals computed in SQL over all of the user's lots and sales. */
export async function getPortfolioSummary(db: Db, userId: string): Promise<PortfolioSummary> {
  const lotLine = sql`${collectionItems.quantity}::bigint`;
  const [lots] = await db
    .select({
      valueCents: sql<string>`coalesce(sum(${lotLine} * ${variants.priceCents}), 0)`,
      costBasisCents: sql<string>`coalesce(sum(${lotLine} * ${collectionItems.unitCostCents}), 0)`,
      unrealizedCents: sql<string>`coalesce(sum(${lotLine} * (${variants.priceCents} - ${collectionItems.unitCostCents})), 0)`,
      cardCount: sql<string>`coalesce(sum(${collectionItems.quantity}), 0)`,
      unpricedLots: sql<string>`count(*) filter (where ${variants.priceCents} is null)`,
      unknownCostLots: sql<string>`count(*) filter (where ${collectionItems.unitCostCents} is null)`,
    })
    .from(collectionItems)
    .innerJoin(variants, eq(variants.id, collectionItems.variantId))
    .where(eq(collectionItems.userId, userId));
  const [sold] = await db
    .select({
      realizedCents: sql<string>`coalesce(sum(${sales.quantity}::bigint * ${sales.unitPriceCents} - ${sales.feesCents} - ${sales.costBasisCents}), 0)`,
    })
    .from(sales)
    .where(eq(sales.userId, userId));
  return {
    valueCents: Number(lots!.valueCents),
    costBasisCents: Number(lots!.costBasisCents),
    unrealizedCents: Number(lots!.unrealizedCents),
    realizedCents: Number(sold!.realizedCents),
    cardCount: Number(lots!.cardCount),
    unpricedLots: Number(lots!.unpricedLots),
    unknownCostLots: Number(lots!.unknownCostLots),
  };
}

export async function getPortfolioHistory(
  db: Db,
  userId: string,
  days: number,
  now: Date = new Date(),
): Promise<{ day: string; valueCents: number }[]> {
  const since = new Date(now.getTime() - days * 86_400_000).toISOString().slice(0, 10);
  return db
    .select({ day: portfolioSnapshots.day, valueCents: portfolioSnapshots.valueCents })
    .from(portfolioSnapshots)
    .where(and(eq(portfolioSnapshots.userId, userId), gte(portfolioSnapshots.day, since)))
    .orderBy(asc(portfolioSnapshots.day));
}

/** Writes (or rewrites) every user's snapshot for `day` in one statement; returns rows written. */
export async function snapshotPortfolios(db: Db, day: string): Promise<number> {
  const result = await db.execute(sql`
    insert into ${portfolioSnapshots} (user_id, day, value_cents, cost_basis_cents)
    select ci.user_id, ${day}::date,
      coalesce(sum(ci.quantity::bigint * v.price_cents), 0),
      coalesce(sum(ci.quantity::bigint * ci.unit_cost_cents), 0)
    from ${collectionItems} ci
    join ${variants} v on v.id = ci.variant_id
    group by ci.user_id
    on conflict (user_id, day) do update
      set value_cents = excluded.value_cents, cost_basis_cents = excluded.cost_basis_cents
  `);
  return result.rowCount ?? 0;
}

const variantOptionColumns = {
  variantId: variants.id,
  cardSlug: cards.slug,
  cardName: cards.name,
  cardNumber: cards.number,
  setName: sets.name,
  condition: variants.condition,
  printing: variants.printing,
  language: variants.language,
  priceCents: variants.priceCents,
};

export async function getVariantOption(db: Db, variantId: string): Promise<VariantOption | null> {
  if (!isUuid(variantId)) return null;
  const [row] = await db
    .select(variantOptionColumns)
    .from(variants)
    .innerJoin(cards, eq(cards.id, variants.cardId))
    .innerJoin(sets, eq(sets.id, cards.setId))
    .where(eq(variants.id, variantId));
  return row ?? null;
}

export async function listCardVariantOptions(db: Db, cardSlug: string): Promise<VariantOption[]> {
  const rows = await db
    .select(variantOptionColumns)
    .from(variants)
    .innerJoin(cards, eq(cards.id, variants.cardId))
    .innerJoin(sets, eq(sets.id, cards.setId))
    .where(eq(cards.slug, cardSlug));
  return rows.sort(
    (a, b) =>
      a.printing.localeCompare(b.printing) ||
      conditionRank(a.condition) - conditionRank(b.condition) ||
      a.language.localeCompare(b.language),
  );
}
