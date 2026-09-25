import { sql } from "drizzle-orm";
import { createDb, type Db } from "./index.ts";
import { runMigrations } from "./migrate.ts";

/** Connects to TEST_DATABASE_URL and applies migrations. Tests must run serially against it. */
export async function createTestDb(): Promise<{ db: Db; close: () => Promise<void> }> {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is not set");
  const { db, pool } = createDb(url, { max: 2 });
  await runMigrations(db);
  return { db, close: () => pool.end() };
}

export async function truncateAll(db: Db): Promise<void> {
  await db.execute(sql`
    TRUNCATE price_points, variants, cards, sets, games, provider_usage, sync_runs,
      users, sessions, accounts, verifications, rate_limits, collection_items, sales, portfolio_snapshots, alerts, notifications
    RESTART IDENTITY CASCADE
  `);
}
