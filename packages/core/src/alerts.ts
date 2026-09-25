import { alerts, cards, notifications, sets, users, variants, type Db } from "@tcg/db";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { Alert, AlertDirection, AlertInput, PendingNotification } from "./alert-types.ts";
import { isUuid } from "./portfolio.ts";
import { ValidationError } from "./portfolio-types.ts";

export * from "./alert-types.ts";

/** Minimum time between two firings of the same alert, even if it re-arms in between. */
export const ALERT_COOLDOWN_HOURS = 24;
export const MAX_DELIVERY_ATTEMPTS = 5;
const MAX_THRESHOLD_CENTS = 100_000_000;

function validateAlert(input: AlertInput): AlertInput {
  if (input.direction !== "above" && input.direction !== "below") {
    throw new ValidationError("Choose whether to alert above or below the target");
  }
  if (!Number.isInteger(input.thresholdCents) || input.thresholdCents <= 0) {
    throw new ValidationError("Target price must be more than zero");
  }
  if (input.thresholdCents > MAX_THRESHOLD_CENTS)
    throw new ValidationError("Target price is too large");
  return input;
}

export function alertConditionMet(
  direction: AlertDirection,
  thresholdCents: number,
  priceCents: number | null,
): boolean {
  if (priceCents === null) return false;
  return direction === "below" ? priceCents <= thresholdCents : priceCents >= thresholdCents;
}

const alertColumns = {
  id: alerts.id,
  variantId: alerts.variantId,
  cardSlug: cards.slug,
  cardName: cards.name,
  setName: sets.name,
  condition: variants.condition,
  printing: variants.printing,
  language: variants.language,
  direction: alerts.direction,
  thresholdCents: alerts.thresholdCents,
  active: alerts.active,
  priceCents: variants.priceCents,
  lastTriggeredAt: alerts.lastTriggeredAt,
  lastTriggeredPriceCents: alerts.lastTriggeredPriceCents,
};

function alertsQuery(db: Db) {
  return db
    .select(alertColumns)
    .from(alerts)
    .innerJoin(variants, eq(variants.id, alerts.variantId))
    .innerJoin(cards, eq(cards.id, variants.cardId))
    .innerJoin(sets, eq(sets.id, cards.setId));
}

function toAlert(row: Omit<Alert, "conditionMet">): Alert {
  return {
    ...row,
    conditionMet: alertConditionMet(row.direction, row.thresholdCents, row.priceCents),
  };
}

export async function listAlerts(db: Db, userId: string): Promise<Alert[]> {
  const rows = await alertsQuery(db)
    .where(eq(alerts.userId, userId))
    .orderBy(desc(alerts.active), desc(alerts.createdAt));
  return rows.map(toAlert);
}

export async function getAlert(db: Db, userId: string, alertId: string): Promise<Alert | null> {
  if (!isUuid(alertId)) return null;
  const [row] = await alertsQuery(db).where(and(eq(alerts.id, alertId), eq(alerts.userId, userId)));
  return row ? toAlert(row) : null;
}

export async function createAlert(
  db: Db,
  userId: string,
  variantId: string,
  input: AlertInput,
): Promise<string> {
  const { direction, thresholdCents } = validateAlert(input);
  if (!isUuid(variantId)) throw new ValidationError("That card variant doesn't exist");
  const [variant] = await db
    .select({ id: variants.id })
    .from(variants)
    .where(eq(variants.id, variantId));
  if (!variant) throw new ValidationError("That card variant doesn't exist");
  const [row] = await db
    .insert(alerts)
    .values({ userId, variantId, direction, thresholdCents })
    .returning({ id: alerts.id });
  return row!.id;
}

/** Changing the rule re-arms the alert so the new target can fire. */
export async function updateAlert(
  db: Db,
  userId: string,
  alertId: string,
  input: AlertInput,
): Promise<boolean> {
  const { direction, thresholdCents } = validateAlert(input);
  if (!isUuid(alertId)) return false;
  const updated = await db
    .update(alerts)
    .set({ direction, thresholdCents, armed: true })
    .where(and(eq(alerts.id, alertId), eq(alerts.userId, userId)))
    .returning({ id: alerts.id });
  return updated.length > 0;
}

export async function setAlertActive(
  db: Db,
  userId: string,
  alertId: string,
  active: boolean,
): Promise<boolean> {
  if (!isUuid(alertId)) return false;
  const updated = await db
    .update(alerts)
    .set({ active })
    .where(and(eq(alerts.id, alertId), eq(alerts.userId, userId)))
    .returning({ id: alerts.id });
  return updated.length > 0;
}

export async function deleteAlert(db: Db, userId: string, alertId: string): Promise<boolean> {
  if (!isUuid(alertId)) return false;
  const deleted = await db
    .delete(alerts)
    .where(and(eq(alerts.id, alertId), eq(alerts.userId, userId)))
    .returning({ id: alerts.id });
  return deleted.length > 0;
}

