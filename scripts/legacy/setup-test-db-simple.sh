#!/bin/bash
# Simple Test Database Setup
# Creates tables directly via Docker exec (bypasses migration script issues)

set -e

echo "=========================================="
echo "Simple Test Database Setup"
echo "=========================================="

# Check if database is running
if ! docker compose -f docker-compose.test.yml ps | grep -q "Up"; then
    echo "Starting test database..."
    docker compose -f docker-compose.test.yml up -d
    sleep 5
fi

export POSTGRES_URL="postgresql://test:test@localhost:5433/test_revealui"

echo "Creating tables..."

# Enable pgvector extension and create tables
docker compose -f docker-compose.test.yml exec -T postgres-test psql -U test -d test_revealui <<EOF
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create node_id_mappings table
CREATE TABLE IF NOT EXISTS node_id_mappings (
    id text PRIMARY KEY NOT NULL,
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    node_id text NOT NULL UNIQUE,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create agent_memories table
CREATE TABLE IF NOT EXISTS agent_memories (
    id text PRIMARY KEY NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    content text NOT NULL,
    type text NOT NULL,
    source jsonb NOT NULL,
    embedding vector(1536),
    embedding_metadata jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    access_count integer DEFAULT 0,
    accessed_at timestamp with time zone,
    verified boolean DEFAULT false,
    verified_by text,
    verified_at timestamp with time zone,
    site_id text,
    agent_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone
);

-- Add embedding_metadata column if it doesn't exist (for existing tables)
DO \$\$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'agent_memories'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'agent_memories' 
        AND column_name = 'embedding_metadata'
    ) THEN
        ALTER TABLE agent_memories ADD COLUMN embedding_metadata jsonb;
    END IF;
END \$\$;
EOF

echo ""
echo "=========================================="
echo "✅ Test database setup complete!"
echo "=========================================="
echo "Database URL: $POSTGRES_URL"
echo ""
echo "Tables created:"
echo "  - node_id_mappings"
echo "  - agent_memories (with embedding_metadata)"
echo ""
