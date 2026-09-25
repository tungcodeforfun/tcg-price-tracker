import { providerUsage } from "@tcg/db";
import { createTestDb, truncateAll } from "@tcg/db/testing";
import type { ProviderUsage } from "@tcg/pricing";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { DrizzleUsageStore } from "../src/usage-store.ts";

const { db, close } = await createTestDb();
afterAll(close);
beforeEach(() => truncateAll(db));

const usage: ProviderUsage = {
  plan: "Free Tier",
  monthlyLimit: 1000,
  monthlyUsed: 4,
  dailyLimit: 100,
  dailyUsed: 4,
  perMinuteLimit: 10,
  reportedAt: new Date("2026-09-25T02:00:52.571Z"),
};

describe("DrizzleUsageStore", () => {
  it("loads nothing before any usage is saved", async () => {
    expect(await new DrizzleUsageStore(db).load()).toBeNull();
  });

  it("round-trips usage and overwrites it on the next save", async () => {
    const store = new DrizzleUsageStore(db);
    await store.save(usage);
    expect(await store.load()).toEqual(usage);

    const later = {
      ...usage,
      monthlyUsed: 9,
      dailyUsed: 9,
      reportedAt: new Date("2026-09-25T03:00:00.000Z"),
    };
    await store.save(later);

    expect(await new DrizzleUsageStore(db).load()).toEqual(later);
    expect(await db.select().from(providerUsage)).toEqual([{ provider: "justtcg", ...later }]);
  });
});
