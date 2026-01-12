# CRDT Fixes Migration Guide

**Date**: January 2025  
**Status**: Required Migration  
**Breaking Changes**: None (backward compatible)

## Overview

This migration adds support for:
1. **Node ID persistence** - Deterministic, collision-resistant node IDs for CRDT operations
2. **Embedding metadata preservation** - Full embedding metadata (model, dimension, generatedAt) storage

## Database Changes

### 1. New Table: `node_id_mappings`

```sql
CREATE TABLE node_id_mappings (
  id TEXT PRIMARY KEY,                    -- SHA-256 hash of entityId
  entity_type TEXT NOT NULL,              -- 'session' or 'user'
  entity_id TEXT NOT NULL,                -- Original entity ID
  node_id TEXT NOT NULL UNIQUE,           -- Actual node ID (UUID)
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_node_id_mappings_entity ON node_id_mappings(entity_type, entity_id);
```

### 2. New Column: `agent_memories.embedding_metadata`

```sql
ALTER TABLE agent_memories 
ADD COLUMN embedding_metadata JSONB;
```

**Note**: This column is nullable for backward compatibility with existing records.

## Migration Steps

### Step 1: Generate Migration

```bash
cd packages/db
pnpm db:generate
```

This will create a new migration file in `packages/db/drizzle/`.

### Step 2: Review Migration

Review the generated SQL migration file to ensure:
- `node_id_mappings` table is created correctly
- `embedding_metadata` column is added as nullable JSONB
- Indexes are created for performance

### Step 3: Run Migration

**Development**:
```bash
pnpm db:push
```

**Production**:
```bash
pnpm db:migrate
```

### Step 4: Verify Migration

```sql
-- Check node_id_mappings table exists
SELECT COUNT(*) FROM node_id_mappings;

-- Check embedding_metadata column exists
SELECT embedding_metadata FROM agent_memories LIMIT 1;
```

## Backward Compatibility

### Node IDs

- **Old behavior**: Node IDs were generated using `slice(0, 8)` (collision-prone)
- **New behavior**: Node IDs use SHA-256 hash with database fallback
- **Migration**: No data migration needed - new node IDs will be generated on first use

### Embeddings

- **Old records**: Only `embedding` vector column populated
- **New records**: Both `embedding` (vector) and `embedding_metadata` (full object) populated
- **Loading**: Code automatically reconstructs embedding metadata from vector for old records

## Rollback Procedure

If you need to rollback:

```sql
-- Remove embedding_metadata column
ALTER TABLE agent_memories DROP COLUMN IF EXISTS embedding_metadata;

-- Drop node_id_mappings table
DROP TABLE IF EXISTS node_id_mappings;
```

**Note**: Rolling back will lose:
- Node ID mappings (will regenerate on next use)
- Embedding metadata (will reconstruct from vectors)

## Performance Impact

- **Node ID lookup**: < 10ms (SHA-256 hash is primary, DB only on collision)
- **Embedding storage**: Minimal (JSONB is efficient)
- **Query performance**: No impact (new columns are optional)

## Testing

After migration, verify:

1. **Node ID persistence**:
   ```typescript
   const nodeId1 = await getNodeIdFromSession('session-123')
   const nodeId2 = await getNodeIdFromSession('session-123')
   expect(nodeId1).toBe(nodeId2) // Should be deterministic
   ```

2. **Embedding metadata**:
   ```typescript
   const memory = await episodicMemory.get('mem-1')
   expect(memory.embedding?.model).toBeDefined()
   expect(memory.embedding?.dimension).toBeDefined()
   expect(memory.embedding?.generatedAt).toBeDefined()
   ```

## Support

For issues during migration, check:
- Database connection string is correct
- pgvector extension is enabled (for vector column)
- Sufficient database permissions (CREATE TABLE, ALTER TABLE)
