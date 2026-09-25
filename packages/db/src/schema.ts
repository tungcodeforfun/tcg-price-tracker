import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  real,
  serial,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth-schema.ts";

export * from "./auth-schema.ts";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/** Games as listed by the price provider; `enabled` games get their catalog and prices synced. */
export const games = pgTable("games", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  enabled: boolean("enabled").notNull().default(false),
  cardsCount: integer("cards_count").notNull().default(0),
  setsCount: integer("sets_count").notNull().default(0),
  ...timestamps,
});

export const sets = pgTable(
  "sets",
  {
    id: text("id").primaryKey(),
    gameId: text("game_id")
      .notNull()
      .references(() => games.id),
    name: text("name").notNull(),
    releaseDate: date("release_date"),
    cardsCount: integer("cards_count").notNull().default(0),
    pricesSyncedAt: timestamp("prices_synced_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("sets_game_id_idx").on(t.gameId)],
);

export const cards = pgTable(
  "cards",
  {
    /** Provider UUID. */
    id: uuid("id").primaryKey(),
    /** Provider slug id, stable and human-readable; used in URLs. */
    slug: text("slug").notNull().unique(),
    gameId: text("game_id")
      .notNull()
      .references(() => games.id),
    setId: text("set_id")
      .notNull()
      .references(() => sets.id),
    name: text("name").notNull(),
    number: text("number"),
    rarity: text("rarity"),
    tcgplayerId: text("tcgplayer_id"),
    details: text("details"),
    imageUrl: text("image_url"),
    ...timestamps,
  },
  (t) => [
    index("cards_set_id_idx").on(t.setId),
    index("cards_game_id_idx").on(t.gameId),
    index("cards_name_trgm_idx").using("gin", t.name.op("gin_trgm_ops")),
  ],
);

/** One sellable variant of a card: condition × printing × language. */
export const variants = pgTable(
  "variants",
  {
    /** Provider UUID. */
    id: uuid("id").primaryKey(),
    cardId: uuid("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    condition: text("condition").notNull(),
    printing: text("printing").notNull(),
    language: text("language").notNull(),
    tcgplayerSkuId: text("tcgplayer_sku_id"),
    /** Latest market price in USD cents; null when the provider has no price. */
    priceCents: integer("price_cents"),
    priceChange7dPct: real("price_change_7d_pct"),
    priceUpdatedAt: timestamp("price_updated_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("variants_card_id_idx").on(t.cardId),
    unique("variants_card_condition_printing_language_uq").on(
      t.cardId,
      t.condition,
      t.printing,
      t.language,
    ),
  ],
);

/** Daily price history: at most one point per variant per UTC day. */
export const pricePoints = pgTable(
  "price_points",
  {
    variantId: uuid("variant_id")
      .notNull()
      .references(() => variants.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    priceCents: integer("price_cents").notNull(),
  },
  (t) => [primaryKey({ columns: [t.variantId, t.day] })],
);

/** Last usage reported by a price provider, used to stop before hitting hard quotas. */
export const providerUsage = pgTable("provider_usage", {
  provider: text("provider").primaryKey(),
  plan: text("plan").notNull(),
  monthlyLimit: integer("monthly_limit").notNull(),
  monthlyUsed: integer("monthly_used").notNull(),
  dailyLimit: integer("daily_limit").notNull(),
  dailyUsed: integer("daily_used").notNull(),
  perMinuteLimit: integer("per_minute_limit").notNull(),
  reportedAt: timestamp("reported_at", { withTimezone: true }).notNull(),
});

export const syncRuns = pgTable(
  "sync_runs",
  {
    id: serial("id").primaryKey(),
    kind: text("kind", { enum: ["catalog", "set-prices"] }).notNull(),
    target: text("target"),
    status: text("status", { enum: ["running", "succeeded", "failed", "skipped"] }).notNull(),
    requests: integer("requests").notNull().default(0),
    cardsUpserted: integer("cards_upserted").notNull().default(0),
    variantsUpserted: integer("variants_upserted").notNull().default(0),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("sync_runs_kind_started_idx").on(t.kind, t.startedAt)],
);

/** One purchase lot: a quantity of a variant bought at one unit cost. */
export const collectionItems = pgTable(
  "collection_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => variants.id),
    quantity: integer("quantity").notNull(),
    /** Null when the user didn't record what they paid. */
    unitCostCents: integer("unit_cost_cents"),
    acquiredOn: date("acquired_on"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [
    index("collection_items_user_id_idx").on(t.userId),
    check("collection_items_quantity_positive", sql`${t.quantity} > 0`),
    check("collection_items_unit_cost_nonnegative", sql`${t.unitCostCents} >= 0`),
  ],
);

export const sales = pgTable(
  "sales",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => variants.id),
    quantity: integer("quantity").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    feesCents: integer("fees_cents").notNull().default(0),
    /** Cost of the units sold, fixed at sale time; null when the lot's cost was unknown. */
    costBasisCents: integer("cost_basis_cents"),
    soldOn: date("sold_on").notNull(),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [
    index("sales_user_id_idx").on(t.userId),
    check("sales_quantity_positive", sql`${t.quantity} > 0`),
    check("sales_amounts_nonnegative", sql`${t.unitPriceCents} >= 0 and ${t.feesCents} >= 0`),
  ],
);

/** End-of-day portfolio value per user, written by the worker. */
export const portfolioSnapshots = pgTable(
  "portfolio_snapshots",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    valueCents: integer("value_cents").notNull(),
    costBasisCents: integer("cost_basis_cents").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.day] })],
);

/**
 * A price alert on one variant. It fires when the price crosses the threshold, then stays
 * disarmed until the price moves back across; `armed` tracks that.
 */
export const alerts = pgTable(
  "alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => variants.id),
    direction: text("direction", { enum: ["above", "below"] }).notNull(),
    thresholdCents: integer("threshold_cents").notNull(),
    active: boolean("active").notNull().default(true),
    armed: boolean("armed").notNull().default(true),
    lastTriggeredAt: timestamp("last_triggered_at", { withTimezone: true }),
    lastTriggeredPriceCents: integer("last_triggered_price_cents"),
    ...timestamps,
  },
  (t) => [
    index("alerts_user_id_idx").on(t.userId),
    index("alerts_variant_active_idx")
      .on(t.variantId)
      .where(sql`${t.active}`),
    check("alerts_threshold_positive", sql`${t.thresholdCents} > 0`),
  ],
);

