# Type System Migration Guide

## Overview

RevealUI v2.0 introduces a hybrid type system that combines:
- **Zod schemas** for runtime structure validation
- **TypeScript types** for compile-time function signature checking

This guide explains the changes and how to migrate existing code.

## What Changed

### Before (v1.x)
- All types defined manually in `types/index.ts`
- No runtime validation
- Function types were loosely typed or `any`
- Hook types didn't support generics

### After (v2.0)
- Structure types derived from Zod schemas
- Function types use TypeScript generics
- Runtime validation available at config boundaries
- Full PayloadCMS compatibility
- Extensibility support for custom field types

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    @revealui/cms                         │
│  (re-exports from both sources for backward compat)     │
└───────────────────────┬─────────────────────────────────┘
                        │
        ┌───────────────┴───────────────┐
        │                               │
┌───────▼───────┐            ┌──────────▼──────────┐
│ types/index.ts │            │ @revealui/schema/cms │
│ (RevealUI-     │            │ (Contract Layer)     │
│  specific)     │            │                      │
│                │            │ ├── contracts/       │
│ - RevealPayload│            │ │   ├── structure.ts │
│ - RevealWhere  │            │ │   ├── functions.ts │
│ - RevealUser   │            │ │   ├── config.ts    │
│ - ...          │            │ │   ├── errors.ts    │
│                │            │ │   └── ...          │
└────────────────┘            └─────────────────────┘
```

## Import Paths (IMPORTANT)

### Clear Import Guidelines

| Type Category | Import From | Description |
|--------------|-------------|-------------|
| Base CMS types | `@revealui/cms` OR `@revealui/schema/cms` | Same types, both work |
| RevealUI extensions | `@revealui/cms` | Tenant, permissions, etc. |
| Validation utilities | `@revealui/cms` | `validateWithErrors`, etc. |
| Config helpers | `@revealui/cms` | `defineCollection`, etc. |

### Examples

```typescript
// ✅ RECOMMENDED: Use @revealui/cms for everything
import type { 
  CollectionConfig,  // Base type from schema
  Field,             // Base type from schema
  RevealCollectionConfig,  // Extended with RevealUI features
  RevealPayload,     // RevealUI runtime type
} from '@revealui/cms';

import { 
  defineCollection, 
  validateWithErrors,
  ConfigValidationError,
} from '@revealui/cms';
```

```typescript
// ✅ ALSO VALID: Direct schema import for tree-shaking
import type { CollectionConfig, Field } from '@revealui/schema/cms';
```

## Migration Steps

### 1. Update Imports (Usually No Change Needed)

Existing imports continue to work:

```typescript
// This still works - types are re-exported
import type { CollectionConfig, Field } from '@revealui/cms';
```

For new code or better tree-shaking:

```typescript
// Direct schema import (optional, same types)
import type { CollectionConfig, Field } from '@revealui/schema/cms';
```

### 2. Use Type Helpers for Better Inference

```typescript
// Before - less type safety
const Posts: CollectionConfig = { ... };

// After - full generic type safety
import { defineCollection } from '@revealui/cms';

interface Post {
  id: string;
  title: string;
  content: string;
}

const Posts = defineCollection<Post>({
  slug: 'posts',
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'content', type: 'richText' },
  ],
  hooks: {
    afterChange: [({ doc }) => {
      // TypeScript knows doc is Post
      console.log(doc.title);
      return doc;
    }],
  },
});
```

### 3. Replace Deprecated Types

```typescript
// Before (deprecated)
import type { RevealCollectionConfig } from '@revealui/cms';
const Posts: RevealCollectionConfig = { ... };

// After
import type { CollectionConfig } from '@revealui/cms';
const Posts: CollectionConfig = { ... };
```

### 4. Add Generic Type Parameters (Recommended)

```typescript
// Before - hook type without generic
const revalidatePost: CollectionAfterChangeHook = ({ doc }) => { ... };

// After - hook type with generic
import type { Post } from '@/types';
const revalidatePost: CollectionAfterChangeHook<Post> = ({ doc }) => {
  doc.title; // TypeScript knows this exists
};
```

### 5. Use Runtime Validation (Optional)

```typescript
import { validateWithErrors, ConfigValidationError } from '@revealui/cms';

