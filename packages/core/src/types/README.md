# RevealUI Type System

This module defines the RevealUI type system, extending base types from `@revealui/contracts/cms` with RevealUI-specific features.

## Import Paths

All types are available from `@revealui/core/types`:

```typescript
// Unified export (all types)
import type { Config, Page, Post, User } from '@revealui/core/types'

// Specific categories
import type { Post } from '@revealui/core/types/cms'
import type { User } from '@revealui/core/types/schema'
import type { RevealConfig } from '@revealui/core/types/core'
import type { Database } from '@revealui/core/types/generated'
```

**Note**: This package was previously `@revealui/types` but has been merged into `@revealui/core`. See the [Migration Guide](../../../../docs/migrations/PACKAGE_MERGE_MIGRATION_GUIDE.md) for details.

## Architecture

### Base Types (from @revealui/contracts/cms)

- **CollectionConfig**: Base collection configuration with `slug` and `fields` properties
- **Field**: Base field configuration with `type`, `name`, `label`, `required`, etc.
- **GlobalConfig**: Base global configuration

### Extended Types (this package)

- **RevealCollectionConfig**: Extends `CollectionConfig` with RevealUI hooks
- **RevealUIField**: Extends `Field` with RevealUI-specific features
- **RevealGlobalConfig**: Extends `GlobalConfig` with RevealUI hooks

## Type Definitions

### RevealCollectionConfig

```typescript
export type RevealCollectionConfig = CollectionConfig & {
  hooks?: RevealCollectionHooks
}
```

**Key Properties** (inherited from `CollectionConfig`):
- `slug: string` - Collection identifier
- `fields: Field[]` - Array of field configurations

**Usage**:
```typescript
const collection: RevealCollectionConfig = {
  slug: 'posts',
  fields: [
    { type: 'text', name: 'title' }
  ],
  hooks: {
    afterChange: [async (args) => { /* ... */ }]
  }
}

// TypeScript correctly infers these properties:
const slug = collection.slug // string
const fields = collection.fields // Field[]
```

### RevealUIField

```typescript
export type RevealUIField = Field & {
  revealUI?: {
    searchable?: boolean
    auditLog?: boolean
    tenantScoped?: boolean
    permissions?: string[]
    validation?: RevealUIValidationRule[]
  }
}
```

**Key Properties** (inherited from `Field`):
- `type: FieldType` - Field type (text, number, etc.)
- `name?: string` - Field name
- `label?: string | false | unknown` - Field label
- `required?: boolean` - Whether field is required

**Usage**:
```typescript
const field: RevealUIField = {
  type: 'text',
  name: 'title',
  label: 'Title',
  required: true,
  revealUI: {
    searchable: true
  }
}

// TypeScript correctly infers these properties:
const type = field.type // FieldType
const name = field.name // string | undefined
const label = field.label // string | false | unknown
const required = field.required // boolean | undefined
```

## Why Intersection Types?

We use intersection types (`&`) instead of `extends` interfaces because:

1. **Better Type Inference**: Intersection types preserve all properties from base types, ensuring TypeScript can infer properties correctly even when base types use `Omit` utility types.

2. **No Property Loss**: When base types use `Omit<BaseType, 'keys'>`, extending with `interface` can cause TypeScript to lose track of omitted properties. Intersection types merge all properties correctly.

3. **Consistency**: All extended types use the same pattern, making the codebase easier to understand and maintain.

## Type Safety

All types are fully type-safe:
- No type assertions (`as`) should be needed in normal usage
- IDE autocomplete works correctly for all properties
- Type errors are caught at compile time
- All properties from base types are properly inferred

If you find yourself needing type assertions, it may indicate:
1. A type definition issue that should be fixed
2. A legitimate type narrowing case (use type guards instead)

## Implementation Status

