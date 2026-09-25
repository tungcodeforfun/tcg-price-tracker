import { syncRuns, type Db } from "@tcg/db";
import { QuotaExhaustedError, type PriceProvider } from "@tcg/pricing";
import { eq, sql } from "drizzle-orm";

type SyncRun = typeof syncRuns.$inferSelect;

export interface RunCounts {
  cardsUpserted: number;
  variantsUpserted: number;
}

export interface RunResult extends RunCounts {
  runId: number;
  /** A run that hit the quota is `skipped`; failed runs throw instead of returning. */
  status: "succeeded" | "skipped";
  requests: number;
  error: string | null;
}

/**
 * Records `work` as a `sync_runs` row, including the provider requests it spent. Quota exhaustion
 * ends the run as `skipped` without throwing (whatever `work` committed stays), any other error
 * ends it as `failed` and is rethrown.
 */
export async function trackRun(
  db: Db,
  provider: PriceProvider,
  run: { kind: SyncRun["kind"]; target?: string },
  work: (counts: RunCounts) => Promise<void>,
): Promise<RunResult> {
  const [row] = await db
    .insert(syncRuns)
    .values({ kind: run.kind, target: run.target ?? null, status: "running" })
    .returning({ id: syncRuns.id });
  const runId = row!.id;
  const requestsBefore = provider.requestCount;
  const counts: RunCounts = { cardsUpserted: 0, variantsUpserted: 0 };

  let status: "succeeded" | "skipped" | "failed" = "succeeded";
  let failure: unknown = null;
  try {
    await work(counts);
  } catch (error) {
    status = error instanceof QuotaExhaustedError ? "skipped" : "failed";
    failure = error;
  }

  const requests = provider.requestCount - requestsBefore;
  const error =
    failure === null ? null : failure instanceof Error ? failure.message : String(failure);
  await db
    .update(syncRuns)
    .set({ status, requests, ...counts, error, finishedAt: sql`now()` })
    .where(eq(syncRuns.id, runId));

  if (status === "failed") throw failure;
  return { runId, status, requests, ...counts, error };
}
