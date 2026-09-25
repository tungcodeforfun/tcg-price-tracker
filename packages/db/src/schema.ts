import {
  boolean,
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
