# Migration Verification Checklist

**Migration File**: `drizzle/0000_misty_pepper_potts.sql`  
**Date**: January 2025  
**Status**: Ready for Testing

## Pre-Migration Verification

### ✅ SQL Syntax Check
- [x] `node_id_mappings` table definition is correct
- [x] `embedding_metadata` column is nullable JSONB
- [x] All constraints are properly defined
- [x] No syntax errors in SQL file

### Migration Contents Verified

1. **`node_id_mappings` table** (lines 234-242):
   - ✅ Primary key: `id` (TEXT)
   - ✅ `entity_type` (TEXT NOT NULL)
   - ✅ `entity_id` (TEXT NOT NULL)
   - ✅ `node_id` (TEXT NOT NULL UNIQUE)
   - ✅ Timestamps with timezone
   - ✅ Unique constraint on `node_id`

2. **`embedding_metadata` column** (line 127):
   - ✅ Added to `agent_memories` table
   - ✅ Type: JSONB (nullable)
   - ✅ No default value (backward compatible)

## Testing Steps

### 1. Test Migration on Development Database

```bash
cd packages/db
pnpm db:push
```

**Expected Result**: Migration applies successfully without errors

### 2. Verify Tables Created

```sql
-- Check node_id_mappings table exists
SELECT COUNT(*) FROM node_id_mappings;
-- Expected: 0 (empty table)

-- Check table structure
\d node_id_mappings
-- Expected: Shows all columns with correct types
```

### 3. Verify Column Added

```sql
-- Check embedding_metadata column exists
SELECT embedding_metadata FROM agent_memories LIMIT 1;
-- Expected: NULL for existing records (backward compatible)

-- Check column type
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'agent_memories' 
  AND column_name = 'embedding_metadata';
-- Expected: embedding_metadata | jsonb | YES
```

### 4. Test Backward Compatibility

```sql
-- Insert old-style record (without embedding_metadata)
INSERT INTO agent_memories (
  id, version, content, type, source, embedding
) VALUES (
  'test-1', 1, 'Test memory', 'fact', 
  '{"type": "user", "id": "user-1", "confidence": 1}'::jsonb,
  ARRAY[0.1, 0.2, 0.3]::vector(1536)
);

-- Verify it works
SELECT id, embedding, embedding_metadata FROM agent_memories WHERE id = 'test-1';
-- Expected: embedding has vector, embedding_metadata is NULL
```

### 5. Test New Records

```sql
-- Insert new-style record (with embedding_metadata)
INSERT INTO agent_memories (
  id, version, content, type, source, embedding, embedding_metadata
) VALUES (
  'test-2', 1, 'Test memory', 'fact',
  '{"type": "user", "id": "user-1", "confidence": 1}'::jsonb,
  ARRAY[0.1, 0.2, 0.3]::vector(1536),
  '{"model": "openai-text-embedding-3-small", "dimension": 1536, "generatedAt": "2025-01-01T00:00:00Z"}'::jsonb
);

-- Verify it works
SELECT id, embedding, embedding_metadata FROM agent_memories WHERE id = 'test-2';
-- Expected: Both embedding and embedding_metadata populated
```

### 6. Test Node ID Mapping

```sql
-- Insert test mapping
INSERT INTO node_id_mappings (
  id, entity_type, entity_id, node_id
) VALUES (
  'hash-123', 'session', 'session-123', 'node-uuid-123'
);

-- Verify unique constraint works
INSERT INTO node_id_mappings (
  id, entity_type, entity_id, node_id
) VALUES (
  'hash-456', 'user', 'user-456', 'node-uuid-123'
);
-- Expected: ERROR (duplicate node_id violates unique constraint)

-- Verify lookup works
SELECT * FROM node_id_mappings WHERE id = 'hash-123';
-- Expected: Returns the mapping
```

## Rollback Test (Optional)

If issues occur, test rollback:

```sql
-- Remove embedding_metadata column
ALTER TABLE agent_memories DROP COLUMN IF EXISTS embedding_metadata;

-- Drop node_id_mappings table
DROP TABLE IF EXISTS node_id_mappings;
```

**Note**: This will lose data, only use for testing.

## Performance Verification

After migration, verify performance:

```sql
-- Test node ID lookup performance
EXPLAIN ANALYZE
SELECT node_id FROM node_id_mappings WHERE id = 'hash-123';
-- Expected: Index scan, < 1ms

-- Test embedding query performance
EXPLAIN ANALYZE
SELECT embedding_metadata FROM agent_memories WHERE id = 'test-2';
-- Expected: Index scan, < 1ms
```

## Success Criteria

- [ ] Migration runs without errors
- [ ] `node_id_mappings` table exists and is accessible
- [ ] `embedding_metadata` column exists and is nullable
- [ ] Old records (without `embedding_metadata`) still work
- [ ] New records (with `embedding_metadata`) work correctly
- [ ] Node ID mappings can be inserted and queried
- [ ] Unique constraint on `node_id` works
- [ ] Performance is acceptable (< 10ms for lookups)

## Next Steps After Verification

1. ✅ Document any issues found
2. ✅ Update migration guide if needed
3. ✅ Test application code with migrated database
4. ✅ Verify backward compatibility in code works
5. ✅ Run full test suite against migrated database
