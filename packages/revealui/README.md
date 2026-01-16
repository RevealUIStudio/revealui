# `@revealui/core`

The core RevealUI framework package containing types, generated code, and framework functionality.

📚 [Docs](https://revealui.com)  
⚙️  [Source code](https://github.com/RevealUIStudio/revealui/tree/main/packages/revealui)  
📦 [npm package](https://npmjs.com/package/revealui)

## Package Structure

This package consolidates:
- **Types**: All RevealUI types (previously `@revealui/types`)
- **Generated Code**: Auto-generated types, components, hooks, etc. (previously `@revealui/generated`)
- **Core Framework**: Main framework functionality

## Import Paths

### Types

```typescript
// Unified types export
import type { Config, Page, Post } from '@revealui/core/types'

// Specific type categories
import type { Post } from '@revealui/core/types/cms'
import type { User } from '@revealui/core/types/schema'
import type { RevealConfig } from '@revealui/core/types/core'
```

### Generated Code

```typescript
// Generated components
import { PostCard } from '@revealui/core/generated/components'

// Generated hooks
import { usePost } from '@revealui/core/generated/hooks'

// Generated types
import type { Config } from '@revealui/core/generated/types/cms'
import type { Database } from '@revealui/core/generated/types/supabase'
```

## Migration

If you're migrating from `@revealui/types` or `@revealui/generated`, see the [Migration Guide](../../docs/migrations/PACKAGE_MERGE_MIGRATION_GUIDE.md).

## Available Exports

See [package.json](./package.json) for the complete list of export paths.  
