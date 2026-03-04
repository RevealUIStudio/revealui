# `[package-name]` or `@revealui/[package-name]`

<!--
  Use scoped name (@revealui/package-name) for published npm packages
  Use unscoped name for internal workspace packages (dev, test, etc.)
-->

Brief one-sentence description of what this package does.

<!-- Optional: Add badges or links -->
📚 [Docs](https://docs.revealui.com)
⚙️  [Source code](https://github.com/RevealUIStudio/revealui/tree/main/packages/[package-name])
📦 [npm package](https://npmjs.com/package/@revealui/[package-name]) <!-- Only for published packages -->

## Overview

Comprehensive description of the package's purpose, what problems it solves, and how it fits into the RevealUI ecosystem.

**Key features:**
- Feature 1 - Brief description
- Feature 2 - Brief description
- Feature 3 - Brief description

<!-- Optional: For packages that replaced/merged other packages -->
## Package Structure

<!-- Example for packages with multiple submodules -->
This package consolidates:
- **Submodule 1**: Description (previously `@revealui/old-package-1`)
- **Submodule 2**: Description (previously `@revealui/old-package-2`)
- **Submodule 3**: Description

<!-- OR for standard packages -->
This package follows the [core/client convention](../PACKAGE-CONVENTIONS.md#directory-structure-convention):
- **`core/`** - Server-side code (Node.js, Edge Functions, API routes)
- **`client/`** - Client-side code (React components, browser hooks)

## Installation

<!-- For published packages -->
```bash
pnpm add @revealui/[package-name]
```

<!-- For workspace packages -->
This is an internal workspace package. Add to your package.json:
```json
{
  "dependencies": {
    "[package-name]": "workspace:*"
  }
}
```

## Import Paths

### Main Exports

```typescript
// Everything (use sparingly)
import { ... } from '@revealui/[package-name]'

// Server-side imports (Node.js, Edge Functions)
import { ... } from '@revealui/[package-name]/core'

// Client-side imports (React components, browser hooks)
import { ... } from '@revealui/[package-name]/client'
```

<!-- Add specific exports relevant to your package -->
### Specific Exports

```typescript
// Category 1
import { SpecificExport1, SpecificExport2 } from '@revealui/[package-name]/category1'

// Category 2
import { SpecificExport3 } from '@revealui/[package-name]/category2'

// Types
import type { TypeName } from '@revealui/[package-name]/types'
```

## Quick Start

### Basic Usage

```typescript
import { mainFunction } from '@revealui/[package-name]'

// Example usage
const result = await mainFunction({
  option1: 'value1',
  option2: 'value2'
})
```

### Common Use Cases

#### Use Case 1: [Name]

```typescript
import { feature1 } from '@revealui/[package-name]'

// Example code
const example = feature1()
```

#### Use Case 2: [Name]

```typescript
import { feature2 } from '@revealui/[package-name]'

// Example code
const example = feature2()
```

<!-- Optional: For packages with complex setup -->
### Setup

```typescript
// One-time setup code
import { initialize } from '@revealui/[package-name]'

await initialize({
  apiKey: process.env.API_KEY,
  // ... other config
})
```

<!-- Optional: For packages with important architecture -->
## Architecture

Brief explanation of the package's architecture, design decisions, or important concepts.

Key concepts:
1. **Concept 1** - Description
2. **Concept 2** - Description
3. **Concept 3** - Description

<!-- Optional: For packages that migrated from other packages -->
## Migration

<!-- Example for packages merged from others -->
If you're migrating from `@revealui/old-package`, update your imports:

```typescript
// Before (old package - DEPRECATED/DELETED)
import { OldExport } from '@revealui/old-package'
import { OldExport2 } from '@revealui/old-package/submodule'

// After (new package)
import { NewExport } from '@revealui/[package-name]'
import { NewExport2 } from '@revealui/[package-name]/new-submodule'
```

<!-- Migration guides were consolidated. Include inline migration notes here if needed. -->

## API Reference

### Core API

#### `functionName(options)`

Description of what this function does.

**Parameters:**
- `options.param1` (type) - Description
- `options.param2` (type, optional) - Description

**Returns:** `ReturnType` - Description

**Example:**
```typescript
const result = functionName({
  param1: 'value',
  param2: 42
})
```

#### `ClassName`

Description of what this class does.

**Constructor:**
```typescript
new ClassName(config: ConfigType)
```

**Methods:**
- `method1(args)` - Description
- `method2(args)` - Description

**Example:**
```typescript
const instance = new ClassName({ /* config */ })
await instance.method1()
```

### Types

#### `TypeName`

Description of this type.

```typescript
interface TypeName {
  field1: string
  field2: number
  field3?: boolean  // Optional
}
```

## Configuration

<!-- For packages with configuration options -->

### Environment Variables

```bash
# Required
REQUIRED_VAR=value

# Optional
OPTIONAL_VAR=value  # Description of what this does
```

### Config File

```typescript
// config.ts
import type { Config } from '@revealui/[package-name]'

export const config: Config = {
  option1: 'value',
  option2: true
}
```

## Testing

<!-- Link to framework testing guide if applicable -->
**For comprehensive testing guide, see:**
- **[Framework Testing Guide](../../docs/testing/TESTING.md)** - Patterns, best practices, and verification procedures

### Package-Specific Tests

```bash
# Run all tests
pnpm --filter @revealui/[package-name] test

# Run in watch mode
pnpm --filter @revealui/[package-name] test:watch

# Run with coverage
pnpm --filter @revealui/[package-name] test:coverage
```

### Test Examples

```typescript
import { describe, it, expect } from 'vitest'
import { functionToTest } from '@revealui/[package-name]'

describe('functionToTest', () => {
  it('should handle basic case', () => {
    const result = functionToTest('input')
    expect(result).toBe('expected')
  })
})
```

## Development

### Commands

```bash
# Type check
pnpm --filter @revealui/[package-name] typecheck

# Run tests
pnpm --filter @revealui/[package-name] test

# Build
pnpm --filter @revealui/[package-name] build

# Lint
pnpm --filter @revealui/[package-name] lint
```

### Package Structure

```
packages/[package-name]/
├── src/
│   ├── core/          # Server-side code
│   ├── client/        # Client-side code
│   ├── types/         # TypeScript types
│   └── index.ts       # Main entry point
├── __tests__/         # Test files
├── package.json
├── tsconfig.json
└── README.md
```

## Troubleshooting

### Common Issues

#### Issue 1: [Problem Description]

**Symptom:** Description of the problem

**Solution:**
```bash
# Commands or code to fix
```

#### Issue 2: [Problem Description]

**Symptom:** Description of the problem

**Solution:**
```typescript
// Code example showing fix
```

## Related Documentation

<!-- Cross-reference relevant framework documentation -->

### Framework Docs
- **[Architecture Guide](../../docs/ARCHITECTURE.md)** - System architecture overview
- **[Testing Guide](../../docs/testing/TESTING.md)** - Testing patterns and best practices
- **[Development Guide](../../docs/DEVELOPMENT_GUIDE.md)** - Development setup and workflows

### Package Docs
- **[Package Conventions](../PACKAGE-CONVENTIONS.md)** - Monorepo package structure conventions
- **[Related Package 1](../related-package-1/README.md)** - Description
- **[Related Package 2](../related-package-2/README.md)** - Description

### Other Resources
- **[API Documentation](https://docs.revealui.com)** - Full API reference
- **[Examples](../../examples/[package-name])** - Working examples and demos
- **[Changelog](./CHANGELOG.md)** - Version history and updates

## Contributing

See the main [Contributing Guide](../../CONTRIBUTING.md) for:
- Code standards and conventions
- Testing requirements
- Pull request process
- Development workflow

### Package-Specific Guidelines

<!-- Add any package-specific contribution guidelines -->
- Guideline 1
- Guideline 2
- Guideline 3

## License

MIT

---

**Last Updated:** YYYY-MM-DD
**Package Version:** x.x.x
**Maintained By:** RevealUI Framework Team

<!-- Optional: Add notes about package status -->
<!--
## Status

⚠️ **Status**: Experimental | Beta | Stable | Deprecated

Additional status information if needed.
-->
