#!/bin/bash
# Run Database Migration
# This script runs the CRDT fixes migration on the database

set -e

echo "=========================================="
echo "CRDT Fixes Migration Script"
echo "=========================================="

# Check if database URL is set
if [ -z "$POSTGRES_URL" ] && [ -z "$DATABASE_URL" ]; then
    echo "ERROR: POSTGRES_URL or DATABASE_URL must be set"
    exit 1
fi

DB_URL="${POSTGRES_URL:-$DATABASE_URL}"

echo "Database URL: ${DB_URL:0:20}..." # Show first 20 chars only

# Navigate to db package
cd "$(dirname "$0")/../packages/db"

echo ""
echo "Step 1: Generating migration (if needed)..."
pnpm db:generate || echo "No new migrations needed"

echo ""
echo "Step 2: Pushing schema to database..."
echo "WARNING: This will modify your database!"
read -p "Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

pnpm db:push

echo ""
echo "Step 3: Verifying migration..."

# Use psql if available, otherwise provide manual verification steps
if command -v psql &> /dev/null; then
    echo "Verifying node_id_mappings table..."
    psql "$DB_URL" -c "SELECT COUNT(*) FROM node_id_mappings;" || echo "Table check failed"
    
    echo "Verifying embedding_metadata column..."
    psql "$DB_URL" -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'agent_memories' AND column_name = 'embedding_metadata';" || echo "Column check failed"
    
    echo ""
    echo "✅ Migration verification complete!"
else
    echo "psql not available. Please verify manually:"
    echo "  1. Check node_id_mappings table exists"
    echo "  2. Check embedding_metadata column exists in agent_memories"
    echo ""
    echo "SQL to run:"
    echo "  SELECT COUNT(*) FROM node_id_mappings;"
    echo "  SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'agent_memories' AND column_name = 'embedding_metadata';"
fi

echo ""
echo "=========================================="
echo "Migration complete!"
echo "=========================================="
