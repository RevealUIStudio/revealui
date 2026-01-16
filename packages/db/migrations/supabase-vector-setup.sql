-- Supabase Vector Database Setup
-- This migration sets up the agent_memories table in Supabase with pgvector support
-- Run this migration on your Supabase database (DATABASE_URL)

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create agent_memories table (matches NeonDB schema structure)
-- Note: Foreign key constraints are optional since this is a separate database
CREATE TABLE IF NOT EXISTS agent_memories (
  id TEXT PRIMARY KEY,
  version INTEGER NOT NULL DEFAULT 1,
  content TEXT NOT NULL,
  type TEXT NOT NULL,
  source JSONB NOT NULL,
  embedding vector(1536),
  embedding_metadata JSONB,
  metadata JSONB DEFAULT '{}',
  access_count INTEGER DEFAULT 0,
  accessed_at TIMESTAMPTZ,
  verified BOOLEAN DEFAULT false,
  verified_by TEXT,
  verified_at TIMESTAMPTZ,
  site_id TEXT,
  agent_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMPTZ
);

-- Create HNSW index for fast similarity search
-- HNSW (Hierarchical Navigable Small World) is optimized for vector similarity queries
-- vector_cosine_ops uses cosine distance (good for embeddings)
CREATE INDEX IF NOT EXISTS agent_memories_embedding_idx 
ON agent_memories 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Create indexes for filtering
CREATE INDEX IF NOT EXISTS agent_memories_site_id_idx ON agent_memories(site_id);
CREATE INDEX IF NOT EXISTS agent_memories_agent_id_idx ON agent_memories(agent_id);
CREATE INDEX IF NOT EXISTS agent_memories_type_idx ON agent_memories(type);
CREATE INDEX IF NOT EXISTS agent_memories_created_at_idx ON agent_memories(created_at);

-- Create composite index for common query patterns (site + agent filtering)
CREATE INDEX IF NOT EXISTS agent_memories_site_agent_idx ON agent_memories(site_id, agent_id) WHERE site_id IS NOT NULL AND agent_id IS NOT NULL;

-- Add comments for documentation
COMMENT ON TABLE agent_memories IS 'Long-term agent memories with vector embeddings for semantic search. Stored in Supabase for optimized vector operations.';
COMMENT ON COLUMN agent_memories.embedding IS 'Vector embedding (1536 dimensions) for semantic similarity search using pgvector';
COMMENT ON INDEX agent_memories_embedding_idx IS 'HNSW index for fast vector similarity search using cosine distance';