-- Add CRDT metadata columns for MCP tables
ALTER TABLE IF EXISTS documents
  ADD COLUMN IF NOT EXISTS _electric_meta jsonb DEFAULT '{}'::jsonb;

ALTER TABLE IF EXISTS subscription_state
  ADD COLUMN IF NOT EXISTS _electric_meta jsonb DEFAULT '{}'::jsonb;

-- Add more tables here as needed
