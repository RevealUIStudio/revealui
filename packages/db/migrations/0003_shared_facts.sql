-- Layer 1: Shared Facts - Append-only agent discovery log
-- Multi-agent coordination via ElectricSQL shape subscriptions

CREATE TABLE IF NOT EXISTS "shared_facts" (
  "id" text PRIMARY KEY NOT NULL,
  "session_id" text NOT NULL,
  "agent_id" text NOT NULL,
  "content" text NOT NULL,
  "fact_type" text NOT NULL,
  "confidence" real NOT NULL DEFAULT 1.0,
  "tags" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "source_ref" jsonb,
  "superseded_by" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "shared_facts_fact_type_check" CHECK (fact_type IN ('discovery', 'bug', 'decision', 'warning', 'question', 'answer'))
);

CREATE INDEX IF NOT EXISTS "shared_facts_session_id_idx" ON "shared_facts" ("session_id");
CREATE INDEX IF NOT EXISTS "shared_facts_agent_id_idx" ON "shared_facts" ("agent_id");
CREATE INDEX IF NOT EXISTS "shared_facts_fact_type_idx" ON "shared_facts" ("fact_type");
CREATE INDEX IF NOT EXISTS "shared_facts_created_at_idx" ON "shared_facts" ("created_at");
