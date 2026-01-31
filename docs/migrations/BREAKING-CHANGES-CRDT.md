# Breaking Changes: CRDT Fixes

**Version**: 0.2.0  
**Date**: January 2025  
**Migration Required**: Yes

## Summary

This update fixes critical issues in the CRDT implementation:
- Node ID collision risk (HIGH)
- Embedding data loss (MEDIUM)
- Missing test coverage (MEDIUM)

## Schema Changes

### New Table: `node_id_mappings`

**Impact**: New table, no breaking changes to existing code.

**Migration**: Required - run `pnpm --filter @revealui/db db:generate && pnpm --filter @revealui/db db:migrate`

### New Column: `agent_memories.embedding_metadata`

**Impact**: New nullable column, backward compatible.

**Migration**: Required - same as above.

## API Changes

### Node ID Generation

**Before**:
```typescript
const nodeId = getNodeIdFromSession(sessionId) // Synchronous, simple hash
```

**After**:
```typescript
const nodeId = await getNodeIdFromSession(sessionId, db) // Async, SHA-256 + DB
```

**Breaking**: Yes - functions are now async.

**Migration**: Update all call sites to use `await`:

```typescript
// Before
const nodeId = getNodeIdFromSession(sessionId)

// After
const nodeId = await getNodeIdFromSession(sessionId, db)
```

### Embedding Storage

**Before**:
- Only vector stored in `embedding` column
- Metadata (model, dimension, generatedAt) lost

**After**:
- Vector stored in `embedding` column
- Full Embedding object stored in `embedding_metadata` column
- Metadata preserved

**Breaking**: No - backward compatible. Old records still work.

## Behavior Changes

### Node ID Determinism

**Before**: Node IDs could collide (first 8 chars of UUID)

**After**: Node IDs are collision-resistant (SHA-256 + DB fallback)

**Impact**: Same entity always gets same node ID (improved determinism)

### Embedding Metadata

**Before**: Embedding metadata was lost on save

**After**: Full embedding metadata preserved

**Impact**: Can now access model, dimension, generatedAt from saved embeddings

## Migration Checklist

- [ ] Run database migration (`pnpm --filter @revealui/db db:generate && pnpm --filter @revealui/db db:migrate`)
- [ ] Update all `getNodeIdFromSession()` calls to use `await`
- [ ] Update all `getNodeIdFromUser()` calls to use `await`
- [ ] Verify node ID persistence works
- [ ] Verify embedding metadata is preserved
- [ ] Run tests: `pnpm --filter @revealui/memory test`
- [ ] Test API routes manually

## Rollback

If issues occur, rollback is possible:

1. Revert code changes
2. Drop new table/column (see migration guide)
3. Node IDs will regenerate (acceptable)
4. Embedding metadata will be lost (acceptable for rollback)

## Support

For migration issues, see:
- `docs/archive/migrations/crdt-fixes-migration.md` - Detailed migration steps (archived - for reference only)
- Test files in `packages/memory/__tests__/` - Examples of correct usage
