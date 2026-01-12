# Script Testing Guide

## Overview

This guide covers testing for all scripts in the `scripts/` directory.

## Test Structure

### Unit Tests

Located in `scripts/shared/__tests__/utils.test.ts`

Tests the shared utilities module:
- `createLogger()` - Logger creation and methods
- `getEnv()` - Environment variable reading
- `requireEnv()` - Required environment variables
- `fileExists()` - File existence checking
- `getProjectRoot()` - Project root calculation

**Run unit tests**:
```bash
cd scripts && pnpm exec vitest run shared/__tests__/utils.test.ts
```

### Integration Tests

Located in `scripts/__tests__/integration/script-workflows.test.ts`

Tests script workflows and integration:
- Validation scripts execution
- Setup scripts existence
- Database scripts existence
- Package.json script references

**Run integration tests**:
```bash
cd scripts && pnpm exec vitest run __tests__/integration/script-workflows.test.ts
```

### Manual Testing

Some scripts require specific environments and should be tested manually:

#### Database Scripts (Require Docker/PostgreSQL)
- `setup-test-db.ts` - Requires Docker
- `setup-test-db-simple.ts` - Requires Docker
- `run-migration.ts` - Requires POSTGRES_URL
- `init-database.ts` - Requires database connection
- `seed-sample-content.ts` - Requires database connection

**Manual test command**:
```bash
# Set up test database first
pnpm db:setup-test

# Then test migration
POSTGRES_URL="postgresql://test:test@localhost:5433/test_revealui" pnpm db:migrate
```

#### Server-Dependent Scripts (Require Running Server)
- `test-api-routes.ts` - Requires API server running
- `security-test.ts` - Requires API server running
- `run-automated-validation.ts` - Requires server and database

**Manual test command**:
```bash
# Start server first
pnpm dev

# Then in another terminal
pnpm test:api-routes
pnpm validate:security
```

#### Production Validation (Require Production Database)
- `validate-production.ts` - Requires Neon production database

**Manual test command**:
```bash
POSTGRES_URL="postgresql://..." pnpm validate:production
```

## Test Coverage

### Currently Tested ✅
- ✅ Shared utilities (unit tests)
- ✅ Script workflows (integration tests)
- ✅ Validation scripts (integration tests)
- ✅ Script existence (integration tests)

### Needs Manual Testing ⚠️
- ⚠️ Database setup scripts (require Docker)
- ⚠️ Server-dependent scripts (require running server)
- ⚠️ Production validation (requires production database)

## Running All Tests

```bash
# From scripts directory
cd scripts && pnpm exec vitest run

# From project root
cd scripts && pnpm exec vitest run
```

## Test Results

See `TEST-RESULTS.md` for detailed test results from manual testing.

## Adding New Tests

### Unit Test Example

```typescript
import { describe, it, expect } from 'vitest'
import { createLogger } from '../shared/utils.js'

describe('MyFeature', () => {
  it('should work correctly', () => {
    const logger = createLogger()
    expect(logger).toBeDefined()
  })
})
```

### Integration Test Example

```typescript
import { describe, it, expect } from 'vitest'
import { execCommand, getProjectRoot } from '../../shared/utils.js'

describe('MyScript', () => {
  it('should run without crashing', async () => {
    const root = await getProjectRoot(import.meta.url)
    const result = await execCommand(
      'pnpm',
      ['tsx', 'scripts/my-script.ts'],
      { cwd: root, silent: true }
    )
    expect([0, 1]).toContain(result.exitCode)
  })
})
```

## Continuous Integration

Tests should be run in CI/CD:
- Unit tests: Fast, run on every commit
- Integration tests: Slower, run on PR
- Manual tests: Run before release

## Troubleshooting

### Tests Fail with Import Errors

Ensure you're running from the `scripts/` directory:
```bash
cd scripts && pnpm exec vitest run
```

### Tests Timeout

Some integration tests may timeout if scripts take too long. Increase timeout:
```typescript
it('should work', async () => {
  // ... test code
}, { timeout: 10000 }) // 10 seconds
```

### Environment Variables Missing

Some tests require environment variables. Set them before running:
```bash
POSTGRES_URL="..." pnpm exec vitest run
```