/**
 * Checks active alerts against current prices (optionally only one set's variants).
 * An armed alert whose condition holds fires once: it is disarmed and a notification is
 * queued in the same statement. A disarmed alert re-arms once its condition stops holding.
 */
export async function evaluateAlerts(
  db: Db,
  options: { setId?: string; now?: Date } = {},
): Promise<{ triggered: number; rearmed: number }> {
  const now = options.now ?? new Date();
  const cooldownStart = new Date(now.getTime() - ALERT_COOLDOWN_HOURS * 3_600_000);
  const inSet = options.setId
    ? sql`and v.card_id in (select id from ${cards} where set_id = ${options.setId})`
    : sql``;
  const conditionMet = sql`(
    (a.direction = 'below' and v.price_cents <= a.threshold_cents) or
    (a.direction = 'above' and v.price_cents >= a.threshold_cents)
  )`;

  return db.transaction(async (tx) => {
    const rearmed = await tx.execute(sql`
      update ${alerts} a set armed = true, updated_at = ${now}
      from ${variants} v
      where v.id = a.variant_id and a.active and not a.armed
        and v.price_cents is not null and not ${conditionMet} ${inSet}
    `);
    const triggered = await tx.execute(sql`
      with fired as (
        update ${alerts} a
        set armed = false, last_triggered_at = ${now}, last_triggered_price_cents = v.price_cents, updated_at = ${now}
        from ${variants} v
        where v.id = a.variant_id and a.active and a.armed
          and v.price_cents is not null and ${conditionMet}
          and (a.last_triggered_at is null or a.last_triggered_at <= ${cooldownStart}) ${inSet}
        returning a.id, a.user_id, a.variant_id, a.direction, a.threshold_cents, a.last_triggered_price_cents
      )
      insert into ${notifications}
        (user_id, alert_id, dedupe_key, variant_id, direction, threshold_cents, price_cents)
      select user_id, id, 'alert:' || id || ':' || ${now.toISOString()}, variant_id, direction, threshold_cents,
        last_triggered_price_cents
      from fired
      on conflict (dedupe_key) do nothing
    `);
    return { triggered: triggered.rowCount ?? 0, rearmed: rearmed.rowCount ?? 0 };
  });
}

/**
 * Delivers pending notifications grouped per user. `send` gets one user's batch and must throw
 * on failure; failed batches stay pending until MAX_DELIVERY_ATTEMPTS, then become `failed`.
 * Rows are locked with SKIP LOCKED, so concurrent workers never send the same notification.
 */
export async function deliverNotifications(
  db: Db,
  send: (batch: PendingNotification[]) => Promise<void>,
  options: { limit?: number; now?: Date } = {},
): Promise<{ sent: number; failed: number; retrying: number }> {
  const now = options.now ?? new Date();
  return db.transaction(async (tx) => {
    const pending = await tx
      .select({
        id: notifications.id,
        userId: notifications.userId,
        email: users.email,
        userName: users.name,
        cardSlug: cards.slug,
        cardName: cards.name,
        setName: sets.name,
        condition: variants.condition,
        printing: variants.printing,
        direction: notifications.direction,
        thresholdCents: notifications.thresholdCents,
        priceCents: notifications.priceCents,
        attempts: notifications.attempts,
      })
      .from(notifications)
      .innerJoin(users, eq(users.id, notifications.userId))
      .innerJoin(variants, eq(variants.id, notifications.variantId))
      .innerJoin(cards, eq(cards.id, variants.cardId))
      .innerJoin(sets, eq(sets.id, cards.setId))
      .where(eq(notifications.status, "pending"))
      .orderBy(asc(notifications.createdAt))
      .limit(options.limit ?? 500)
      .for("update", { of: notifications, skipLocked: true });

    const byUser = Map.groupBy(pending, (n) => n.userId);
    const result = { sent: 0, failed: 0, retrying: 0 };
    for (const batch of byUser.values()) {
      const ids = batch.map((n) => n.id);
      try {
        await send(batch);
        await tx
          .update(notifications)
          .set({
            status: "sent",
            sentAt: now,
            attempts: sql`${notifications.attempts} + 1`,
            lastError: null,
          })
          .where(inArray(notifications.id, ids));
        result.sent += batch.length;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const exhausted = batch
          .filter((n) => n.attempts + 1 >= MAX_DELIVERY_ATTEMPTS)
          .map((n) => n.id);
        const retry = ids.filter((id) => !exhausted.includes(id));
        if (exhausted.length) {
          await tx
            .update(notifications)
            .set({
              status: "failed",
              attempts: sql`${notifications.attempts} + 1`,
              lastError: message,
            })
            .where(inArray(notifications.id, exhausted));
        }
        if (retry.length) {
          await tx
            .update(notifications)
            .set({ attempts: sql`${notifications.attempts} + 1`, lastError: message })
            .where(inArray(notifications.id, retry));
        }
        result.failed += exhausted.length;
        result.retrying += retry.length;
      }
    }
    return result;
  });
}
