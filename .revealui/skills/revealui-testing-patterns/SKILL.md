---
name: revealui-testing-patterns
description: Testing patterns and best practices for RevealUI with Vitest
version: "1.0.0"
author: RevealUI Team
tags:
  - testing
  - vitest
  - quality
compatibility:
  - claude-code
  - universal
allowedTools:
  - Read
  - Write
  - Edit
  - Bash
---

# RevealUI Testing Patterns

Best practices for testing RevealUI applications with Vitest, addressing cyclic dependencies and test infrastructure issues.

## Current Status

**Challenge**: Test infrastructure exists but has blockers
- Cyclic dependency issues preventing test execution
- Need for per-worker test isolation
- PGlite database initialization for tests

## Test Structure

### File Organization

```
packages/
  └── package-name/
      ├── src/
      │   ├── index.ts
      │   └── __tests__/
      │       ├── unit.test.ts
      │       └── integration.test.ts
      └── vitest.config.ts

apps/
  └── admin/
      └── src/
          ├── __tests__/
          │   ├── auth/
          │   ├── integration/
          │   └── setup.ts
          └── vitest.config.ts
```

### Test Setup File

```typescript
// __tests__/setup.ts
import { beforeAll, afterAll, beforeEach } from 'vitest'
import { initializeTestDatabase } from './helpers/database'

beforeAll(async () => {
  // One-time setup
  await initializeTestDatabase()
}, 30000) // Increased timeout for parallel execution

afterAll(async () => {
  // Cleanup
})

beforeEach(() => {
  // Reset state between tests
})
```

## Unit Testing Patterns

### Test Components

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Button } from './Button'

describe('Button', () => {
  it('renders with text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })

  it('calls onClick when clicked', async () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Click</Button>)

    await userEvent.click(screen.getByText('Click'))
    expect(handleClick).toHaveBeenCalledOnce()
  })

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Click</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })
})
```

### Test Utilities

```typescript
import { describe, it, expect } from 'vitest'
import { formatDate, validateEmail } from './utils'

describe('formatDate', () => {
  it('formats date correctly', () => {
    const date = new Date('2024-01-01')
    expect(formatDate(date)).toBe('January 1, 2024')
  })

  it('handles invalid dates', () => {
    expect(() => formatDate(null)).toThrow('Invalid date')
  })
})

describe('validateEmail', () => {
  it('validates correct emails', () => {
    expect(validateEmail('user@example.com')).toBe(true)
  })

  it('rejects invalid emails', () => {
    expect(validateEmail('invalid')).toBe(false)
    expect(validateEmail('user@')).toBe(false)
  })
})
```

## Integration Testing

### API Routes

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { createMockRequest, createMockResponse } from './helpers'

describe('POST /api/posts', () => {
  beforeEach(async () => {
    await clearDatabase()
  })

  it('creates a new post', async () => {
    const req = createMockRequest({
      method: 'POST',
      body: {
        title: 'Test Post',
        content: 'Test content',
      },
    })
    const res = createMockResponse()

    await handler(req, res)

    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.any(String),
        title: 'Test Post',
      })
    )
  })

  it('requires authentication', async () => {
    const req = createMockRequest({
      method: 'POST',
      headers: {}, // No auth header
    })
    const res = createMockResponse()

    await handler(req, res)

    expect(res.status).toHaveBeenCalledWith(401)
  })
})
```

### Database Operations

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { getPayload } from '@revealui/core'

describe('Posts Collection', () => {
  let payload: Awaited<ReturnType<typeof getPayload>>

  beforeEach(async () => {
    payload = await getPayload()
    await payload.delete({ collection: 'posts', where: {} })
  })

  it('creates a post', async () => {
    const post = await payload.create({
      collection: 'posts',
      data: {
        title: 'Test Post',
        _status: 'published',
      },
    })

    expect(post).toMatchObject({
      id: expect.any(String),
      title: 'Test Post',
      _status: 'published',
    })
  })

  it('finds posts by status', async () => {
    await payload.create({
      collection: 'posts',
      data: { title: 'Published', _status: 'published' },
    })
    await payload.create({
      collection: 'posts',
      data: { title: 'Draft', _status: 'draft' },
    })

    const { docs } = await payload.find({
      collection: 'posts',
      where: { _status: { equals: 'published' } },
    })

    expect(docs).toHaveLength(1)
    expect(docs[0].title).toBe('Published')
  })
})
```

## Mocking Patterns

### Mock External Services

```typescript
import { vi, beforeEach } from 'vitest'

