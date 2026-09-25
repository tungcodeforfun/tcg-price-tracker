import { createDb, type Db } from "@tcg/db";
import { env } from "./env.ts";

const globalForDb = globalThis as unknown as { tcgDb?: Db };

/** One pool per process; reused across dev-server module reloads. */
export const db: Db = (globalForDb.tcgDb ??= createDb(env.databaseUrl).db);
