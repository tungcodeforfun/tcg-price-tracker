import { sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

/** Postgres rejects statements with more bind parameters than this. */
const MAX_BIND_PARAMS = 65_535;

/** Splits same-shaped rows into batches whose multi-row insert stays under the bind parameter limit. */
export function insertBatches<T extends object>(rows: T[]): T[][] {
  const columns = Math.max(1, Object.keys(rows[0] ?? {}).length);
  const size = Math.floor(MAX_BIND_PARAMS / columns);
  const batches: T[][] = [];
  for (let start = 0; start < rows.length; start += size)
    batches.push(rows.slice(start, start + size));
  return batches;
}

/** The row proposed for insertion, for `ON CONFLICT DO UPDATE SET`. */
export function excluded(column: PgColumn): SQL {
  return sql`excluded.${sql.identifier(column.name)}`;
}