try {
  const validatedConfig = validateWithErrors(
    CollectionStructureSchema,
    userProvidedConfig,
    'collection',
    userProvidedConfig.slug
  );
} catch (error) {
  if (error instanceof ConfigValidationError) {
    console.error('Config issues:', error.getMessages());
    // Shows: ["[slug] Slug must start with lowercase letter...", ...]
  }
}
```

## Breaking Changes

### Slug Validation (Runtime Only)

If you use `validateWithErrors()`, collection and global slugs must match:
- Pattern: `/^[a-z][a-z0-9-]*$/`
- Start with lowercase letter
- Only lowercase letters, numbers, and hyphens

```typescript
// ❌ Will fail validation
{ slug: 'Users' }        // Capital letter
{ slug: 'my_posts' }     // Underscore
{ slug: '123items' }     // Starts with number

// ✅ Valid
{ slug: 'users' }
{ slug: 'my-posts' }
{ slug: 'items-123' }
```

Use the helper to convert:

```typescript
import { toSlug } from '@revealui/cms';
console.log(toSlug('My Posts!')); // 'my-posts'
```

### Strict Field Validation (Runtime Only)

When validating with Zod schemas, fields require a `type` property:

```typescript
// ❌ Will fail Zod validation
{ name: 'title' }

// ✅ Valid
{ name: 'title', type: 'text' }
```

## New Features

### Custom Field Types

Plugins can register custom field types:

```typescript
import { registerCustomFieldType } from '@revealui/cms';

registerCustomFieldType('color-picker', {
  description: 'A color picker field',
  defaultValue: '#000000',
  validate: (value) => {
    if (typeof value !== 'string') return 'Color must be a string';
    if (!/^#[0-9a-f]{6}$/i.test(value)) return 'Invalid hex color';
    return true;
  },
});
```

### Plugin Field Extensions

Plugins can add fields to collections:

```typescript
import { registerPluginExtension } from '@revealui/cms';

registerPluginExtension({
  pluginName: 'seo-plugin',
  globalFields: [
    { name: 'metaTitle', type: 'text' },
    { name: 'metaDescription', type: 'textarea' },
  ],
  collectionFields: {
    posts: [
      { name: 'canonicalUrl', type: 'text' },
    ],
  },
});
```

### Error Handling

Detailed validation errors:

```typescript
import { ConfigValidationError, safeValidate } from '@revealui/cms';

const result = safeValidate(CollectionStructureSchema, config, 'collection');

if (!result.success) {
  // Access structured error info
  console.log(result.error.configType);  // 'collection'
  console.log(result.error.issues);      // Zod issues array
  console.log(result.error.hasFieldError('slug')); // true/false
}
```

## FAQ

**Q: Do I need to change my existing collection configs?**
A: No. Existing configs continue to work. The new validation is opt-in.

**Q: What if validation fails on my existing config?**
A: Check the error message. Common issues:
- Uppercase letters in slugs (use `toSlug()` to fix)
- Missing `type` on fields

**Q: How do I get better type inference for hooks?**
A: Add the generic type parameter:
```typescript
const hook: CollectionAfterChangeHook<MyDocType> = ({ doc }) => { ... };
```

**Q: Can I use both import paths?**
A: Yes. `@revealui/cms` re-exports from `@revealui/schema/cms`, so both work:
```typescript
import type { CollectionConfig } from '@revealui/cms';
import type { CollectionConfig } from '@revealui/schema/cms';
```

## Tooling

### Type Usage Analyzer

Analyze your codebase to understand migration scope:

```bash
pnpm tsx scripts/analyze-types.ts
```

Outputs `TYPE-USAGE-REPORT.json` with:
- All type usages by type and file
- Migration complexity assessment
- Recommendations

### Migration Codemod

Preview and execute import migrations:

```bash
# Preview changes
pnpm tsx scripts/migrate-types.ts --dry-run --rewrite

# Execute changes
pnpm tsx scripts/migrate-types.ts --rewrite
```

## Resources

- [PayloadCMS Documentation](https://payloadcms.com/docs)
- [Zod Documentation](https://zod.dev)
- [TypeScript Generics](https://www.typescriptlang.org/docs/handbook/2/generics.html)

---

**Last Updated**: January 2025
**Migration Version**: v2.0.0