// Mock fetch
global.fetch = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
})

it('fetches user data', async () => {
  (fetch as any).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ id: '1', name: 'John' }),
  })

  const user = await fetchUser('1')

  expect(fetch).toHaveBeenCalledWith('/api/users/1')
  expect(user).toEqual({ id: '1', name: 'John' })
})
```

### Mock Modules

```typescript
// Mock the entire module
vi.mock('@revealui/auth', () => ({
  getCurrentUser: vi.fn(),
  checkPermission: vi.fn(),
}))

import { getCurrentUser } from '@revealui/auth'

it('requires authentication', async () => {
  (getCurrentUser as any).mockResolvedValue(null)

  const result = await protectedAction()

  expect(result.error).toBe('Unauthorized')
})
```

## Vitest Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.config.{js,ts}',
        '**/__tests__/**',
      ],
    },
    // Per-worker isolation for parallel tests
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
      },
    },
  },
})
```

## Solving Common Issues

### Cyclic Dependencies

```typescript
// ❌ BAD: Circular dependency
// fileA.ts
import { funcB } from './fileB'
export const funcA = () => funcB()

// fileB.ts
import { funcA } from './fileA'
export const funcB = () => funcA()

// ✅ GOOD: Break the cycle
// fileA.ts
export const funcA = (callback: () => void) => callback()

// fileB.ts
export const funcB = () => console.log('B')

// usage.ts
import { funcA } from './fileA'
import { funcB } from './fileB'
funcA(funcB)
```

### Async Test Timeouts

```typescript
// ✅ Increase timeout for slow operations
it('initializes database', async () => {
  await initializeDatabase()
}, 30000) // 30 second timeout

// ✅ Use done callback for complex async
it('handles multiple async operations', (done) => {
  Promise.all([
    operation1(),
    operation2(),
    operation3(),
  ]).then(() => {
    expect(true).toBe(true)
    done()
  })
})
```

### Database Isolation

```typescript
// Create separate database for each test worker
import { afterAll, beforeAll } from 'vitest'

let db: Database

beforeAll(async () => {
  const workerId = process.env.VITEST_WORKER_ID || '1'
  db = await createTestDatabase(`test-db-${workerId}`)
})

afterAll(async () => {
  await db.destroy()
})
```

## Test Coverage Goals

**Target**: 80%+ coverage
**Current**: Infrastructure in development

Run coverage:
```bash
pnpm test:coverage
```

## Best Practices

### 1. Test Behavior, Not Implementation

```typescript
// ❌ BAD: Testing implementation details
it('sets state correctly', () => {
  const { result } = renderHook(() => useState(0))
  expect(result.current[0]).toBe(0)
})

// ✅ GOOD: Testing behavior
it('displays initial count', () => {
  render(<Counter />)
  expect(screen.getByText('Count: 0')).toBeInTheDocument()
})
```

### 2. Use Descriptive Test Names

```typescript
// ❌ BAD
it('works', () => { /* ... */ })

// ✅ GOOD
it('creates a post with valid data', () => { /* ... */ })
it('returns 401 when user is not authenticated', () => { /* ... */ })
```

### 3. Arrange, Act, Assert

```typescript
it('updates user profile', async () => {
  // Arrange
  const user = await createTestUser()
  const updates = { name: 'New Name' }

  // Act
  const result = await updateUser(user.id, updates)

  // Assert
  expect(result.name).toBe('New Name')
})
```

### 4. One Assertion Focus Per Test

```typescript
// ✅ GOOD: Focused tests
it('validates required fields', () => {
  expect(validate({})).toHaveProperty('email')
})

it('validates email format', () => {
  expect(validate({ email: 'invalid' })).toHaveProperty('email')
})
```

## Running Tests

```bash
# Run all tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage
pnpm test:coverage

# Specific file
pnpm test path/to/file.test.ts

# Run in a specific package
pnpm --filter @revealui/core test
```

## Debugging Tests

```typescript
// Use vi.debug to inspect mocks
it('debugs test', () => {
  const mock = vi.fn()
  mock('test')
  console.log(mock.mock.calls) // See all calls
})

// Use --reporter=verbose for detailed output
// pnpm test --reporter=verbose
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Test Patterns](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

Every test written makes RevealUI more reliable! 🧪
