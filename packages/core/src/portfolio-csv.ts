import { cards, collectionItems, sets, variants, type Db } from "@tcg/db";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { formatDollars, parseDollars } from "./money.ts";
import { isUuid, isValidDate, listHoldings, listSales, validateLot } from "./portfolio.ts";
import { ValidationError, type CsvImportResult, type LotInput } from "./portfolio-types.ts";

export const MAX_IMPORT_ROWS = 5_000;

const money = (cents: number | null) => (cents === null ? "" : formatDollars(cents));

export async function exportHoldingsCsv(db: Db, userId: string): Promise<string> {
  const holdings = await listHoldings(db, userId);
  const skus = await skuByVariant(
    db,
    holdings.map((h) => h.variantId),
  );
  return stringify(
    holdings.map((h) => ({
      variant_id: h.variantId,
      tcgplayer_sku_id: skus.get(h.variantId) ?? "",
      game: h.gameId,
      set: h.setName,
      card: h.cardName,
      number: h.cardNumber ?? "",
      printing: h.printing,
      condition: h.condition,
      language: h.language,
      quantity: h.quantity,
      unit_cost: money(h.unitCostCents),
      acquired_on: h.acquiredOn ?? "",
      notes: h.notes ?? "",
      market_price: money(h.priceCents),
      market_value: money(h.valueCents),
    })),
    { header: true, columns: HOLDING_EXPORT_COLUMNS },
  );
}

const HOLDING_EXPORT_COLUMNS = [
  "variant_id",
  "tcgplayer_sku_id",
  "game",
  "set",
  "card",
  "number",
  "printing",
  "condition",
  "language",
  "quantity",
  "unit_cost",
  "acquired_on",
  "notes",
  "market_price",
  "market_value",
];

export async function exportSalesCsv(db: Db, userId: string): Promise<string> {
  const rows = await listSales(db, userId);
  return stringify(
    rows.map((s) => ({
      sold_on: s.soldOn,
      variant_id: s.variantId,
      set: s.setName,
      card: s.cardName,
      printing: s.printing,
      condition: s.condition,
      quantity: s.quantity,
      unit_price: money(s.unitPriceCents),
      fees: money(s.feesCents),
      proceeds: money(s.quantity * s.unitPriceCents - s.feesCents),
      cost_basis: money(s.costBasisCents),
      realized: money(s.realizedCents),
      notes: s.notes ?? "",
    })),
    {
      header: true,
      columns: [
        "sold_on",
        "variant_id",
        "set",
        "card",
        "printing",
        "condition",
        "quantity",
        "unit_price",
        "fees",
        "proceeds",
        "cost_basis",
        "realized",
        "notes",
      ],
    },
  );
}

async function skuByVariant(db: Db, variantIds: string[]): Promise<Map<string, string>> {
  if (variantIds.length === 0) return new Map();
  const rows = await db
    .select({ id: variants.id, sku: variants.tcgplayerSkuId })
    .from(variants)
    .where(inArray(variants.id, variantIds));
  return new Map(rows.filter((r) => r.sku).map((r) => [r.id, r.sku!]));
}

type CsvRow = Record<string, string>;

interface CandidateVariant {
  id: string;
  sku: string | null;
  setId: string;
  setName: string;
  number: string | null;
  condition: string;
  printing: string;
  language: string;
}

/**
 * Imports purchase lots. A row identifies its variant by `variant_id`, `tcgplayer_sku_id`,
 * or `set` (id or name) + `number` + `condition` [+ `printing`] [+ `language`]. All-or-nothing: any bad row
 * rejects the whole file.
 */
