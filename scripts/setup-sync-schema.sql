-- =============================================================================
-- ElectricSQL Sync Schema Bootstrap
-- Creates tables required for real-time sync via ElectricSQL.
-- Run via: pnpm tsx scripts/setup/setup-sync-schema.ts
-- =============================================================================

-- Enable pgvector if not already enabled (needed for embedding columns)
CREATE EXTENSION IF NOT EXISTS vector;

-- -----------------------------------------------------------------------------
-- conversations
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversations (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_id      TEXT NOT NULL,
  title         TEXT,
  status        TEXT NOT NULL DEFAULT 'active',
  device_id     TEXT,
  last_synced_at TIMESTAMPTZ,
  version       INTEGER NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- messages
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL,
  content         TEXT NOT NULL,
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- agent_contexts
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent_contexts (
  id          TEXT PRIMARY KEY,
  version     INTEGER NOT NULL DEFAULT 1,
  session_id  TEXT NOT NULL,
  agent_id    TEXT NOT NULL,
  context     JSONB DEFAULT '{}',
  priority    REAL DEFAULT 0.5,
  embedding   vector(768),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- agent_memories
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent_memories (
  id                  TEXT PRIMARY KEY,
  version             INTEGER NOT NULL DEFAULT 1,
  content             TEXT NOT NULL,
  type                TEXT NOT NULL,
  source              JSONB NOT NULL,
  embedding           vector(768),
  embedding_metadata  JSONB,
  metadata            JSONB DEFAULT '{}',
  access_count        INTEGER DEFAULT 0,
  accessed_at         TIMESTAMPTZ,
  verified            BOOLEAN DEFAULT false,
  verified_by         TEXT REFERENCES users(id) ON DELETE SET NULL,
  verified_at         TIMESTAMPTZ,
  site_id             TEXT REFERENCES sites(id) ON DELETE CASCADE,
  agent_id            TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at          TIMESTAMPTZ
);

-- -----------------------------------------------------------------------------
-- yjs_documents (collab persistence)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS yjs_documents (
  id                TEXT PRIMARY KEY,
  state             BYTEA NOT NULL,
  state_vector      BYTEA,
  connected_clients INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- collab_edits (provenance log)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS collab_edits (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   TEXT NOT NULL REFERENCES yjs_documents(id) ON DELETE CASCADE,
  client_type   TEXT NOT NULL,
  client_id     TEXT NOT NULL,
  client_name   TEXT NOT NULL,
  agent_model   TEXT,
  update_data   BYTEA NOT NULL,
  update_size   INTEGER NOT NULL,
  timestamp     TIMESTAMPTZ NOT NULL DEFAULT now()
);
