-- CMS collection tables for configs that were WIRE-UP-PENDING.
-- Table name === collection slug (registry backing-storage guard).

CREATE TABLE IF NOT EXISTS "categories" (
  "id" text PRIMARY KEY NOT NULL,
  "title" text NOT NULL,
  "slug" text,
  "slug_lock" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "categories_slug_idx" ON "categories" USING btree ("slug");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "events" (
  "id" text PRIMARY KEY NOT NULL,
  "title" text,
  "name" text,
  "description" text,
  "image" text,
  "alt" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "contents" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "image" text,
  "blocks" jsonb DEFAULT '[]'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "tags" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tags_slug_idx" ON "tags" USING btree ("slug");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "prices" (
  "id" text PRIMARY KEY NOT NULL,
  "title" text NOT NULL,
  "slug" text,
  "published_on" timestamp with time zone,
  "stripe_price_id" text,
  "price_json" jsonb,
  "enable_paywall" boolean DEFAULT false,
  "layout" jsonb DEFAULT '[]'::jsonb,
  "paywall" jsonb DEFAULT '[]'::jsonb,
  "categories" jsonb DEFAULT '[]'::jsonb,
  "related_prices" jsonb DEFAULT '[]'::jsonb,
  "skip_sync" boolean DEFAULT false,
  "status" text DEFAULT 'draft' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prices_slug_idx" ON "prices" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prices_deleted_at_idx" ON "prices" USING btree ("deleted_at");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "info" (
  "id" text PRIMARY KEY NOT NULL,
  "title" text NOT NULL,
  "subtitle" text NOT NULL,
  "description" text NOT NULL,
  "image" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "videos" (
  "id" text PRIMARY KEY NOT NULL,
  "url" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "subscriptions" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "status" text NOT NULL,
  "price_id" text NOT NULL,
  "quantity" integer,
  "cancel_at" timestamp with time zone,
  "canceled_at" timestamp with time zone,
  "current_period_start" timestamp with time zone,
  "current_period_end" timestamp with time zone,
  "trial_start" timestamp with time zone,
  "trial_end" timestamp with time zone,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscriptions_user_id_idx" ON "subscriptions" USING btree ("user_id");
