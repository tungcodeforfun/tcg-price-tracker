import { randomUUID } from "node:crypto";
import { cards, games, notifications, sets, users, variants, type Db } from "@tcg/db";
import { createTestDb, truncateAll } from "@tcg/db/testing";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  MAX_DELIVERY_ATTEMPTS,
  createAlert,
  deleteAlert,
  deliverNotifications,
  evaluateAlerts,
  getAlert,
  listAlerts,
  setAlertActive,
  updateAlert,
  type PendingNotification,
} from "../src/alerts.ts";
import { ValidationError } from "../src/portfolio-types.ts";

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => {
  ({ db, close } = await createTestDb());
});
afterAll(() => close());

const ALICE = "alice";
const BOB = "bob";
let variantId: string;
let otherSetVariant: string;

const HOUR = 3_600_000;
const t0 = new Date("2026-09-25T05:00:00Z");
const at = (hours: number) => new Date(t0.getTime() + hours * HOUR);

async function makeVariant(setId: string, priceCents: number | null): Promise<string> {
  const cardId = randomUUID();
  await db
    .insert(cards)
    .values({ id: cardId, slug: `c-${cardId}`, gameId: "pokemon", setId, name: "Charizard" });
  const id = randomUUID();
  await db.insert(variants).values({
    id,
    cardId,
    condition: "Near Mint",
    printing: "Holofoil",
    language: "English",
    priceCents,
  });
  return id;
}

const setPrice = (id: string, priceCents: number | null) =>
  db.update(variants).set({ priceCents }).where(eq(variants.id, id));

const notificationCount = async () => (await db.select().from(notifications)).length;

beforeEach(async () => {
  await truncateAll(db);
  await db.insert(users).values([
    { id: ALICE, name: "Alice", email: "alice@example.com" },
    { id: BOB, name: "Bob", email: "bob@example.com" },
  ]);
  await db.insert(games).values({ id: "pokemon", name: "Pokemon", enabled: true });
  await db.insert(sets).values([
    { id: "base", gameId: "pokemon", name: "Base Set" },
    { id: "jungle", gameId: "pokemon", name: "Jungle" },
  ]);
  variantId = await makeVariant("base", 5000);
  otherSetVariant = await makeVariant("jungle", 5000);
});

describe("evaluateAlerts", () => {
  it("fires once when the price crosses the target, not again while it stays past it", async () => {
    await createAlert(db, ALICE, variantId, { direction: "below", thresholdCents: 4000 });
    expect(await evaluateAlerts(db, { now: at(0) })).toMatchObject({ triggered: 0 });
    await setPrice(variantId, 3900);
    expect(await evaluateAlerts(db, { now: at(1) })).toMatchObject({ triggered: 1 });
    await setPrice(variantId, 3500);
    expect(await evaluateAlerts(db, { now: at(48) })).toMatchObject({ triggered: 0 });
    const [n] = await db.select().from(notifications);
    expect(n).toMatchObject({
      userId: ALICE,
      direction: "below",
      thresholdCents: 4000,
      priceCents: 3900,
    });
    expect((await listAlerts(db, ALICE))[0]).toMatchObject({ lastTriggeredPriceCents: 3900 });
  });

  it("treats reaching the target exactly as crossing it", async () => {
    await createAlert(db, ALICE, variantId, { direction: "above", thresholdCents: 5000 });
    expect(await evaluateAlerts(db, { now: at(0) })).toMatchObject({ triggered: 1 });
  });

  it("re-arms after the price moves back across, then fires again after the cooldown", async () => {
    await createAlert(db, ALICE, variantId, { direction: "above", thresholdCents: 6000 });
    await setPrice(variantId, 6100);
    await evaluateAlerts(db, { now: at(0) });
    await setPrice(variantId, 5900);
    expect(await evaluateAlerts(db, { now: at(1) })).toEqual({ triggered: 0, rearmed: 1 });
    await setPrice(variantId, 6200);
    // Re-armed, but still inside the 24h cooldown: no second email yet.
    expect(await evaluateAlerts(db, { now: at(2) })).toMatchObject({ triggered: 0 });
    expect(await evaluateAlerts(db, { now: at(24) })).toMatchObject({ triggered: 1 });
    expect(await notificationCount()).toBe(2);
  });

  it("ignores paused alerts and unpriced variants", async () => {
    const paused = await createAlert(db, ALICE, variantId, {
      direction: "below",
      thresholdCents: 9000,
    });
    await setAlertActive(db, ALICE, paused, false);
    const unpriced = await makeVariant("base", null);
    await createAlert(db, ALICE, unpriced, { direction: "below", thresholdCents: 9000 });
    expect(await evaluateAlerts(db, { now: at(0) })).toEqual({ triggered: 0, rearmed: 0 });
  });

  it("limits evaluation to one set when given", async () => {
    await createAlert(db, ALICE, variantId, { direction: "below", thresholdCents: 9000 });
    await createAlert(db, ALICE, otherSetVariant, { direction: "below", thresholdCents: 9000 });
    expect(await evaluateAlerts(db, { setId: "jungle", now: at(0) })).toMatchObject({
      triggered: 1,
    });
    const [n] = await db.select().from(notifications);
    expect(n?.variantId).toBe(otherSetVariant);
  });

  it("changing the rule re-arms a fired alert", async () => {
    const id = await createAlert(db, ALICE, variantId, {
      direction: "below",
      thresholdCents: 6000,
    });
    await evaluateAlerts(db, { now: at(0) });
    await updateAlert(db, ALICE, id, { direction: "below", thresholdCents: 5500 });
    expect(await evaluateAlerts(db, { now: at(25) })).toMatchObject({ triggered: 1 });
  });

  it("keeps the notification when its alert is deleted", async () => {
    const id = await createAlert(db, ALICE, variantId, {
      direction: "below",
      thresholdCents: 6000,
    });
    await evaluateAlerts(db, { now: at(0) });
    await deleteAlert(db, ALICE, id);
    const [n] = await db.select().from(notifications);
    expect(n).toMatchObject({ alertId: null, status: "pending" });
  });
});