✅ **Phase 1**: `RevealCollectionConfig` uses intersection type (`&`) - **Complete**
✅ **Phase 2**: `RevealUIField` uses intersection type (`&`) - **Complete**
✅ **Phase 3**: Unnecessary type assertions removed - **Complete**
✅ **Phase 4**: Type inference tests added - **Complete**
✅ **Phase 5**: Type errors verified (none found) - **Complete**
✅ **Phase 6**: Documentation complete - **Complete**

All type system fixes have been implemented. The type system now properly infers all properties without requiring type assertions for normal usage.

### Remaining Type Assertions

The following type assertions remain and are **intentionally kept** with documentation:

1. **`field-conversion.ts`** - 14 assertions for type narrowing when assigning type-specific properties
   - **Reason**: TypeScript cannot narrow separate variables (`baseField`) even when source variable (`field`) is narrowed
   - **Safety**: All assertions are guarded by runtime type checks (type guards, switch statements)
   - **Documentation**: See file-level comment explaining the limitation and alternatives considered

2. **Test files** - Assertions in test data creation (acceptable for test code)

### Files with Assertions Removed

- ✅ `hooks.ts` - Removed `{} as RevealUIInstance` (made `revealui` optional in `RevealHookContext`)
- ✅ `RevealUIInstance.ts` - Removed `{} as RevealUIInstance` (proper typing)
- ✅ `findById.ts` - Removed `as SanitizedCollectionConfig` (proper object construction)
- ✅ `find.ts` - Removed `as SanitizedCollectionConfig` (proper object construction)
- ✅ `GlobalOperations.ts` - Removed `as SanitizedGlobalConfig` (proper object construction)
- ✅ `RevealUIInstance.ts` (global methods) - Removed `as SanitizedGlobalConfig` (proper object construction)

## Examples

### Working with Collections

```typescript
function processCollection(collection: RevealCollectionConfig) {
  // All properties are accessible without assertions
  console.log(collection.slug)
  collection.fields.forEach(field => {
    console.log(field.name)
  })
}
```

### Working with Fields

```typescript
function processField(field: RevealUIField) {
  // All properties are accessible without assertions
  if (field.type === 'text') {
    console.log(field.name)
    console.log(field.label)
    if (field.required) {
      // Validate required field
    }
  }
}
```

## Migration from Type Assertions

If you have code using type assertions like:
```typescript
const slug = (collection as CollectionConfig).slug
const name = (field as RevealUIField & { name: string }).name
```

You can now use:
```typescript
const slug = collection.slug
const name = field.name
```

The type system now properly infers all properties, so assertions are no longer needed.

## Testing

Type inference is verified through two sets of tests:

### Runtime Tests
Located in `__tests__/type-inference.test.ts` - These verify runtime behavior and ensure properties are accessible.

### Compile-Time Tests
Located in `__tests__/type-inference-compile.test.ts` - These use `expect-type` to verify type inference at compile-time. These tests will fail the build if types are incorrect.

Both test suites ensure that:
- `RevealCollectionConfig` properties (`slug`, `fields`) are properly inferred
- `RevealUIField` properties (`type`, `name`, `label`, `required`) are properly inferred
- Extended properties (`hooks`, `revealUI`) are accessible
- No type assertions are required for normal usage

Run tests with:
```bash
# Run all type inference tests (runtime + compile-time + problem cases)
pnpm --filter @revealui/core test type-inference

# Run compile-time tests only
pnpm --filter @revealui/core test type-inference-compile

# Run problem case tests only
pnpm --filter @revealui/core test type-inference-problem
```

### Test Coverage

- **Runtime Tests** (`type-inference.test.ts`): 11 tests - Verify runtime behavior
- **Compile-Time Tests** (`type-inference-compile.test.ts`): 12 tests - Verify type inference at compile-time
- **Problem Case Tests** (`type-inference-problem-cases.test.ts`): 15 tests - Verify the actual problematic scenarios from the original plan

**Total: 38 tests** covering all aspects of type inference
