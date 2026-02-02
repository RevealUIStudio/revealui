# Testing Guide

Comprehensive guide to testing in the RevealUI monorepo.

## Table of Contents

- [Overview](#overview)
- [Test Infrastructure](#test-infrastructure)
- [Running Tests](#running-tests)
- [Test Utilities](#test-utilities)
- [Test Fixtures](#test-fixtures)
- [Writing Tests](#writing-tests)
- [Coverage](#coverage)
- [CI/CD](#cicd)
- [Best Practices](#best-practices)

## Overview

RevealUI uses **Vitest** as the primary testing framework across all packages and applications. This provides a fast, modern testing experience with built-in TypeScript support.

### Current Test Coverage

- **Total Tests:** 130+
- **Coverage:** ~70%
- **Test Types:**
  - Unit Tests: 70+
  - Integration Tests: 50+
  - Component Tests: 10+
  - E2E Tests: Planned

## Test Infrastructure

### Test Utilities (`packages/core/src/__tests__/utils/test-helpers.ts`)

Reusable test utilities for common testing patterns:

```typescript
import {
  waitFor,
  sleep,
  mockDate,
  createMockContext,
  createMockRequest,
  createTimestampedSpy,
  mockConsole,
  createDeferred,
  withTimeout,
  retry,
  createMockError,
  createMockDbError,
  assertDefined,
  range,
  shuffle,
} from '@revealui/core/__tests__/utils/test-helpers'
```

**Key Utilities:**

#### waitFor - Wait for async conditions
```typescript
await waitFor(() => value === true, { timeout: 5000 })
```

#### mockDate - Mock Date for time-based tests
```typescript
const restore = mockDate('2024-01-01')
// Tests run with fixed date
restore() // Cleanup
```

#### createMockContext - Create request context for tests
```typescript
const context = createMockContext({
  userId: 'test-user',
  path: '/api/test',
})
```

#### mockConsole - Capture console output
```typescript
const mock = mockConsole()
console.log('test')
expect(mock.log).toContain('test')
mock.restore()
```

### Test Fixtures (`packages/db/__tests__/fixtures/`)

Pre-defined test data and factory functions:

```typescript
import {
  userFixtures,
  createUserFixture,
  createUsersFixture,
  postFixtures,
  createPostFixture,
  createPostsFixture,
  resetAllCounters,
} from '@revealui/db/__tests__/fixtures'
```

**Predefined Fixtures:**

```typescript
// Users
userFixtures.admin    // Admin user with email verified
userFixtures.user     // Regular user
userFixtures.guest    // Guest user (unverified)
userFixtures.premium  // Premium user with image

// Posts
postFixtures.published // Published post
postFixtures.draft     // Draft post
postFixtures.archived  // Archived post
postFixtures.featured  // Featured post with image
```

**Factory Functions:**

```typescript
// Create unique users
const user1 = createUserFixture()
const user2 = createUserFixture({ role: 'admin' })

// Create multiple
const users = createUsersFixture(5, { role: 'user' })

// Create posts for author
const posts = createPostsForAuthor('author-123', 10)

// Reset counters between tests
beforeEach(() => resetAllCounters())
```

### Test Database Setup (`packages/db/__tests__/setup.ts`)

Database utilities for integration tests:

```typescript
import {
  setupTestDatabase,
  teardownTestDatabase,
  resetTestDatabase,
  seedTestDatabase,
  withTestTransaction,
} from '@revealui/db/__tests__/setup'
```

**Usage:**

```typescript
// In test setup
beforeAll(async () => {
  await setupTestDatabase()
})

afterAll(async () => {
  await teardownTestDatabase()
})

// Between tests
beforeEach(async () => {
  await resetTestDatabase()
})

// Seed data
await seedTestDatabase({
  users: [userFixtures.admin, userFixtures.user],
  posts: [postFixtures.published],
})

// Run in transaction (auto-rollback)
await withTestTransaction(async () => {
  // Test code that modifies database
  // Automatically rolled back after test
})
```

## Running Tests

### All Tests
```bash
pnpm test
```

### With Coverage
```bash
pnpm test:coverage
```

### Specific Package
```bash
pnpm test --filter @revealui/core
```

### Specific Test File
```bash
pnpm vitest run packages/core/src/__tests__/utils/test-helpers.test.ts
```

### Watch Mode
```bash
pnpm vitest watch
```

### Integration Tests
```bash
pnpm test:integration
```

### Debugging Tests
```bash
pnpm vitest --inspect-brk
```

## Test Utilities

### Async Testing

**waitFor** - Wait for conditions:
```typescript
it('should update after async operation', async () => {
  let value = false
  setTimeout(() => value = true, 100)

  await waitFor(() => value, { timeout: 1000 })
  expect(value).toBe(true)
})
```

**withTimeout** - Timeout protection:
```typescript
it('should complete within timeout', async () => {
  await withTimeout(
    async () => await longOperation(),
    5000,
    'Operation took too long'
  )
})
```

**retry** - Retry flaky operations:
```typescript
it('should retry on failure', async () => {
  const result = await retry(
    async () => await unreliableOperation(),
    { maxAttempts: 3, delay: 100, backoff: true }
  )
  expect(result).toBeDefined()
})
```

### Time Mocking

```typescript
it('should handle date-based logic', () => {
  const restore = mockDate('2024-01-01T00:00:00Z')

  // All Date operations use 2024-01-01
  expect(new Date().getFullYear()).toBe(2024)
  expect(Date.now()).toBe(new Date('2024-01-01').getTime())

  restore()
})
```

### Request Mocking

```typescript
it('should handle request context', () => {
  const context = createMockContext({
    requestId: 'req-123',
    userId: 'user-456',
    path: '/api/users',
    method: 'GET',
  })

  runInRequestContext(context, () => {
    expect(getRequestId()).toBe('req-123')
  })
})
```

### Error Mocking

```typescript
it('should handle database errors', () => {
  const error = createMockDbError('23505', {
    constraint: 'users_email_unique',
    table: 'users',
    detail: 'Key (email)=(test@example.com) already exists.',
  })

  expect(() => handleDatabaseError(error, 'insert user'))
    .toThrow('Duplicate users email unique')
})
```

## Test Fixtures

### Using Predefined Fixtures

```typescript
import { userFixtures, postFixtures } from '@revealui/db/__tests__/fixtures'

it('should authenticate admin user', () => {
  const admin = userFixtures.admin
  expect(admin.role).toBe('admin')
  expect(admin.emailVerified).toBeDefined()
})
```

### Creating Custom Fixtures

```typescript
import { createUserFixture, createPostFixture } from '@revealui/db/__tests__/fixtures'

it('should create post for user', () => {
  const author = createUserFixture({ role: 'author' })
  const post = createPostFixture({
    authorId: author.id,
    status: 'published',
  })

  expect(post.authorId).toBe(author.id)
})
```

### Test Isolation

Always reset counters to ensure test isolation:

```typescript
import { resetAllCounters } from '@revealui/db/__tests__/fixtures'

describe('User Tests', () => {
  beforeEach(() => {
    resetAllCounters() // Ensures predictable fixture IDs
  })

  it('should create user with ID 1', () => {
    const user = createUserFixture()
    expect(user.email).toBe('user1@test.com')
  })
})
```

## Writing Tests

### Unit Test Pattern

```typescript
import { describe, expect, it } from 'vitest'
import { functionToTest } from '../module.js'

describe('functionToTest', () => {
  it('should handle valid input', () => {
    const result = functionToTest('valid')
    expect(result).toBe('expected')
  })

  it('should throw on invalid input', () => {
    expect(() => functionToTest(null)).toThrow('Invalid input')
  })
})
```

### Integration Test Pattern

```typescript
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest'
import { setupTestDatabase, resetTestDatabase, teardownTestDatabase } from '@revealui/db/__tests__/setup'
import { createUserFixture } from '@revealui/db/__tests__/fixtures'

describe('User API Integration', () => {
  beforeAll(async () => {
    await setupTestDatabase()
  })

  afterAll(async () => {
    await teardownTestDatabase()
  })

  beforeEach(async () => {
    await resetTestDatabase()
  })

  it('should create user in database', async () => {
    const userData = createUserFixture()
    const user = await createUser(userData)

    expect(user.id).toBeDefined()
    expect(user.email).toBe(userData.email)
  })
})
```

### Component Test Pattern

```typescript
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Button } from './Button'

describe('Button', () => {
  it('should render with text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })

  it('should call onClick when clicked', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Click</Button>)

    await userEvent.click(screen.getByText('Click'))
    expect(onClick).toHaveBeenCalledOnce()
  })
})
```

## Coverage

### Coverage Configuration

Coverage is configured in `vitest.config.ts`:

```typescript
{
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html', 'json-summary'],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 65,
        statements: 70,
      },
    },
  },
}
```

### Viewing Coverage

```bash
# Generate coverage report
pnpm test:coverage

# Open HTML report
open coverage/index.html
```

### Coverage Reports

- **Text:** Console output
- **HTML:** `coverage/index.html`
- **LCOV:** `coverage/lcov.info` (for CI tools)
- **JSON:** `coverage/coverage-final.json`

### Coverage Badges

Coverage badges are automatically generated and uploaded to Codecov in CI.

## CI/CD

### GitHub Actions Workflow

Tests run automatically on:
- Push to `main` or `develop`
- Pull requests

**Workflow steps:**
1. Install dependencies
2. Run linter
3. Run type check
4. Run all tests with coverage
5. Upload coverage to Codecov
6. Generate coverage badges
7. Archive test results

**Matrix Testing:**
- Node.js 18
- Node.js 20

### Integration Tests in CI

Integration tests run with PostgreSQL service:

```yaml
services:
  postgres:
    image: postgres:15
    env:
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
      POSTGRES_DB: revealui_test
```

## Best Practices

### 1. Test Organization

```typescript
describe('Module Name', () => {
  describe('functionName', () => {
    it('should handle case 1', () => {})
    it('should handle case 2', () => {})
    it('should throw on error', () => {})
  })
})
```

### 2. Test Isolation

```typescript
beforeEach(() => {
  // Reset all state
  resetAllCounters()
  vi.clearAllMocks()
})

afterEach(() => {
  // Cleanup
  vi.restoreAllMocks()
})
```

### 3. Clear Test Names

```typescript
// ✅ Good
it('should return 404 when user not found', () => {})

// ❌ Bad
it('test user endpoint', () => {})
```

### 4. Arrange-Act-Assert

```typescript
it('should create user', () => {
  // Arrange
  const userData = createUserFixture()

  // Act
  const user = createUser(userData)

  // Assert
  expect(user.email).toBe(userData.email)
})
```

### 5. Test Edge Cases

```typescript
describe('divide', () => {
  it('should divide numbers', () => {
    expect(divide(10, 2)).toBe(5)
  })

  it('should throw on division by zero', () => {
    expect(() => divide(10, 0)).toThrow('Cannot divide by zero')
  })

  it('should handle negative numbers', () => {
    expect(divide(-10, 2)).toBe(-5)
  })
})
```

### 6. Use Fixtures for Consistency

```typescript
// ✅ Good - consistent test data
const user = createUserFixture()

// ❌ Bad - manual data creation
const user = {
  email: 'test@example.com',
  name: 'Test',
  password: '123',
}
```

### 7. Mock External Dependencies

```typescript
import { vi } from 'vitest'

// Mock external API
vi.mock('../api-client', () => ({
  fetchData: vi.fn().mockResolvedValue({ data: 'mock' }),
}))
```

### 8. Test Async Code Properly

```typescript
// ✅ Good - await async operations
it('should fetch user', async () => {
  const user = await fetchUser('123')
  expect(user.id).toBe('123')
})

// ❌ Bad - missing await
it('should fetch user', () => {
  const user = fetchUser('123')
  expect(user.id).toBe('123') // Will fail!
})
```

### 9. Clean Up Resources

```typescript
describe('File Operations', () => {
  let tempFile: string

  beforeEach(() => {
    tempFile = createTempFile()
  })

  afterEach(() => {
    deleteTempFile(tempFile)
  })
})
```

### 10. Document Complex Tests

```typescript
it('should calculate discount with complex rules', () => {
  // Given a premium user with 3 items in cart,
  // each item > $50, and it's a weekend:
  // - Base discount: 10%
  // - Premium bonus: +5%
  // - Weekend special: +3%
  // Total: 18% discount

  const discount = calculateDiscount(user, cart, date)
  expect(discount).toBe(0.18)
})
```

## Troubleshooting

### Tests Timing Out

```typescript
// Increase timeout for specific test
it('slow operation', async () => {
  await slowOperation()
}, 10000) // 10 second timeout
```

### Flaky Tests

```typescript
// Use retry utility
it('flaky test', async () => {
  await retry(async () => {
    const result = await unreliableOperation()
    expect(result).toBeDefined()
  }, { maxAttempts: 3 })
})
```

### Memory Leaks

```typescript
// Clean up listeners, timers, etc.
afterEach(() => {
  clearAllTimers()
  removeAllListeners()
})
```

### Test Database Issues

```bash
# Reset test database
pnpm db:setup-test

# Check database connection
pnpm db:status
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Test Coverage Guide](./docs/development/testing/coverage.md)
- [CI/CD Pipeline](./.github/workflows/test.yml)
- [Test Utilities](./packages/core/src/__tests__/utils/test-helpers.ts)
- [Test Fixtures](./packages/db/__tests__/fixtures/)
