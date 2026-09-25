CREATE TABLE "cards" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"game_id" text NOT NULL,
	"set_id" text NOT NULL,
	"name" text NOT NULL,
	"number" text,
	"rarity" text,
	"tcgplayer_id" text,
	"details" text,
	"image_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cards_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"cards_count" integer DEFAULT 0 NOT NULL,
	"sets_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_points" (
	"variant_id" uuid NOT NULL,
	"day" date NOT NULL,
	"price_cents" integer NOT NULL,
	CONSTRAINT "price_points_variant_id_day_pk" PRIMARY KEY("variant_id","day")
);
--> statement-breakpoint
CREATE TABLE "provider_usage" (
	"provider" text PRIMARY KEY NOT NULL,
	"plan" text NOT NULL,
	"monthly_limit" integer NOT NULL,
	"monthly_used" integer NOT NULL,
	"daily_limit" integer NOT NULL,
	"daily_used" integer NOT NULL,
	"per_minute_limit" integer NOT NULL,
	"reported_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sets" (
	"id" text PRIMARY KEY NOT NULL,
	"game_id" text NOT NULL,
	"name" text NOT NULL,
	"release_date" date,
	"cards_count" integer DEFAULT 0 NOT NULL,
	"prices_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"target" text,
	"status" text NOT NULL,
	"requests" integer DEFAULT 0 NOT NULL,
	"cards_upserted" integer DEFAULT 0 NOT NULL,
	"variants_upserted" integer DEFAULT 0 NOT NULL,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "variants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"card_id" uuid NOT NULL,
	"condition" text NOT NULL,
	"printing" text NOT NULL,
	"language" text NOT NULL,
	"tcgplayer_sku_id" text,
	"price_cents" integer,
	"price_change_7d_pct" real,
	"price_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "variants_card_condition_printing_language_uq" UNIQUE("card_id","condition","printing","language")
);
--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_set_id_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_points" ADD CONSTRAINT "price_points_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sets" ADD CONSTRAINT "sets_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variants" ADD CONSTRAINT "variants_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cards_set_id_idx" ON "cards" USING btree ("set_id");--> statement-breakpoint
CREATE INDEX "cards_game_id_idx" ON "cards" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "cards_name_trgm_idx" ON "cards" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "sets_game_id_idx" ON "sets" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "sync_runs_kind_started_idx" ON "sync_runs" USING btree ("kind","started_at");--> statement-breakpoint
CREATE INDEX "variants_card_id_idx" ON "variants" USING btree ("card_id");