-- Supabase Vector Database Fresh Schema Setup
-- This is the initial schema for the Supabase vector database (pre-production).
-- Run this to set up a fresh database with pgvector extension and agent_memories table.
--
-- For pre-production: Use this fresh setup script.
-- For post-production: Migrations will be added when features are added.
--
-- Usage: pnpm test:memory:setup

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
  embedding vector(768),
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

-- rag_chunks HNSW index for RAG vector similarity search
-- Without this, every RAG query does a full sequential scan on the embedding column
CREATE INDEX IF NOT EXISTS rag_chunks_embedding_idx
ON rag_chunks
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Add comments for documentation
COMMENT ON TABLE agent_memories IS 'Long-term agent memories with vector embeddings for semantic search. Stored in Supabase for optimized vector operations.';
COMMENT ON COLUMN agent_memories.embedding IS 'Vector embedding (768 dimensions, nomic-embed-text) for semantic similarity search using pgvector';
COMMENT ON INDEX agent_memories_embedding_idx IS 'HNSW index for fast vector similarity search using cosine distance';