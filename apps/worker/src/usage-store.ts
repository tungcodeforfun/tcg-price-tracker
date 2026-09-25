import { providerUsage, type Db } from "@tcg/db";
import type { ProviderUsage, UsageStore } from "@tcg/pricing";
import { eq } from "drizzle-orm";

const PROVIDER = "justtcg";

function usageFields(usage: ProviderUsage): ProviderUsage {
  return {
    plan: usage.plan,
    monthlyLimit: usage.monthlyLimit,
    monthlyUsed: usage.monthlyUsed,
    dailyLimit: usage.dailyLimit,
    dailyUsed: usage.dailyUsed,
    perMinuteLimit: usage.perMinuteLimit,
    reportedAt: usage.reportedAt,
  };
}

/** Persists JustTCG usage in `provider_usage` so every process shares one view of the quota. */
export class DrizzleUsageStore implements UsageStore {
  readonly #db: Db;

  constructor(db: Db) {
    this.#db = db;
  }

  async load(): Promise<ProviderUsage | null> {
    const [row] = await this.#db
      .select()
      .from(providerUsage)
      .where(eq(providerUsage.provider, PROVIDER));
    return row ? usageFields(row) : null;
  }

  async save(usage: ProviderUsage): Promise<void> {
    const fields = usageFields(usage);
    await this.#db
      .insert(providerUsage)
      .values({ provider: PROVIDER, ...fields })
      .onConflictDoUpdate({ target: providerUsage.provider, set: fields });
  }
}