export async function importHoldingsCsv(
  db: Db,
  userId: string,
  csvText: string,
): Promise<CsvImportResult> {
  let records: { record: CsvRow; info: { lines: number } }[];
  try {
    records = parse(csvText, {
      columns: (header: string[]) => header.map((h) => h.trim().toLowerCase()),
      bom: true,
      skip_empty_lines: true,
      trim: true,
      info: true,
    });
  } catch (error) {
    return {
      ok: false,
      errors: [{ line: 1, message: `Couldn't read the CSV: ${(error as Error).message}` }],
    };
  }
  const rows = records.map((r) => r.record);
  if (rows.length === 0)
    return { ok: false, errors: [{ line: 1, message: "The file has no rows" }] };
  if (rows.length > MAX_IMPORT_ROWS) {
    return {
      ok: false,
      errors: [{ line: 1, message: `Import at most ${MAX_IMPORT_ROWS} rows at a time` }],
    };
  }

  const candidates = await loadCandidates(db, rows);
  const errors: { line: number; message: string }[] = [];
  const lots: (LotInput & { variantId: string })[] = [];

  records.forEach(({ record: row, info }) => {
    // `info.lines` is the line where the record ends; quoted fields can span lines.
    const line = info.lines;
    const variant = resolveVariant(row, candidates);
    if (typeof variant === "string") {
      errors.push({ line, message: variant });
      return;
    }
    const quantity = Number(row.quantity ?? "");
    const cost = parseDollars(row.unit_cost ?? "");
    const acquiredOn = row.acquired_on || null;
    if (!cost.ok) {
      errors.push({ line, message: `unit_cost: ${cost.message}` });
      return;
    }
    if (acquiredOn && !isValidDate(acquiredOn)) {
      errors.push({ line, message: "acquired_on must be a date like 2026-09-25" });
      return;
    }
    try {
      lots.push({
        variantId: variant.id,
        ...validateLot({
          quantity,
          unitCostCents: cost.cents,
          acquiredOn,
          notes: row.notes ?? null,
        }),
      });
    } catch (error) {
      if (!(error instanceof ValidationError)) throw error;
      errors.push({ line, message: error.message });
    }
  });

  if (errors.length > 0) return { ok: false, errors };
  await db.transaction(async (tx) => {
    for (let i = 0; i < lots.length; i += 1_000) {
      await tx
        .insert(collectionItems)
        .values(lots.slice(i, i + 1_000).map((lot) => ({ userId, ...lot })));
    }
  });
  return { ok: true, imported: lots.length };
}

/** Fetches every variant any row could refer to, in at most three queries. */
async function loadCandidates(db: Db, rows: CsvRow[]): Promise<CandidateVariant[]> {
  const ids = unique(rows.map((r) => r.variant_id).filter((v): v is string => !!v && isUuid(v)));
  const skus = unique(rows.map((r) => r.tcgplayer_sku_id).filter((v): v is string => !!v));
  const setKeys = unique(
    rows
      .filter((r) => !r.variant_id && !r.tcgplayer_sku_id && r.set)
      .map((r) => r.set!.toLowerCase()),
  );
  const filters = [
    ids.length ? inArray(variants.id, ids) : undefined,
    skus.length ? inArray(variants.tcgplayerSkuId, skus) : undefined,
    setKeys.length
      ? or(inArray(sql`lower(${sets.id})`, setKeys), inArray(sql`lower(${sets.name})`, setKeys))
      : undefined,
  ].filter((f) => f !== undefined);
  if (filters.length === 0) return [];
  return db
    .select({
      id: variants.id,
      sku: variants.tcgplayerSkuId,
      setId: sets.id,
      setName: sets.name,
      number: cards.number,
      condition: variants.condition,
      printing: variants.printing,
      language: variants.language,
    })
    .from(variants)
    .innerJoin(cards, eq(cards.id, variants.cardId))
    .innerJoin(sets, eq(sets.id, cards.setId))
    .where(and(or(...filters)));
}

function resolveVariant(row: CsvRow, candidates: CandidateVariant[]): CandidateVariant | string {
  const variantId = row.variant_id?.toLowerCase();
  if (variantId) {
    return candidates.find((c) => c.id === variantId) ?? `Unknown variant_id ${row.variant_id}`;
  }
  if (row.tcgplayer_sku_id) {
    return (
      candidates.find((c) => c.sku === row.tcgplayer_sku_id) ??
      `Unknown tcgplayer_sku_id ${row.tcgplayer_sku_id}`
    );
  }
  if (!row.set || !row.number || !row.condition) {
    return "Identify the card with variant_id, tcgplayer_sku_id, or set + number + condition";
  }
  const set = row.set.toLowerCase();
  const matches = candidates.filter(
    (c) =>
      (c.setId.toLowerCase() === set || c.setName.toLowerCase() === set) &&
      c.number === row.number &&
      c.condition.toLowerCase() === row.condition!.toLowerCase() &&
      (!row.printing || c.printing.toLowerCase() === row.printing.toLowerCase()) &&
      (!row.language || c.language.toLowerCase() === row.language.toLowerCase()),
  );
  if (matches.length === 1) return matches[0]!;
  if (matches.length === 0) {
    return `No card ${row.number} with condition "${row.condition}"${row.printing ? ` and printing "${row.printing}"` : ""} in set "${row.set}"`;
  }
  const printings = unique(matches.map((m) => m.printing));
  if (printings.length > 1)
    return `Add a printing column: this card comes in ${printings.join(", ")}`;
  const languages = unique(matches.map((m) => m.language));
  if (languages.length > 1)
    return `Add a language column: this card comes in ${languages.join(", ")}`;
  return `"${row.set}" matches more than one set; use the set id instead`;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
