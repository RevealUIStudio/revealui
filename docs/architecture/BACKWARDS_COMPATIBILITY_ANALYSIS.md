# Backwards Compatibility & Legacy Code Analysis

**Generated:** 2025-01-27  
**Purpose:** Comprehensive catalog of all backwards compatibility and legacy code/configuration in the codebase

---

## Summary

This document catalogs all occurrences of backwards compatibility support, legacy code, deprecated functionality, and migration-related code in the RevealUI codebase.

---

## 1. Policy Documents

### Legacy Code Removal Policy
- **Location**: `.cursor/LEGACY-CODE-REMOVAL-POLICY.md`
- **Status**: Active policy enforcing immediate removal of legacy code
- **Key Points**:
  - No backward compatibility support allowed
  - Deprecated code must be removed immediately
  - No compatibility layers or adapters
  - All implementations must be current

### Agent Rules
- **Location**: `.cursor/AGENT-RULES.md`
- **References**: Rule #1 (Legacy Code Removal), Rule #2 (No Backward Compatibility)

---

## 2. Type System & Contracts

### Legacy Types File
- **Location**: `packages/core/src/core/types/legacy.ts`
- **Exports**: Internal types used by RevealUI CMS framework
- **Note**: Contains `RevealUITraverseFieldsArgs`, `RevealUITraverseFieldsResult` and other internal types

### Compatibility Layer
- **Location**: `packages/contracts/src/cms/compat.ts`
- **Purpose**: Adapter functions for CMS configuration compatibility
- **Functions**:
  - `toCMSCollectionConfig()` - Normalize RevealUI CollectionConfig for CMS compatibility
  - `fromCMSCollectionConfig()` - Convert CMS config to RevealUI config
  - `toCMSGlobalConfig()`, `fromCMSGlobalConfig()`
  - `toCMSConfig()` - Full config normalization

### Deprecated Type Exports

#### Core RevealUI Types
- **Location**: `packages/core/src/types/index.ts`
- **Status**: `@deprecated` - Use `@revealui/core/types` instead
- **Purpose**: Backward compatibility wrapper

#### CMS Types
- **Location**: `apps/cms/src/types/index.ts`
- **Status**: `@deprecated` - Use `@revealui/core/types` or `@revealui/core/types/cms` instead
- **Purpose**: Backward compatibility wrapper

---

## 3. Database & Client Compatibility

### Database Client Legacy API
- **Location**: `packages/db/src/client/index.ts`
- **Lines**: 167-206
- **Features**:
  - Supports legacy connection string API
  - Falls back to `process.env` for backward compatibility
  - Defaults to 'rest' type for backward compatibility
  - Allows both `DatabaseType | string` for legacy support

```typescript
// Legacy API: Still supported for backward compatibility
const db = getClient() // defaults to 'rest'
const db2 = getClient('postgresql://...') // uses provided connection string as 'rest'
```

### Database Core Re-exports
- **Location**: `packages/db/src/core/index.ts`
- **Purpose**: Re-exports both REST and Vector schemas for backward compatibility
- **Note**: Comment states "for backward compatibility"

### JSON Parsing Compatibility
- **Location**: `packages/core/src/core/utils/json-parsing.ts`
- **Line**: 77
- **Feature**: Deserializes other JSON strings "for backwards compatibility with non-JSON fields"

---

## 4. Configuration & Environment Variables

### Deprecated Environment Variables

#### REVEALUI_WHITELISTORIGINS
- **Status**: Deprecated
- **Replacement**: `REVEALUI_CORS_ORIGINS`
- **Locations**:
  - `.env.template` (line 110): Comment states "Legacy: REVEALUI_WHITELISTORIGINS (deprecated, use REVEALUI_CORS_ORIGINS)"
  - `packages/config/src/schema.ts` (line 55): Marked as deprecated
  - `packages/config/src/validator.ts` (line 42): Warning generated
  - `packages/config/src/modules/reveal.ts` (line 14): Deprecated field
  - `scripts/setup/validate-env.ts` (line 45): Still supported but deprecated

#### Supabase API Keys (Legacy Format)
- **Status**: Legacy format deprecated Nov 2025, but still supported
- **Locations**:
  - `scripts/mcp/mcp-supabase.ts` (lines 30, 85): Support both legacy and new formats
  - `docs/mcp/MCP_SETUP.md`: Documents legacy keys
  - `docs/mcp/MCP_FIXES_2025.md`: Explains migration from legacy to new keys
