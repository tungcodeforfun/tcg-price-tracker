import { games, sets, type Db } from "@tcg/db";
import type { PriceProvider } from "@tcg/pricing";
import { sql } from "drizzle-orm";
import { excluded, insertBatches } from "./bulk.ts";
import { trackRun, type RunResult } from "./runs.ts";

export interface CatalogResult extends RunResult {
  games: number;
  enabledGames: number;
  sets: number;
}

/**
 * Mirrors the provider's games (enabling exactly `enabledGames`) and the sets of every enabled game.
 * Costs one request for the games plus one per enabled game.
 */
export async function syncCatalog({
  db,
  provider,
  enabledGames,
}: {
  db: Db;
  provider: PriceProvider;
  enabledGames: string[];
}): Promise<CatalogResult> {
  const enabled = new Set(enabledGames);
  const totals = { games: 0, enabledGames: 0, sets: 0 };

  const run = await trackRun(db, provider, { kind: "catalog" }, async () => {
    const providerGames = await provider.listGames();
    const gameRows = providerGames.map((game) => ({
      id: game.id,
      name: game.name,
      enabled: enabled.has(game.id),
      cardsCount: game.cardsCount,
      setsCount: game.setsCount,
    }));
    for (const batch of insertBatches(gameRows)) {
      await db
        .insert(games)
        .values(batch)
        .onConflictDoUpdate({
          target: games.id,
          set: {
            name: excluded(games.name),
            enabled: excluded(games.enabled),
            cardsCount: excluded(games.cardsCount),
            setsCount: excluded(games.setsCount),
            updatedAt: sql`now()`,
          },
        });
    }
    totals.games = providerGames.length;

    for (const game of providerGames.filter((candidate) => enabled.has(candidate.id))) {
      const gameSets = await provider.listSets(game.id);
      const setRows = gameSets.map((set) => ({
        id: set.id,
        gameId: game.id,
        name: set.name,
        releaseDate: set.releaseDate,
        cardsCount: set.cardsCount,
      }));
      for (const batch of insertBatches(setRows)) {
        await db
          .insert(sets)
          .values(batch)
          .onConflictDoUpdate({
            target: sets.id,
            set: {
              gameId: excluded(sets.gameId),
              name: excluded(sets.name),
              releaseDate: excluded(sets.releaseDate),
              cardsCount: excluded(sets.cardsCount),
              updatedAt: sql`now()`,
            },
          });
      }
      totals.enabledGames += 1;
      totals.sets += gameSets.length;
    }
  });
  return { ...run, ...totals };
}
