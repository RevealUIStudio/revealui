# Contract System

The RevealUI Contract System provides a unified approach to type safety, runtime validation, and documentation for CMS configurations.

## Overview

A **Contract** is a single source of truth that combines:
1. **TypeScript Types** (compile-time safety)
2. **Zod Schemas** (runtime validation)
3. **Validation Functions** (runtime validation)
4. **Type Guards** (runtime type checking)
5. **Metadata** (documentation, versioning)

## Core Concepts

### Contract Interface

```typescript
interface Contract<T> {
  metadata: ContractMetadata
  schema: ZodSchema<T>
  validate(data: unknown): ContractValidationResult<T>
  safeParse(data: unknown): ContractValidationResult<T>
  parse(data: unknown): T
  isType(data: unknown): data is T
}
```

### Creating Contracts

```typescript
import { createContract } from '@revealui/contracts/foundation'
import { z } from 'zod/v4'

const UserContract = createContract({
  name: 'User',
  version: '1.0.0',
  schema: z.object({
    id: z.string(),
    email: z.string().email(),
    name: z.string().min(1),
  }),
  description: 'User contract',
  docsUrl: 'https://revealui.dev/docs/api-reference/user',
})
```

## Available Contracts

### Core Contracts

- **ConfigContract** - Root configuration validation
- **CollectionContract** - Collection configuration validation
- **FieldContract** - Field configuration validation
- **GlobalContract** - Global configuration validation

### Usage

```typescript
import { ConfigContract, validateConfigStructure } from '@revealui/contracts/cms'

// Validate a config
const result = validateConfigStructure(userConfig)
if (result.success) {
  // result.data is fully typed and validated
  console.log(result.data.secret)
} else {
  // result.errors contains detailed ZodError
  console.error(result.errors.issues)
}

// Type guard
if (ConfigContract.isType(unknownData)) {
  // unknownData is now typed as ConfigContractType
}

// Parse (throws on error)
const validatedConfig = ConfigContract.parse(userConfig)
```

## Error Handling

The contract system uses `ConfigValidationError` for structured error reporting:

```typescript
import { ConfigValidationError } from '@revealui/contracts/cms'

try {
  const config = ConfigContract.parse(invalidConfig)
} catch (error) {
  if (error instanceof ConfigValidationError) {
    // Access structured error information
    console.error(error.message)
    console.error(error.issues) // Array of ZodIssue
    console.error(error.getMessages()) // Array of formatted messages
    console.error(error.getIssue('secret')) // Get specific issue by path
  }
}
```

## Extensibility

Contracts support extensibility through:

1. **Custom Properties** - Use the `custom` field for plugin-specific data
2. **Passthrough** - Limited use of `.passthrough()` on documented extensibility points
3. **Plugin Extensions** - Register custom field types and extensions

## Migration Guide

### From Old Validation

**Before:**
```typescript
import { validateConfig } from '@revealui/core/config/utils'

validateConfig(config) // Throws generic Error
```

**After:**
```typescript
import { validateConfigStructure, ConfigValidationError } from '@revealui/contracts/cms'

const result = validateConfigStructure(config)
if (!result.success) {
  throw new ConfigValidationError(result.errors, 'config')
}
```

### Benefits

- **Better Error Messages** - Detailed validation errors with paths
- **Type Safety** - Type narrowing after validation
- **Structured Errors** - Programmatic error handling
- **Documentation** - Built-in docs URLs and metadata

## Best Practices

1. **Always validate** - Use contract validation before processing configs
2. **Handle errors** - Use ConfigValidationError for structured error handling
3. **Type narrowing** - Use type guards after validation
4. **Extensibility** - Use `custom` field for plugin data, not root-level properties

## See Also

- [Config Contract API Reference](./config-contract.ts)
- [Collection Contract API Reference](./collection.ts)
- [Field Contract API Reference](./field.ts)
- [Global Contract API Reference](./global.ts)
