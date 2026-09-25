import { createDb } from "./index.ts";
import { runMigrations } from "./migrate.ts";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const { db, pool } = createDb(url, { max: 1 });
try {
  await runMigrations(db);
  console.log("Migrations applied");
} finally {
  await pool.end();
}
