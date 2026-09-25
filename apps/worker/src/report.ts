import type { CatalogResult } from "./sync/catalog.ts";
import type { RunResult } from "./sync/runs.ts";
import type { SetToSync } from "./sync/select-sets.ts";

const count = (n: number, noun: string): string => `${n} ${noun}${n === 1 ? "" : "s"}`;
const reason = (result: RunResult): string => (result.error ? ` (${result.error})` : "");

export function describeCatalog(result: CatalogResult): string {
  return (
    `catalog ${result.status}: ${count(result.games, "game")} (${result.enabledGames} enabled), ` +
    `${count(result.sets, "set")}, ${count(result.requests, "request")}${reason(result)}`
  );
}

export function describeSetPrices(setId: string, result: RunResult): string {
  return (
    `set ${setId} ${result.status}: ${count(result.cardsUpserted, "card")}, ` +
    `${count(result.variantsUpserted, "variant")}, ${count(result.requests, "request")}${reason(result)}`
  );
}

export function describeDueSets({
  dailyBudget,
  sets,
}: {
  dailyBudget: number;
  sets: SetToSync[];
}): string {
  const requests = sets.reduce((sum, set) => sum + set.requests, 0);
  return `${count(sets.length, "set")} due, ${requests} of ${dailyBudget} budgeted requests`;
}
