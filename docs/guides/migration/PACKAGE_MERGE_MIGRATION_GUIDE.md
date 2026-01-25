# Package Merge Migration Guide

**Date**: 2025-01-27  
**Migration**: `@revealui/types` + `@revealui/generated` → `@revealui/core`

## Overview

The `@revealui/types` and `@revealui/generated` packages have been merged into `@revealui/core` to simplify the framework structure and reduce package count from 13 to 11.

## What Changed

### Packages Removed
- ❌ `@revealui/types` - Merged into `@revealui/core/types`
- ❌ `@revealui/generated` - Merged into `@revealui/core/generated`

### New Import Paths

All types and generated code are now available from `@revealui/core`:

#### Types

**Before:**
```typescript
import type { Config, Page, Post } from '@revealui/types'
import type { Config } from '@revealui/types/cms'
import type { RevealConfig } from '@revealui/types/core'
import type { Page, User } from '@revealui/types/schema'
import type { Database } from '@revealui/types/generated'
```

**After:**
```typescript
import type { Config, Page, Post } from '@revealui/core/types'
import type { Config } from '@revealui/core/types/cms'
import type { RevealConfig } from '@revealui/core/types/core'
import type { Page, User } from '@revealui/core/types/schema'
import type { Database } from '@revealui/core/types/generated'
```

#### Generated Code

**Before:**
```typescript
import { GeneratedComponent } from '@revealui/generated/components'
import { useGeneratedHook } from '@revealui/generated/hooks'
import type { Config } from '@revealui/generated/types/cms'
import type { Database } from '@revealui/generated/types/supabase'
```

**After:**
```typescript
import { GeneratedComponent } from '@revealui/core/generated/components'
import { useGeneratedHook } from '@revealui/core/generated/hooks'
import type { Config } from '@revealui/core/generated/types/cms'
import type { Database } from '@revealui/core/generated/types/supabase'
```

## Migration Steps

### 1. Update Package Dependencies

Remove the old packages from your `package.json`:

```json
{
  "dependencies": {
    // Remove these:
    // "@revealui/types": "workspace:*",
    // "@revealui/generated": "workspace:*",
    
    // Keep or add:
    "@revealui/core": "workspace:*"
  }
}
```

### 2. Update Import Statements

#### Automated Migration (Recommended)

Use find-and-replace in your codebase:

**Find:**
- `from '@revealui/types'` → `from '@revealui/core/types'`
- `from '@revealui/types/` → `from '@revealui/core/types/`
- `from '@revealui/generated'` → `from '@revealui/core/generated'`
- `from '@revealui/generated/` → `from '@revealui/core/generated/`

**Replace:**
- `from '@revealui/core/types'`
- `from '@revealui/core/types/`
- `from '@revealui/core/generated'`
- `from '@revealui/core/generated/`

#### Manual Migration

Update each import statement:

```typescript
// Old
import type { Post } from '@revealui/types/cms'
import { MyComponent } from '@revealui/generated/components'

// New
import type { Post } from '@revealui/core/types/cms'
import { MyComponent } from '@revealui/core/generated/components'
```

### 3. Update TypeScript Path Mappings

If you have custom path mappings in `tsconfig.json`, update them:

```json
{
  "compilerOptions": {
    "paths": {
      // Remove these:
      // "@revealui/types/*": ["../../packages/types/src/*"],
      // "@revealui/generated/*": ["../../packages/generated/src/*"],
      
      // Add or update:
      "@revealui/core/types/*": ["../../packages/core/src/core/types/*"],
      "@revealui/core/generated/*": ["../../packages/core/src/core/generated/*"]
    }
  }
}
```

### 4. Verify Build

After updating imports, verify everything compiles:

```bash
pnpm build
pnpm typecheck
```

## Available Export Paths

### Types (`@revealui/core/types`)

- `@revealui/core/types` - Unified export (all types)
- `@revealui/core/types/core` - Core framework types only
- `@revealui/core/types/schema` - Schema contract types only
- `@revealui/core/types/generated` - Generated types (CMS, Supabase)
- `@revealui/core/types/cms` - CMS-specific types
- `@revealui/core/types/frontend` - Frontend-specific types

