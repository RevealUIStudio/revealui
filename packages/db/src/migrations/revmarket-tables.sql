-- =============================================================================
-- RevMarket — Autonomous Agent Marketplace Tables (Phase 5.16)
-- =============================================================================
-- Creates 4 tables for the RevMarket autonomous agent marketplace:
--   marketplace_agents  — publishable agent definitions
--   agent_skills        — capabilities each agent advertises
--   agent_reviews       — user ratings and feedback
--   task_submissions    — user requests for agent work
--
-- Run: psql $DATABASE_URL -f revmarket-tables.sql
-- =============================================================================

-- Marketplace Agents
CREATE TABLE IF NOT EXISTS "marketplace_agents" (
  "id"                 TEXT PRIMARY KEY,
  "name"               TEXT NOT NULL,
  "description"        TEXT NOT NULL,
  "publisher_id"       TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "version"            TEXT NOT NULL DEFAULT '0.1.0',
  "definition"         JSONB NOT NULL,
  "pricing_model"      TEXT NOT NULL DEFAULT 'per-task',
  "base_price_usdc"    TEXT NOT NULL DEFAULT '0.10',
  "max_execution_secs" INTEGER NOT NULL DEFAULT 300,
  "resource_limits"    JSONB DEFAULT '{"maxMemoryMb":512,"maxCpuPercent":50}',
  "rating"             REAL DEFAULT 0,
  "review_count"       INTEGER NOT NULL DEFAULT 0,
  "task_count"         INTEGER NOT NULL DEFAULT 0,
  "status"             TEXT NOT NULL DEFAULT 'draft',
  "category"           TEXT NOT NULL DEFAULT 'other',
  "tags"               TEXT[] NOT NULL DEFAULT '{}',
  "stripe_account_id"  TEXT,
  "created_at"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "marketplace_agents_publisher_id_idx" ON "marketplace_agents"("publisher_id");
CREATE INDEX IF NOT EXISTS "marketplace_agents_status_idx" ON "marketplace_agents"("status");
CREATE INDEX IF NOT EXISTS "marketplace_agents_category_idx" ON "marketplace_agents"("category");
CREATE INDEX IF NOT EXISTS "marketplace_agents_rating_idx" ON "marketplace_agents"("rating");

-- Agent Skills
CREATE TABLE IF NOT EXISTS "agent_skills" (
  "id"            TEXT PRIMARY KEY,
  "agent_id"      TEXT NOT NULL REFERENCES "marketplace_agents"("id") ON DELETE CASCADE,
  "name"          TEXT NOT NULL,
  "description"   TEXT NOT NULL,
  "input_schema"  JSONB,
  "output_schema" JSONB,
  "examples"      JSONB DEFAULT '[]',
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "agent_skills_agent_id_idx" ON "agent_skills"("agent_id");
CREATE INDEX IF NOT EXISTS "agent_skills_name_idx" ON "agent_skills"("name");

-- Agent Reviews
CREATE TABLE IF NOT EXISTS "agent_reviews" (
  "id"          TEXT PRIMARY KEY,
  "agent_id"    TEXT NOT NULL REFERENCES "marketplace_agents"("id") ON DELETE CASCADE,
  "reviewer_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "task_id"     TEXT,
  "rating"      INTEGER NOT NULL,
  "comment"     TEXT,
  "verified"    INTEGER NOT NULL DEFAULT 0,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "agent_reviews_agent_id_idx" ON "agent_reviews"("agent_id");
CREATE INDEX IF NOT EXISTS "agent_reviews_reviewer_id_idx" ON "agent_reviews"("reviewer_id");

-- Task Submissions
CREATE TABLE IF NOT EXISTS "task_submissions" (
  "id"              TEXT PRIMARY KEY,
  "submitter_id"    TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "agent_id"        TEXT REFERENCES "marketplace_agents"("id") ON DELETE SET NULL,
  "skill_name"      TEXT NOT NULL,
  "input"           JSONB NOT NULL,
  "output"          JSONB,
  "artifacts"       JSONB DEFAULT '[]',
  "status"          TEXT NOT NULL DEFAULT 'pending',
  "priority"        INTEGER NOT NULL DEFAULT 3,
  "cost_usdc"       TEXT,
  "payment_method"  TEXT,
  "execution_meta"  JSONB,
  "error_message"   TEXT,
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "task_submissions_submitter_id_idx" ON "task_submissions"("submitter_id");
CREATE INDEX IF NOT EXISTS "task_submissions_agent_id_idx" ON "task_submissions"("agent_id");
CREATE INDEX IF NOT EXISTS "task_submissions_status_idx" ON "task_submissions"("status");
CREATE INDEX IF NOT EXISTS "task_submissions_skill_name_idx" ON "task_submissions"("skill_name");
CREATE INDEX IF NOT EXISTS "task_submissions_created_at_idx" ON "task_submissions"("created_at");
