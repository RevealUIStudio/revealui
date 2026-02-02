# Integration Testing Guide

Comprehensive guide for writing and running integration tests in RevealUI.

## Overview

Integration tests validate that multiple components work together correctly. Unlike unit tests that test individual functions in isolation, integration tests verify the interaction between modules, APIs, databases, and external services.

## Test Structure

```
apps/cms/src/__tests__/integration/
├── api/           # API endpoint integration tests
│   ├── health.test.ts
│   └── gdpr.test.ts
└── auth/          # Authentication flow tests
    └── flows.test.ts

packages/core/src/__tests__/integration/
├── error-handling.test.ts  # Cross-module error handling
└── monitoring.test.ts       # Monitoring system integration

packages/db/__tests__/integration/
└── database.test.ts         # Database operations
```

## Running Integration Tests

```bash
# All integration tests
pnpm test:integration

# Specific package
pnpm vitest run packages/core/src/__tests__/integration/

# Watch mode
pnpm vitest watch packages/core/src/__tests__/integration/

# With coverage
pnpm vitest run --coverage packages/core/src/__tests__/integration/
```

## API Integration Tests

### Health Endpoint Testing

```typescript
import { createMockRequest } from '@revealui/core/__tests__/utils/test-helpers'
import { GET as healthHandler } from '../../../app/api/health/route'

describe('Health API Integration', () => {
  it('should return 200 OK', async () => {
    const request = createMockRequest({
      url: 'http://localhost:3000/api/health',
      method: 'GET',
    })

    const response = await healthHandler(request)

    expect(response.status).toBe(200)
  })

  it('should return health status', async () => {
    const request = createMockRequest({
      url: 'http://localhost:3000/api/health',
      method: 'GET',
    })

    const response = await healthHandler(request)
    const data = await response.json()

    expect(data).toHaveProperty('status')
    expect(data.status).toBe('ok')
  })
})
```

### GDPR Endpoint Testing

```typescript
describe('GDPR API Integration', () => {
  it('should require authentication', async () => {
    const request = createMockRequest({
      url: 'http://localhost:3000/api/gdpr/export',
      method: 'POST',
      body: { email: 'test@example.com' },
    })

    const response = await POST(request)

    expect([400, 401, 403]).toContain(response.status)
  })

  it('should validate request body', async () => {
    const request = createMockRequest({
      url: 'http://localhost:3000/api/gdpr/export',
      method: 'POST',
      body: {}, // Missing email
    })

    const response = await POST(request)

    expect(response.status).toBeGreaterThanOrEqual(400)
  })
})
```

## Database Integration Tests

### CRUD Operations

```typescript
import { createUserFixture } from '@revealui/db/__tests__/fixtures'
import { setupTestDatabase, resetTestDatabase } from '@revealui/db/__tests__/setup'

describe('Database Integration', () => {
  beforeAll(() => setupTestDatabase())
  afterAll() => teardownTestDatabase())
  beforeEach(() => resetTestDatabase())

  it('should insert new record', async () => {
    const user = createUserFixture()

    await db.insert(users).values(user)
    const inserted = await db.query.users.findFirst({
      where: eq(users.email, user.email)
    })

    expect(inserted).toBeDefined()
    expect(inserted.email).toBe(user.email)
  })
})
```

### Transaction Testing

```typescript
it('should rollback failed transactions', async () => {
  const user = createUserFixture()

  try {
    await db.transaction(async (tx) => {
      await tx.insert(users).values(user)
      throw new Error('Rollback test')
    })
  } catch (error) {
    expect(error).toBeDefined()
  }

  // Verify rollback occurred
  const found = await db.query.users.findFirst({
    where: eq(users.email, user.email)
  })

  expect(found).toBeUndefined()
})
```

### Constraint Validation

```typescript
it('should enforce unique constraints', async () => {
  const user = createUserFixture({ email: 'unique@test.com' })

  await db.insert(users).values(user)

  await expect(
    db.insert(users).values(user)
  ).rejects.toThrow(/unique/i)
})
```

## Authentication Flow Tests

### Login Flow

```typescript
describe('Login Flow', () => {
  it('should authenticate valid credentials', async () => {
    const user = createUserFixture({
      email: 'user@test.com',
      password: 'password123',
    })

    const request = createMockRequest({
      url: 'http://localhost:3000/api/auth/signin',
      method: 'POST',
      body: {
        email: user.email,
        password: user.password,
      },
    })

    const response = await signInHandler(request)

    expect(response.status).toBe(200)
  })
})
```

### Session Management

```typescript
it('should validate active session', async () => {
  const request = createMockRequest({
    url: 'http://localhost:3000/api/auth/session',
    method: 'GET',
    headers: {
      cookie: 'session=valid-session-id',
    },
  })

  const response = await sessionHandler(request)

  expect(response.status).toBe(200)
})
```

## Error Handling Integration

### Database Error Handling

```typescript
it('should handle unique constraint violations', () => {
  const error = createMockDbError('23505', {
    constraint: 'users_email_unique',
    table: 'users',
  })

  expect(() =>
    handleDatabaseError(error, 'insert user')
  ).toThrow(/duplicate/i)
})
```

### Error Propagation

```typescript
it('should propagate errors up the call stack', async () => {
  async function level3() {
    throw new Error('Level 3 error')
  }

  async function level2() {
    await level3()
  }

  async function level1() {
    await level2()
  }

  await expect(level1()).rejects.toThrow('Level 3 error')
})
```