### Generated Code (`@revealui/core/generated`)

- `@revealui/core/generated` - Main generated export
- `@revealui/core/generated/types` - All generated types
- `@revealui/core/generated/types/cms` - CMS generated types
- `@revealui/core/generated/types/supabase` - Supabase types
- `@revealui/core/generated/types/neon` - NeonDB types
- `@revealui/core/generated/components` - Generated components
- `@revealui/core/generated/hooks` - Generated hooks
- `@revealui/core/generated/functions` - Generated functions
- `@revealui/core/generated/prompts` - Generated prompts
- `@revealui/core/generated/plans` - Generated plans
- `@revealui/core/generated/agents` - Generated agents
- `@revealui/core/generated/tools` - Generated tools

## Common Patterns

### Importing Collection Types

```typescript
// Unified import (recommended)
import type { Post, Page, User } from '@revealui/core/types'

// CMS-specific types
import type { Post, Page } from '@revealui/core/types/cms'

// Schema types
import type { User, Site } from '@revealui/core/types/schema'
```

### Importing Generated Components

```typescript
import { PostCard, PageHeader } from '@revealui/core/generated/components'
```

### Importing Database Types

```typescript
// Supabase
import type { Database } from '@revealui/core/generated/types/supabase'

// NeonDB
import type { Database } from '@revealui/core/generated/types/neon'

// Or use namespace to avoid conflicts
import { SupabaseNS, NeonNS } from '@revealui/core/generated/types'
type SupabaseDB = SupabaseNS.Database
type NeonDB = NeonNS.Database
```

## Breaking Changes

### Removed Packages

- `@revealui/types` - **No longer available**
- `@revealui/generated` - **No longer available**

### Deprecated Exports

The old packages are completely removed. There are no deprecated exports or backward compatibility layers.

## Troubleshooting

### "Cannot find module '@revealui/types'"

**Solution**: Update the import to use `@revealui/core/types` instead.

### "Cannot find module '@revealui/generated'"

**Solution**: Update the import to use `@revealui/core/generated` instead.

### Type Conflicts

If you encounter type conflicts (e.g., multiple `Database` types), use namespace imports:

```typescript
import { SupabaseNS, NeonNS } from '@revealui/core/generated/types'
// Or use aliases:
import type { Database as SupabaseDatabase } from '@revealui/core/generated/types/supabase'
import type { Database as NeonDatabase } from '@revealui/core/generated/types/neon'
```

## Verification Checklist

- [ ] Removed `@revealui/types` from `package.json`
- [ ] Removed `@revealui/generated` from `package.json`
- [ ] Updated all import statements
- [ ] Updated `tsconfig.json` path mappings (if any)
- [ ] Verified build succeeds (`pnpm build`)
- [ ] Verified type checking passes (`pnpm typecheck`)
- [ ] Verified tests pass (`pnpm test`)

## Need Help?

If you encounter issues during migration:

1. Check the [Type System Reference](./reference/TYPE_SYSTEM_REFERENCE.md)
2. Review the [Package Structure Guide](../development/PACKAGE_STRUCTURE.md)
3. Open an issue on GitHub

## Related Documentation

- [Package Merge Assessment](../assessments/PACKAGE_MERGE_ASSESSMENT.md) - Package merge analysis
- [Package Merge Implementation Assessment](../assessments/PACKAGE_MERGE_IMPLEMENTATION_ASSESSMENT.md) - Implementation review
- [Type Generation Guide](../reference/database/TYPE_GENERATION_GUIDE.md) - Generate types from schema
- [Package Conventions](../../packages/PACKAGE-CONVENTIONS.md) - Package structure and conventions
- [Status Dashboard](../STATUS.md) - Current project state
- [Master Index](../INDEX.md) - Complete documentation index
- [Task-Based Guide](../INDEX.md) - Find docs by task

---

**Migration Date**: 2025-01-27  
**Status**: ✅ Complete