/** Outbox of user notifications; the worker delivers pending rows by email. */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    alertId: uuid("alert_id").references(() => alerts.id, { onDelete: "set null" }),
    /** One notification per alert firing, even if evaluation runs twice. */
    dedupeKey: text("dedupe_key").notNull().unique(),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => variants.id),
    direction: text("direction", { enum: ["above", "below"] }).notNull(),
    thresholdCents: integer("threshold_cents").notNull(),
    priceCents: integer("price_cents").notNull(),
    status: text("status", { enum: ["pending", "sent", "failed"] })
      .notNull()
      .default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("notifications_pending_idx")
      .on(t.createdAt)
      .where(sql`${t.status} = 'pending'`),
    index("notifications_user_id_idx").on(t.userId),
  ],
);

/** Private-beta invite codes; each sign-up redeems one use. */
export const inviteCodes = pgTable(
  "invite_codes",
  {
    code: text("code").primaryKey(),
    maxUses: integer("max_uses").notNull().default(1),
    uses: integer("uses").notNull().default(0),
    note: text("note"),
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("invite_codes_max_uses_positive", sql`${t.maxUses} > 0`),
    check("invite_codes_uses_within_max", sql`${t.uses} >= 0 and ${t.uses} <= ${t.maxUses}`),
  ],
);

export const feedback = pgTable(
  "feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    /** Copied at submission so the message stays attributable after account deletion. */
    email: text("email").notNull(),
    message: text("message").notNull(),
    pagePath: text("page_path"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("feedback_user_created_idx").on(t.userId, t.createdAt)],
);

/** Anonymous daily page-view counts per path; no user, IP or cookie is stored. */
export const pageViews = pgTable(
  "page_views",
  {
    day: date("day").notNull(),
    path: text("path").notNull(),
    views: integer("views").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.day, t.path] })],
);
