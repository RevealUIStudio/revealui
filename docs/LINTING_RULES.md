# Custom Linting Rules

This document describes custom code quality rules enforced in the RevealUI project.

## no-hardcoded-exit

### Overview

All scripts must use the `ErrorCode` enum for `process.exit()` calls instead of hardcoded numbers. This provides consistent exit codes across the codebase and makes error handling more maintainable.

### Rule Definition

**Error**: Using `process.exit()` with literal numbers

**Severity**: Error (for non-zero exits), Warning (for zero exits)

### ❌ Incorrect

```typescript
// Bad: Hardcoded exit codes
process.exit(1)
process.exit(2)
process.exit(0)

// Bad: Generic errors without ErrorCode
throw new Error('Something went wrong')
```

### ✅ Correct

```typescript
import { ErrorCode } from './lib/errors.js'

// Good: Using ErrorCode enum
process.exit(ErrorCode.EXECUTION_ERROR)
process.exit(ErrorCode.VALIDATION_ERROR)
process.exit(ErrorCode.SUCCESS)

// Good: Using ScriptError
import { ScriptError } from './lib/errors.js'
throw new ScriptError('Something went wrong', ErrorCode.EXECUTION_ERROR)
```

### Available ErrorCodes

From `scripts/lib/errors.ts`:

```typescript
export enum ErrorCode {
  SUCCESS = 0,
  EXECUTION_ERROR = 1,
  VALIDATION_ERROR = 2,
  MISSING_DEPENDENCY = 3,
  CONFIGURATION_ERROR = 4,
  NETWORK_ERROR = 5,
  PERMISSION_ERROR = 6,
  NOT_FOUND = 7,
  ALREADY_EXISTS = 8,
  TIMEOUT = 9,
  INTERRUPTED = 10,
  PARSE_ERROR = 11,
  UNSUPPORTED = 12,
  INTERNAL_ERROR = 13,
}
```

### Choosing the Right ErrorCode

| ErrorCode | Use When |
|-----------|----------|
| `SUCCESS` | Operation completed successfully |
| `EXECUTION_ERROR` | General execution failure (default) |
| `VALIDATION_ERROR` | Input validation failed |
| `MISSING_DEPENDENCY` | Required file, package, or tool not found |
| `CONFIGURATION_ERROR` | Configuration file invalid or missing |
| `NETWORK_ERROR` | Network request failed |
| `PERMISSION_ERROR` | Insufficient permissions |
| `NOT_FOUND` | Resource not found |
| `ALREADY_EXISTS` | Resource already exists (conflict) |
| `TIMEOUT` | Operation timed out |
| `INTERRUPTED` | Operation interrupted (SIGINT, SIGTERM) |
| `PARSE_ERROR` | Failed to parse input (JSON, YAML, etc.) |
| `UNSUPPORTED` | Unsupported operation or feature |
| `INTERNAL_ERROR` | Internal/unexpected error |

### Enforcement

#### Manual Auditing

Run the exit code auditor to find violations:

```bash
# Audit all scripts
pnpm ops audit:exit-codes

# Output JSON for CI
pnpm ops audit:exit-codes --json

# Generate markdown report
pnpm ops audit:exit-codes --markdown > exit-code-audit.md
```

#### CI/CD Integration

The exit code auditor runs in CI on all PRs. Builds will fail if critical violations are found.

See `.github/workflows/ci.yml`:

```yaml
- name: Audit exit codes
  run: pnpm ops audit:exit-codes
```

#### Pre-commit Hook

Modified scripts are audited before commit (warnings only, non-blocking):

```bash
# .husky/pre-commit checks scripts/ files
# Warnings are displayed but don't block commit
```

### Migration Guide

#### Step 1: Import ErrorCode

Add import to your script:

```typescript
import { ErrorCode } from './lib/errors.js'
// or relative path: '../lib/errors.js', '../../lib/errors.js'
```

#### Step 2: Replace Exit Codes

Find all `process.exit(N)` calls and replace with ErrorCode:

```typescript
// Before
if (!fileExists) {
  console.error('File not found')
  process.exit(1)
}

// After
if (!fileExists) {
  console.error('File not found')
  process.exit(ErrorCode.NOT_FOUND)
}
```

#### Step 3: Update Error Handling

For better error handling, use ScriptError:

```typescript
import { ScriptError, ErrorCode } from './lib/errors.js'

try {
  await riskyOperation()
} catch (error) {
  throw new ScriptError(
    'Operation failed',
    ErrorCode.EXECUTION_ERROR,
    { cause: error }
  )
}
```

### Examples

#### CLI Script

```typescript
#!/usr/bin/env tsx
import { ErrorCode } from './lib/errors.js'

async function main() {
  try {
    await validateInput()
    await performOperation()
    process.exit(ErrorCode.SUCCESS)
  } catch (error) {
    console.error('Operation failed:', error)
    process.exit(ErrorCode.EXECUTION_ERROR)
  }
}

main()
```

#### Validation Script

```typescript
#!/usr/bin/env tsx
import { ErrorCode } from './lib/errors.js'

function validateSchema(schema) {
  if (!schema.name) {
    console.error('Schema missing required field: name')
    process.exit(ErrorCode.VALIDATION_ERROR)
  }

  if (!schema.version) {
    console.error('Schema missing required field: version')
    process.exit(ErrorCode.VALIDATION_ERROR)
  }

  console.log('✅ Schema is valid')
  process.exit(ErrorCode.SUCCESS)
}
```

#### With Error Recovery

```typescript
#!/usr/bin/env tsx
import { ErrorCode } from './lib/errors.js'

async function migrate() {
  try {
    const connection = await connectToDatabase()

    await runMigrations(connection)

    console.log('✅ Migration completed successfully')
    process.exit(ErrorCode.SUCCESS)
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ Database connection refused')
      process.exit(ErrorCode.NETWORK_ERROR)
    }

    if (error.code === 'EACCES') {
      console.error('❌ Permission denied')
      process.exit(ErrorCode.PERMISSION_ERROR)
    }

    console.error('❌ Migration failed:', error)
    process.exit(ErrorCode.EXECUTION_ERROR)
  }
}

migrate()
```

### Why This Rule Exists

1. **Consistency**: Standardized exit codes across all scripts
2. **Debuggability**: Clear error types instead of generic numbers
3. **Automation**: Scripts can be parsed for error handling patterns
4. **Documentation**: Self-documenting error conditions
5. **Maintenance**: Easy to update error handling behavior

### Related

- **Scripts**: `scripts/commands/maintain/audit-exit-codes.ts`
- **ErrorCode Enum**: `scripts/lib/errors.ts`
- **CI Integration**: `.github/workflows/ci.yml`
- **Pre-commit Hook**: `.husky/pre-commit`

### Future Enhancements

1. **ESLint Custom Rule**: Create `eslint-plugin-revealui` with custom rules
2. **Auto-fix**: Automatic replacement of hardcoded exit codes
3. **VSCode Extension**: Real-time linting in editor
4. **Stricter Enforcement**: Make audit failures block commits

---

**Status**: ⚠️ Enforced via audit script (manual/CI)
**Target**: 100% compliance (currently ~80%)
**Last Audited**: 2026-02-03
