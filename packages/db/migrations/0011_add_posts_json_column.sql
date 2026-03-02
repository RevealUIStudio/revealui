-- Migration 0011: Add _json column to posts table
--
-- The RevealUI core engine stores complex field types (richText, blocks, arrays,
-- hasMany relationships) in a _json JSONB column on each collection table.
--
-- Migration 0005 added _json to pages and the new content collection tables
-- (contents, cards, heros, events, banners), but missed the posts table.
--
-- Without this column, creating a post via the CMS fails with:
--   column "_json" of relation "posts" does not exist
--
-- The posts.content JSONB column remains for backward compatibility but the
-- core engine will use _json to store the content richText field going forward.

ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "_json" JSONB DEFAULT '{}';
