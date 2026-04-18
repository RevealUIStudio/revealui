-- Supabase Vector Database — Extension Setup
--
-- One-time setup for fresh Supabase projects. Enables the pgvector
-- extension required for vector similarity search.
--
-- Tables and HNSW indexes are managed by Drizzle:
--   pnpm db:migrate
--
-- This file only enables the extension (provider-specific, can't be in Drizzle).
-- On Supabase, you can also enable pgvector via the Dashboard → Extensions.
--
-- Usage: psql $SUPABASE_DATABASE_URL -f supabase-vector-setup.sql

CREATE EXTENSION IF NOT EXISTS vector;