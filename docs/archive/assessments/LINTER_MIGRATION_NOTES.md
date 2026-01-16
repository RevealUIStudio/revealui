# ESLint to Biome Migration Notes

**Date**: 2025-01-16  
**Status**: Root ESLint config removed, migration in progress

---

## Current State

- **Root**: Uses Biome for formatting (`format`, `lint:fix` scripts)
- **Root eslint.config.js**: ✅ **REMOVED** (was importing from packages/dev but not actively used)
- **Individual packages**: Still use ESLint (apps/cms, apps/web, packages/dev)

## Action Taken

Removed `eslint.config.js` from project root because:
1. Root uses Biome for linting/formatting (`biome check`, `biome format`)
2. Root `lint` script uses `turbo run lint` which delegates to packages
3. The root config was not actively used

## Migration Path

### Option 1: Complete Migration to Biome (Recommended)
- Migrate `apps/cms` and `apps/web` from ESLint to Biome
- Remove ESLint configs from individual packages
- Remove ESLint dependencies
- Benefit: Single tool, faster, simpler configuration

### Option 2: Hybrid Approach (Current)
- Root uses Biome for formatting
- Individual packages keep ESLint for type-aware linting
- Benefit: Keeps type-aware ESLint rules (which are valuable)

## Recommendation

**Keep hybrid approach for now**, but migrate to Biome long-term:
- ESLint type-aware rules are valuable for TypeScript safety
- Biome is improving TypeScript support
- Can migrate gradually package by package

## Next Steps

1. ✅ Root ESLint config removed
2. ⏳ Evaluate Biome's TypeScript/type-aware rule support
3. ⏳ If sufficient, migrate individual packages to Biome
4. ⏳ Remove ESLint dependencies once migration complete

---

**Note**: This is a non-breaking change. Individual packages still have their ESLint configs and can continue using them.