- **Legacy Format**: `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (JWT format)
- **New Format**: `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`

### Deprecated Config Validation
- **Location**: `packages/core/src/core/config/utils.ts`
- **Function**: `validateConfig()`
- **Status**: `@deprecated` - Use ConfigContract validation instead
- **Note**: "kept for backward compatibility but should not be used in new code"

### TypeScript Path Mappings (Legacy)
- **Location**: `apps/cms/tsconfig.json` (line 64)
- **Comment**: "Legacy paths for compatibility"
- **Path**: `"../revealui/src/*": ["../../packages/core/src/*"]`

---

## 5. Factory & Builder Functions

### createRevealUI Wrapper
- **Location**: `packages/core/src/core/factories/builders.ts` (line 18)
- **Status**: Wrapper around `createRevealUIInstance` for backward compatibility
- **Note**: Comment states "for backward compatibility"

---

## 6. Schema & Blocks Compatibility

### Schema Adapter
- **Location**: `apps/cms/src/lib/blocks/schema-adapter.ts`
- **Purpose**: "Adapter handles the transformation and validation of blocks to ensure type safety"
- **Related**: `apps/cms/src/lib/blocks/types.ts` - Type bridge/adapter for incremental migration

### Compat Tests
- **Locations**:
  - `packages/core/src/core/types/__tests__/payload-compat.test.ts`
  - `packages/core/src/core/types/__tests__/revealui-compat.test.ts`
  - `packages/contracts/src/__tests__/payload-compat.test.ts`
  - `packages/contracts/src/__tests__/revealui-compat.test.ts`

### Sync Package Compatibility
- **Location**: `packages/sync/src/schema/compat.ts`
- **Exported from**: `packages/sync/src/index.ts`

---

## 7. Memory & AI Compatibility

### Legacy Format Rejection
- **Location**: `packages/ai/src/memory/preferences/user-preferences-manager.ts` (line 235)
- **Comment**: "Per legacy code removal policy, we do not support legacy format"
- **Context**: CRDT format required, legacy format explicitly rejected

### Old Record Handling
- **Location**: `packages/ai/__tests__/episodic-memory-embedding.test.ts` (line 170)
- **Test**: "should throw error for old records without embeddingMetadata (data migration required)"

### Context Migration
- **Location**: `packages/ai/src/memory/agent/context-manager.ts` (lines 291-295)
- **Error Message**: "Data migration required. All contexts must use CRDT format."

---

## 8. Database Tables (Legacy Naming)

### Payload CMS Legacy Tables
- **References**: Multiple documentation files mention `payload_*` tables as legacy from Payload CMS
- **Locations**:
  - `docs/reference/database/DATABASE-MIGRATION-PLAN.md` (line 437)
  - `docs/reference/database/FRESH-DATABASE-SUMMARY.md` (line 82)
  - `docs/reference/database/FRESH-DATABASE-SETUP.md` (line 6)

### Migration Notes
- **Location**: `packages/test/src/integration/memory/dual-database.integration.test.ts` (lines 130, 145)
- **Comment**: "If this succeeds, the table might exist in both databases (legacy)"

---

## 9. Package Migration References

### Schema → Contracts Migration
- **Status**: Complete ✅
- **References**:
  - `docs/architecture/PACKAGE_ARCHITECTURE_MAP.md` - Describes `@revealui/schema` as "Legacy schema layer"
  - `packages/contracts/README.md` (line 129): "Migration from @revealui/schema (Complete ✅)"
  - `packages/core/src/core/types/index.ts` (line 371): Imports from `'./legacy.js'`

### Package Merge Migration
- **Documentation**: `docs/migrations/PACKAGE_MERGE_MIGRATION_GUIDE.md`
- **Note**: "The old packages are completely removed. There are no deprecated exports or backward compatibility layers."
- **Affected**: `@revealui/types` and `@revealui/generated` merged into `@revealui/core`

---

## 10. Documentation & Comments

### Migration Guides
- `docs/migrations/DEPRECATED-TYPES-REMOVAL.md`
- `docs/migrations/PACKAGE_MERGE_MIGRATION_GUIDE.md`
- `docs/development/MIGRATE-VERCEL-POSTGRES-TO-SUPABASE.md` - Migration from deprecated `@vercel/postgres` adapter
- `docs/reference/database/DATABASE-MIGRATION-PLAN.md`
- `packages/db/VERIFY-MIGRATION.md`

### Architecture References
- `docs/architecture/PACKAGE_ARCHITECTURE_MAP.md` - Multiple references to "legacy" schema layer
- `docs/architecture/CONTRACTS_MIGRATION_RESEARCH.md` - Notes "No backward compatibility needed"
- `docs/architecture/CONTRACTS_MIGRATION_FINAL_ASSESSMENT.md` - Mentions backward compatibility maintained

### Scripts Documentation
- `scripts/README.md` (line 131): "Migration from Legacy Scripts" - All legacy shell scripts migrated to TypeScript

---

## 11. Client UI Compatibility

### Legacy Options-Based Usage
- **Location**: `packages/core/src/client/ui/index.tsx` (line 90)
- **Comment**: "Legacy options-based usage"

---

## 12. Rich Text Adapter

### Type Definition
- **Location**: `packages/core/src/core/types/legacy.ts` (line 147)
- **Type**: `RevealUIRichTextAdapter` - Interface for rich text adapter
- **Also**: `packages/core/src/core/revealui.ts` (line 150) - Type alias

---

## 13. Database Type Adapter

### Type Adapter
- **Location**: `packages/core/src/core/database/type-adapter.ts`
- **Purpose**: "Adapter between Database types (from @revealui/db) and RevealUI types"
- **Note**: Ensures type safety at the boundary

---

## 14. MCP Adapter

### MCP Tool Adapter
- **Location**: `packages/ai/src/tools/mcp-adapter.ts`
- **Exported**: From `packages/ai/src/index.ts`

---

## 15. Test Utilities

### Legacy Script References
- **Locations**:
  - `scripts/validation/run-automated-validation.ts` (line 156): References `scripts/legacy/test-api-routes.sh`
  - `scripts/validation/validate-automation.ts` (lines 73-76, 91-95): Checks for legacy script locations

---

## 16. Version Compatibility

### Contract Versioning
- **Location**: `packages/contracts/src/foundation/contract.ts` (line 42)
- **Field**: `version?: string` - "Contract version for migration support"

---

## 17. Component References

### Legacy Component Names
- **Location**: `docs/reference/COMPONENT-MAPPING.md` (line 155)
- **Note**: "Previously named `PayloadRedirects` (legacy name from Payload CMS)"

---

## 18. Admin Page Comment

### Legacy Comment
- **Location**: `apps/cms/src/app/(backend)/admin/[[...segments]]/page.tsx` (line 28)
- **Comment**: `// /* RevealUI Admin Page - Legacy */`
- **Status**: Commented out