describe("alert CRUD", () => {
  it("scopes every operation to the owner", async () => {
    const id = await createAlert(db, ALICE, variantId, {
      direction: "below",
      thresholdCents: 4000,
    });
    expect(await getAlert(db, BOB, id)).toBeNull();
    expect(await updateAlert(db, BOB, id, { direction: "above", thresholdCents: 1 })).toBe(false);
    expect(await setAlertActive(db, BOB, id, false)).toBe(false);
    expect(await deleteAlert(db, BOB, id)).toBe(false);
    expect(await listAlerts(db, BOB)).toEqual([]);
    expect(await getAlert(db, ALICE, id)).toMatchObject({
      direction: "below",
      thresholdCents: 4000,
      active: true,
    });
  });

  it("reports whether the current price already meets the condition", async () => {
    await createAlert(db, ALICE, variantId, { direction: "below", thresholdCents: 6000 });
    await createAlert(db, ALICE, variantId, { direction: "above", thresholdCents: 6000 });
    const met = Object.fromEntries(
      (await listAlerts(db, ALICE)).map((a) => [a.direction, a.conditionMet]),
    );
    expect(met).toEqual({ below: true, above: false });
  });

  it.each([
    ["zero target", { direction: "below" as const, thresholdCents: 0 }],
    ["fractional cents", { direction: "below" as const, thresholdCents: 10.5 }],
    ["unknown direction", { direction: "sideways" as "below", thresholdCents: 100 }],
  ])("rejects %s", async (_, input) => {
    await expect(createAlert(db, ALICE, variantId, input)).rejects.toThrow(ValidationError);
  });

  it("treats malformed ids as not found", async () => {
    expect(await getAlert(db, ALICE, "nope")).toBeNull();
    expect(await deleteAlert(db, ALICE, "nope")).toBe(false);
    await expect(
      createAlert(db, ALICE, "nope", { direction: "below", thresholdCents: 1 }),
    ).rejects.toThrow(ValidationError);
  });
});

describe("deliverNotifications", () => {
  async function fireForBoth() {
    await createAlert(db, ALICE, variantId, { direction: "below", thresholdCents: 9000 });
    await createAlert(db, ALICE, otherSetVariant, { direction: "below", thresholdCents: 9000 });
    await createAlert(db, BOB, variantId, { direction: "below", thresholdCents: 9000 });
    await evaluateAlerts(db, { now: at(0) });
  }

  it("sends one batch per user and marks everything sent", async () => {
    await fireForBoth();
    const batches: PendingNotification[][] = [];
    const result = await deliverNotifications(db, async (batch) => {
      batches.push(batch);
    });
    expect(result).toEqual({ sent: 3, failed: 0, retrying: 0 });
    expect(batches.map((b) => [b[0]?.email, b.length]).sort()).toEqual([
      ["alice@example.com", 2],
      ["bob@example.com", 1],
    ]);
    expect(await deliverNotifications(db, async () => {})).toEqual({
      sent: 0,
      failed: 0,
      retrying: 0,
    });
  });

  it("keeps a failed batch pending for retry, and gives up after the maximum attempts", async () => {
    await createAlert(db, ALICE, variantId, { direction: "below", thresholdCents: 9000 });
    await evaluateAlerts(db, { now: at(0) });
    const failing = async () => {
      throw new Error("SMTP down");
    };
    for (let attempt = 1; attempt < MAX_DELIVERY_ATTEMPTS; attempt++) {
      expect(await deliverNotifications(db, failing)).toEqual({ sent: 0, failed: 0, retrying: 1 });
    }
    expect(await deliverNotifications(db, failing)).toEqual({ sent: 0, failed: 1, retrying: 0 });
    const [n] = await db.select().from(notifications);
    expect(n).toMatchObject({
      status: "failed",
      attempts: MAX_DELIVERY_ATTEMPTS,
      lastError: "SMTP down",
    });
  });

  it("one user's failure doesn't block another user's email", async () => {
    await fireForBoth();
    const result = await deliverNotifications(db, async (batch) => {
      if (batch[0]?.userId === BOB) throw new Error("mailbox full");
    });
    expect(result).toEqual({ sent: 2, failed: 0, retrying: 1 });
  });

  it("never hands the same notification to two concurrent deliveries", async () => {
    await fireForBoth();
    const claimed = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const firstSeen: string[] = [];
    // The first delivery holds its row locks inside `send` until the second has finished.
    const first = deliverNotifications(db, async (batch) => {
      firstSeen.push(...batch.map((n) => n.id));
      claimed.resolve();
      await release.promise;
    });
    await claimed.promise;
    const secondSeen: string[] = [];
    const second = await deliverNotifications(db, async (batch) => {
      secondSeen.push(...batch.map((n) => n.id));
    });
    release.resolve();
    const firstResult = await first;
    expect(second.sent + firstResult.sent).toBe(3);
    expect(secondSeen.filter((id) => firstSeen.includes(id))).toEqual([]);
  });
});
