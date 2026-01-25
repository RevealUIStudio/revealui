# Deprecated Type Packages Removal

## Summary
Removed deprecated `@types/bcryptjs` and `@types/uuid` packages as they are redundant - both `bcryptjs` and `uuid` packages include their own TypeScript type definitions.

## Changes Made

### Removed Packages
1. **@types/bcryptjs** - Removed from `packages/core/package.json`
   - `bcryptjs@3.0.3` includes its own types in `index.d.ts` and `types.d.ts`
   - Used in:
     - `packages/core/src/core/instance/RevealUIInstance.ts` (password comparison)
     - `packages/core/src/core/collections/CollectionOperations.ts` (password hashing)

2. **@types/uuid** - Removed from:
   - `apps/cms/package.json`
   - `packages/memory/package.json`
   - `uuid@13.0.0` includes its own types in `dist/` directory
   - Used in multiple locations across the codebase

### Verification
- ✅ Both `bcryptjs` and `uuid` packages include built-in TypeScript definitions
- ✅ TypeScript compilation works without the `@types/*` packages
- ✅ No breaking changes to existing code

## Notes
- The packages themselves (`bcryptjs` and `uuid`) remain as dependencies
- Only the redundant type definition packages were removed
- This aligns with modern TypeScript best practices where packages include their own types

## Related Documentation

- [Package Merge Migration Guide](./PACKAGE_MERGE_MIGRATION_GUIDE.md) - Package merge guide
- [Breaking Changes - CRDT](./BREAKING-CHANGES-CRDT.md) - CRDT breaking changes
- [Type Generation Guide](../reference/database/TYPE_GENERATION_GUIDE.md) - Type generation
- [Database Types Reference](../reference/database/DATABASE_TYPES_REFERENCE.md) - Type definitions
- [Master Index](../INDEX.md) - Complete documentation index
- [Task-Based Guide](../INDEX.md) - Find docs by task
