-- Layer 3: Shared Memory Scope - Extend agent_memories for multi-agent sharing
-- Adds scope (private/shared/reconciled), session binding, and reconciliation tracking

ALTER TABLE "agent_memories" ADD COLUMN IF NOT EXISTS "scope" text NOT NULL DEFAULT 'private';
ALTER TABLE "agent_memories" ADD COLUMN IF NOT EXISTS "session_scope" text;
ALTER TABLE "agent_memories" ADD COLUMN IF NOT EXISTS "source_facts" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "agent_memories" ADD COLUMN IF NOT EXISTS "reconciled_at" timestamp with time zone;

ALTER TABLE "agent_memories" ADD CONSTRAINT "agent_memories_scope_check"
  CHECK (scope IN ('private', 'shared', 'reconciled'));

CREATE INDEX IF NOT EXISTS "agent_memories_scope_idx" ON "agent_memories" ("scope");
CREATE INDEX IF NOT EXISTS "agent_memories_session_scope_idx" ON "agent_memories" ("session_scope");
