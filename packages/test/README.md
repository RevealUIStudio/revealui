# Test Package

Comprehensive testing infrastructure for the RevealUI Framework.

## Documentation

**For complete testing guide, patterns, and best practices, see:**
- **[Framework Testing Guide](../../docs/TESTING.md)** - Comprehensive testing documentation with patterns, load testing, penetration testing, and verification procedures

This README focuses on package-specific utilities and quick reference.

> **Note**: Testing patterns previously in `docs/TESTING-PATTERNS.md` have been consolidated into the Framework Testing Guide above.

## Overview

This package provides:
- **Unit Tests** - Test shared utilities and framework components
- **E2E Tests** - Browser-based end-to-end tests with Playwright
- **Load Tests** - Performance testing with k6
- **Test Utilities** - Shared helpers, mocks, and fixtures

## Structure

```
packages/test/
├── src/
│   ├── units/          # Unit tests
│   │   ├── validation/ # Validation utility tests
│   │   ├── auth/       # Authentication utility tests
│   │   ├── payments/   # Payment utility tests
│   │   └── utils/      # General utility tests
│   ├── integration/    # Integration tests
│   │   ├── api/        # API integration tests
│   │   ├── database/   # Database integration tests
│   │   ├── services/   # Service integration tests
│   │   └── e2e-flow/  # E2E flow integration tests
│   ├── e2e/            # E2E tests (Playwright)
│   │   ├── page-objects/ # Page object models
│   │   └── utils/      # E2E test utilities
│   ├── patterns/       # Test pattern examples
│   ├── utils/          # Test utilities and helpers
│   ├── fixtures/       # Test data factories
│   ├── mocks/          # Mock implementations
│   └── docs/           # Test documentation
└── load-tests/         # k6 load testing scripts
```

## Quick Start

### Run All Tests

```bash
# From project root
pnpm --filter test test:all

# Or from packages/test directory
pnpm test:all
```

### Run Unit Tests

```bash
# Run all unit tests
pnpm --filter test test:unit

# Run in watch mode
pnpm --filter test test:unit:watch

# Run with coverage
pnpm --filter test test:coverage:unit
```

### Run E2E Tests

```bash
# Run all E2E tests
pnpm --filter test test:e2e

# Run in UI mode
pnpm --filter test test:e2e --ui
```

### Run Load Tests

```bash
# Run specific load test
pnpm --filter test test:load:auth
pnpm --filter test test:load:api
pnpm --filter test test:load:payment

# Run all load tests
pnpm --filter test test:load:all
```

## Test Utilities

### Using Test Helpers

```typescript
import { waitFor, retry, createTestId } from '@revealui/test/utils'

// Wait for condition
await waitFor(() => condition === true, 5000)

// Retry with backoff
const result = await retry(async () => {
  return await someOperation()
}, 3)

// Create unique test ID
const id = createTestId('user')
```

### Using Test Fixtures

```typescript
import { createTestUser, defaultTestUsers } from '@revealui/test/fixtures'

// Create test user
const user = createTestUser({ role: 'admin' })

// Use default fixtures
const admin = defaultTestUsers.admin
```

### Using Mocks

```typescript
import { mockStripe, mockSupabase } from '@revealui/test/utils/mocks'
import { createMockDatabase, createMockFileStorage } from '@revealui/test/mocks'

// Use existing mocks
mockStripe.customers.create.mockResolvedValue({ id: 'cus_123' })

// Use new mock utilities
const mockDb = createMockDatabase()
const mockStorage = createMockFileStorage()
```

## Writing Tests

### Unit Test Example

```typescript
import { describe, it, expect } from 'vitest'
import { createTestUser } from '../../fixtures/users'

describe('UserService', () => {
  it('should create user correctly', () => {
    const user = createTestUser()
    expect(user.email).toContain('@example.com')
  })
})
```

### E2E Test Example (with Page Objects)

```typescript
import { test, expect } from '@playwright/test'
import { LoginPage } from './page-objects/LoginPage'
import { setupTestIsolation, cleanupTestData } from './utils/test-isolation'

test('user can login', async ({ page }) => {
  const context = await setupTestIsolation(page)
  
  try {
    const loginPage = new LoginPage(page)
    await loginPage.navigateTo('/login')
    await loginPage.login('admin@example.com', 'password')
    await expect(page).toHaveURL(/.*dashboard/)
  } finally {
    await cleanupTestData(context, page)
  }
})
```

### Integration Test Example

```typescript
import { describe, it, expect } from 'vitest'
import { getTestRevealUI, trackTestData } from '../utils/integration-helpers'

describe('API Integration', () => {
  it('should test API flow', async () => {
    const revealui = await getTestRevealUI()
    const user = await revealui.create({
      collection: 'users',
      data: { email: 'test@example.com', password: 'password' },
    })
    trackTestData('users', String(user.id))
    
    expect(user.id).toBeDefined()
  })
})
```

## Test Coverage

Coverage thresholds:
- **Statements**: ≥ 70%
- **Branches**: ≥ 60%
- **Functions**: ≥ 70%
- **Lines**: ≥ 70%

Run coverage report:
```bash
pnpm --filter test test:coverage
```

## Documentation

- [Unit Tests Guide](./src/units/README.md)
- [Load Testing Guide](./load-tests/README.md)
- [Framework Testing Guide](../../docs/TESTING.md) - Comprehensive testing patterns and examples

## Scripts

| Script | Description |
|--------|-------------|
| `test` | Run all tests (unit + E2E) |
| `test:unit` | Run unit tests only |
| `test:unit:watch` | Run unit tests in watch mode |
| `test:coverage` | Run tests with coverage report |
| `test:coverage:unit` | Run unit tests with coverage |
| `test:e2e` | Run E2E tests |
| `test:load:*` | Run load tests |
| `test:all` | Run unit + E2E tests |

## Dependencies

- **Vitest** - Unit testing framework
- **Playwright** - E2E testing framework
- **k6** - Load testing (external binary)
- **@testing-library/react** - React component testing
- **@testing-library/jest-dom** - DOM matchers

## When to Use This

- You need shared test fixtures, mocks, or utilities across multiple RevealUI packages
- You're writing E2E tests with Playwright page objects for RevealUI apps
- You want load testing scripts (k6) for auth, API, or payment flows
- **Not** for unit tests in a single package  -  co-locate tests with the package using Vitest directly
- **Not** for testing non-RevealUI projects  -  the fixtures and mocks are RevealUI-specific

## JOSHUA Alignment

- **Unified**: One test infrastructure package provides fixtures, mocks, E2E page objects, and load tests for the entire monorepo
- **Orthogonal**: Unit, integration, E2E, and load tests are cleanly separated directories with independent tooling
- **Justifiable**: Shared mocks (Stripe, Supabase, database, storage) exist because multiple packages need them  -  no duplication

## Contributing

When adding new tests:

1. **Unit tests** go in `src/units/` organized by feature
2. **Integration tests** go in `src/integration/` organized by type
3. **E2E tests** go in `src/e2e/` using page objects
4. **Test utilities** go in `src/utils/`
5. **Fixtures** go in `src/fixtures/`
6. **Mocks** go in `src/mocks/`
7. Follow existing patterns and naming conventions
8. See [Framework Testing Guide](../../docs/TESTING.md) for patterns and examples
