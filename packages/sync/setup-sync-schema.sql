-- setup-sync-schema.sql
-- Creates the tables required by @revealui/sync for ElectricSQL shape subscriptions.
-- Run once against your NeonDB PostgreSQL instance before enabling sync.
--
-- Prerequisites:
--   - PostgreSQL 14+ with uuid-ossp or pgcrypto extension
--   - ElectricSQL replication enabled on these tables

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- conversations — user ↔ agent conversation threads
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL,
  agent_id      TEXT NOT NULL,
  title         TEXT,
  status        TEXT NOT NULL DEFAULT 'active',
  device_id     TEXT,
  version       INTEGER NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations (user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_agent_id ON conversations (agent_id);

-- ---------------------------------------------------------------------------
-- agent_contexts — per-session context payloads for agents
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent_contexts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL,
  agent_id      TEXT NOT NULL,
  context       JSONB NOT NULL DEFAULT '{}',
  priority      INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_contexts_session_id ON agent_contexts (session_id);
CREATE INDEX IF NOT EXISTS idx_agent_contexts_agent_id ON agent_contexts (agent_id);

-- ---------------------------------------------------------------------------
-- agent_memories — persistent agent memory entries
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent_memories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id      TEXT NOT NULL,
  content       TEXT NOT NULL,
  type          TEXT NOT NULL,
  source        JSONB NOT NULL DEFAULT '{}',
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agent_memories_agent_id ON agent_memories (agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_memories_type ON agent_memories (type);

-- ---------------------------------------------------------------------------
-- coordination_sessions — active agent coordination sessions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS coordination_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id      TEXT NOT NULL,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at      TIMESTAMPTZ,
  task          TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'active',
  pid           INTEGER,
  tools         JSONB,
  metadata      JSONB
);

CREATE INDEX IF NOT EXISTS idx_coordination_sessions_agent_id ON coordination_sessions (agent_id);
CREATE INDEX IF NOT EXISTS idx_coordination_sessions_status ON coordination_sessions (status);

-- ---------------------------------------------------------------------------
-- coordination_work_items — work items assigned to agents
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS coordination_work_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  description     TEXT,
  status          TEXT NOT NULL DEFAULT 'pending',
  priority        INTEGER NOT NULL DEFAULT 0,
  owner_agent     TEXT,
  owner_session   UUID,
  parent_id       UUID REFERENCES coordination_work_items(id) ON DELETE SET NULL,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_coordination_work_items_status ON coordination_work_items (status);
CREATE INDEX IF NOT EXISTS idx_coordination_work_items_owner ON coordination_work_items (owner_agent);
CREATE INDEX IF NOT EXISTS idx_coordination_work_items_parent ON coordination_work_items (parent_id);

-- ---------------------------------------------------------------------------
-- yjs_documents — Yjs document state snapshots for collab
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS yjs_documents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id       UUID NOT NULL UNIQUE,
  state             BYTEA,
  connected_clients INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_yjs_documents_document_id ON yjs_documents (document_id);
