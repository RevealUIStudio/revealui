-- Migration 0005: Add CMS engine columns and content collection tables
--
-- The RevealUI core engine uses _json (JSONB) to store complex field types
-- (blocks, richText, arrays, relationships with hasMany) for all collections.
-- The `pages` table was missing this column, preventing seeding and content ops.
--
-- Additionally, the content collections (contents, cards, heros, events, banners)
-- exist in the CMS collection config but had no corresponding DB tables.
-- The core engine auto-creates these in PGlite (dev) mode but NOT for NeonDB.
-- This migration creates them for production.

-- 1. Add _json column to pages (needed by core engine for layout/blocks fields)
ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "_json" JSONB DEFAULT '{}';
--> statement-breakpoint

-- 2. Create contents collection table
CREATE TABLE IF NOT EXISTS "contents" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT,
  "description" TEXT,
  "_json" JSONB DEFAULT '{}',
  "_status" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- 3. Create cards collection table
CREATE TABLE IF NOT EXISTS "cards" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT,
  "label" TEXT,
  "cta" TEXT,
  "href" TEXT,
  "loading" TEXT DEFAULT 'eager',
  "_json" JSONB DEFAULT '{}',
  "_status" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- 4. Create heros collection table
CREATE TABLE IF NOT EXISTS "heros" (
  "id" TEXT PRIMARY KEY,
  "video" TEXT,
  "href" TEXT,
  "alt_text" TEXT,
  "_json" JSONB DEFAULT '{}',
  "_status" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- 5. Create events collection table
CREATE TABLE IF NOT EXISTS "events" (
  "id" TEXT PRIMARY KEY,
  "title" TEXT,
  "name" TEXT,
  "description" TEXT,
  "alt" TEXT,
  "_json" JSONB DEFAULT '{}',
  "_status" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- 6. Create banners collection table
CREATE TABLE IF NOT EXISTS "banners" (
  "id" TEXT PRIMARY KEY,
  "alt" TEXT,
  "heading" TEXT,
  "subheading" TEXT,
  "description" TEXT,
  "cta" TEXT,
  "highlight" TEXT,
  "punctuation" TEXT,
  "_json" JSONB DEFAULT '{}',
  "_status" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);
