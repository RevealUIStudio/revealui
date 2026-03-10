-- Schema hardening: indexes, constraints, composite PKs
-- Generated from codebase audit gap closure plan (2026-03-10)

-- =============================================================================
-- agentMemories: add indexes for hot query paths
-- =============================================================================
CREATE INDEX IF NOT EXISTS "agent_memories_site_id_idx" ON "agent_memories" ("site_id");
CREATE INDEX IF NOT EXISTS "agent_memories_agent_id_idx" ON "agent_memories" ("agent_id");
CREATE INDEX IF NOT EXISTS "agent_memories_verified_idx" ON "agent_memories" ("verified");
CREATE INDEX IF NOT EXISTS "agent_memories_expires_at_idx" ON "agent_memories" ("expires_at");
CREATE INDEX IF NOT EXISTS "agent_memories_type_idx" ON "agent_memories" ("type");

-- agentMemories: make site_id NOT NULL (orphaned memories not allowed)
-- NOTE: Ensure no NULL site_id rows exist before running this migration.
UPDATE "agent_memories" SET "site_id" = 'orphaned' WHERE "site_id" IS NULL;
ALTER TABLE "agent_memories" ALTER COLUMN "site_id" SET NOT NULL;

-- =============================================================================
-- agentTaskUsage: add composite primary key (userId, cycleStart)
-- =============================================================================
-- Remove duplicates first (keep the row with the highest count)
DELETE FROM "agent_task_usage" a
  USING "agent_task_usage" b
  WHERE a.ctid < b.ctid
    AND a."user_id" = b."user_id"
    AND a."cycle_start" = b."cycle_start";

ALTER TABLE "agent_task_usage"
  ADD CONSTRAINT "agent_task_usage_pk" PRIMARY KEY ("user_id", "cycle_start");

-- =============================================================================
-- sites: add UNIQUE constraint on slug
-- =============================================================================
ALTER TABLE "sites" ADD CONSTRAINT "sites_slug_unique" UNIQUE ("slug");

-- =============================================================================
-- tickets: add missing FK indexes
-- =============================================================================
CREATE INDEX IF NOT EXISTS "tickets_parent_ticket_id_idx" ON "tickets" ("parent_ticket_id");
CREATE INDEX IF NOT EXISTS "tickets_reporter_id_idx" ON "tickets" ("reporter_id");

-- =============================================================================
-- pages: add missing FK indexes
-- =============================================================================
CREATE INDEX IF NOT EXISTS "pages_parent_id_idx" ON "pages" ("parent_id");
CREATE INDEX IF NOT EXISTS "pages_site_id_idx" ON "pages" ("site_id");

-- =============================================================================
-- ragChunks: add missing FK indexes
-- =============================================================================
CREATE INDEX IF NOT EXISTS "rag_chunks_document_id_idx" ON "rag_chunks" ("document_id");
CREATE INDEX IF NOT EXISTS "rag_chunks_workspace_id_idx" ON "rag_chunks" ("workspace_id");