## Monitoring Integration

### Alert Delivery

```typescript
import { sendAlert } from '@revealui/core/monitoring/alerts'

it('should deliver critical alerts', () => {
  const alert: Alert = {
    level: 'critical',
    metric: 'memory_usage',
    value: 98,
    threshold: 95,
    message: 'Critical memory usage',
    timestamp: Date.now(),
  }

  expect(() => sendAlert(alert)).not.toThrow()
})
```

### Health Monitoring

```typescript
it('should track system health', () => {
  const health = {
    status: 'ok',
    checks: {
      database: 'healthy',
      cache: 'healthy',
    },
  }

  expect(health.status).toBe('ok')
  expect(Object.keys(health.checks)).toHaveLength(2)
})
```

## Best Practices

### 1. Test Isolation

Always reset state between tests:

```typescript
beforeEach(async () => {
  await resetTestDatabase()
  resetAllCounters()
  vi.clearAllMocks()
})
```

### 2. Use Fixtures

Use test fixtures for consistent data:

```typescript
// ✅ Good - consistent test data
const user = createUserFixture({ role: 'admin' })

// ❌ Bad - manual data creation
const user = { email: 'test@test.com', password: '123' }
```

### 3. Test Real Interactions

Test actual component interactions, not mocks:

```typescript
// ✅ Good - tests real database interaction
await db.insert(users).values(user)
const found = await db.query.users.findFirst()

// ❌ Bad - mocks everything
vi.mock('database')
```

### 4. Handle Async Properly

Always await async operations:

```typescript
// ✅ Good
it('should create user', async () => {
  const user = await createUser(data)
  expect(user).toBeDefined()
})

// ❌ Bad - missing await
it('should create user', () => {
  const user = createUser(data)
  expect(user).toBeDefined()
})
```

### 5. Test Error Cases

Test both success and failure paths:

```typescript
describe('API endpoint', () => {
  it('should handle valid request', async () => {
    // Test success path
  })

  it('should reject invalid request', async () => {
    // Test error path
  })

  it('should handle authentication errors', async () => {
    // Test auth errors
  })
})
```

### 6. Use Descriptive Test Names

```typescript
// ✅ Good - describes what and why
it('should return 401 when user is not authenticated', () => {})

// ❌ Bad - vague
it('test auth', () => {})
```

### 7. Group Related Tests

```typescript
describe('User API', () => {
  describe('POST /api/users', () => {
    it('should create user with valid data', () => {})
    it('should reject duplicate email', () => {})
    it('should validate required fields', () => {})
  })

  describe('GET /api/users/:id', () => {
    it('should return user by ID', () => {})
    it('should return 404 for nonexistent user', () => {})
  })
})
```

### 8. Clean Up Resources

Always clean up after tests:

```typescript
afterEach(() => {
  consoleMock.restore()
  vi.restoreAllMocks()
})

afterAll(async () => {
  await teardownTestDatabase()
})
```

## Common Patterns

### Testing API Endpoints

```typescript
const request = createMockRequest({
  url: 'http://localhost:3000/api/endpoint',
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: { data: 'value' },
})

const response = await handler(request)
const data = await response.json()

expect(response.status).toBe(200)
expect(data).toHaveProperty('result')
```

### Testing with Authentication

```typescript
const authenticatedRequest = createMockRequest({
  url: 'http://localhost:3000/api/protected',
  method: 'GET',
  headers: {
    authorization: 'Bearer valid-token',
    cookie: 'session=session-id',
  },
})
```

### Testing Database Operations

```typescript
await withTestTransaction(async () => {
  // All database operations in this block
  // are automatically rolled back
  const user = await createUser(data)
  const post = await createPost({ authorId: user.id })

  expect(post.authorId).toBe(user.id)
})
```

### Testing Error Recovery

```typescript
let attempt = 0
const flaky = async () => {
  attempt++
  if (attempt < 3) throw new Error('Transient error')
  return 'success'
}

const result = await retry(flaky, { maxAttempts: 3 })

expect(result).toBe('success')
expect(attempt).toBe(3)
```

## Troubleshooting

### Tests Timing Out

Increase timeout for slow operations:

```typescript
it('slow operation', async () => {
  await slowDatabaseQuery()
}, 10000) // 10 second timeout
```

### Database Connection Issues

Ensure database is set up:

```bash
# Run database migrations
pnpm db:migrate

# Seed test data
pnpm db:seed

# Check database status
pnpm db:status
```

### Import Errors

Use correct import paths:

```typescript
// ✅ Correct - relative path for test files
import { createMockRequest } from '../../core/src/__tests__/utils/test-helpers.js'

// ❌ Wrong - package imports don't include __tests__
import { createMockRequest } from '@revealui/core/__tests__/utils/test-helpers'
```

## Coverage

Integration tests contribute to overall coverage goals:

- **Target:** 80% coverage
- **Critical paths:** 100% coverage
- **API endpoints:** 80%+ coverage
- **Database operations:** 90%+ coverage

## Related Documentation

- [Testing Guide](../../TESTING.md)
- [Test Utilities](../../packages/core/src/__tests__/utils/test-helpers.ts)
- [Test Fixtures](../../packages/db/__tests__/fixtures/)
- [CI/CD Pipeline](../../.github/workflows/test.yml)