---

## 19. JSON Deserialization

### Backwards Compatibility Pattern
- **Location**: `packages/core/src/core/utils/json-parsing.ts` (lines 42, 77)
- **Note**: Deserializes JSON strings "for backwards compatibility with non-JSON fields"
- **Context**: Handles non-JSON fields that might have been stored as JSON strings

---

## 20. Client Config Types

### Internal Client Types
- **Location**: `packages/core/src/core/types/legacy.ts` (lines 74-120)
- **Types**: `ClientConfig`, `ClientCollectionConfig`, etc.
- **Note**: Marked as `@internal` - for CMS compatibility

---

## Summary Statistics

- **Total Legacy/Compatibility Files**: 130+ occurrences
- **Deprecated Functions/APIs**: 15+ instances
- **Compatibility Adapters**: 10+ files
- **Migration Documentation**: 10+ files
- **Legacy Environment Variables**: 2 (REVEALUI_WHITELISTORIGINS, Supabase legacy keys)
- **Policy Documents**: 2 active policies enforcing removal

---

## Recommendations

1. **Review Legacy Types**: `packages/core/src/core/types/legacy.ts` - Evaluate if still needed
2. **Database Client API**: Consider deprecating connection string API in favor of type-based API
3. **Environment Variables**: Remove `REVEALUI_WHITELISTORIGINS` support once migration is complete
4. **TypeScript Paths**: Remove legacy path mapping in `apps/cms/tsconfig.json`
5. **Config Validation**: Remove deprecated `validateConfig()` function
6. **Type Wrappers**: Remove deprecated type exports (`packages/core/src/types/index.ts`, `apps/cms/src/types/index.ts`)
7. **Factory Wrappers**: Evaluate if `createRevealUI` wrapper is still needed

---

## Notes

- **Policy Conflict**: The codebase has a strict "no backward compatibility" policy (`.cursor/LEGACY-CODE-REMOVAL-POLICY.md`), yet many compatibility layers and deprecated functions still exist
- **Migration Status**: Many migrations are marked as "complete" but legacy code still remains
- **Documentation**: Extensive migration documentation exists, indicating ongoing migration efforts
