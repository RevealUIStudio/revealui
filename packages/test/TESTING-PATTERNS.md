# Testing Patterns Guide

This guide provides comprehensive patterns and examples for testing the RevealUI Framework.

## Table of Contents

1. [React Component Testing](#react-component-testing)
2. [API Route Testing](#api-route-testing)
3. [Database Query Testing](#database-query-testing)
4. [Authentication Testing](#authentication-testing)
5. [Payment Testing](#payment-testing)
6. [Multi-Tenant Testing](#multi-tenant-testing)
7. [Best Practices](#best-practices)
8. [Common Pitfalls](#common-pitfalls)

## React Component Testing

### Basic Component Rendering

```typescript
import { render, screen } from '@testing-library/react'
import { Button } from './Button'

it('should render component', () => {
  render(<Button label="Click me" onClick={() => {}} />)
  expect(screen.getByRole('button')).toBeInTheDocument()
})
```

### User Interactions

```typescript
import userEvent from '@testing-library/user-event'

it('should handle click events', async () => {
  const user = userEvent.setup()
  const handleClick = vi.fn()
  
  render(<Button label="Click me" onClick={handleClick} />)
  await user.click(screen.getByRole('button'))
  
  expect(handleClick).toHaveBeenCalled()
})
```

### Async State Updates

```typescript
import { waitFor } from '@testing-library/react'

it('should handle async updates', async () => {
  render(<AsyncComponent />)
  
  await waitFor(() => {
    expect(screen.getByText('Loaded')).toBeInTheDocument()
  })
})
```

**See**: `packages/test/src/patterns/react-components.test.example.tsx` for complete examples.

## API Route Testing

### GET Requests

```typescript
import { NextRequest } from 'next/server'
import { GET } from './route'

it('should handle GET requests', async () => {
  const request = new NextRequest('http://localhost:3000/api/test')
  const response = await GET(request)
  const data = await response.json()
  
  expect(response.status).toBe(200)
  expect(data).toBeDefined()
})
```

### POST Requests with Body

```typescript
it('should handle POST requests', async () => {
  const body = { name: 'Test' }
  const request = new NextRequest('http://localhost:3000/api/test', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  
  const response = await POST(request)
  expect(response.status).toBe(200)
})
```

**See**: `packages/test/src/patterns/api-routes.test.example.ts` for complete examples.

## Database Query Testing

### Query Execution

```typescript
import { setupTestDatabase, teardownTestDatabase } from '../utils/test-database'

let db: DatabaseAdapter

beforeEach(async () => {
  db = await setupTestDatabase()
})

afterEach(async () => {
  await teardownTestDatabase()
})

it('should execute queries', async () => {
  const result = await db.query('SELECT * FROM users')
  expect(result.rows).toBeDefined()
})
```

### Transactions

```typescript
it('should handle transactions', async () => {
  await db.transaction(async () => {
    await db.query('INSERT INTO users (id, email) VALUES (?, ?)', ['1', 'test@example.com'])
  })
  
  const result = await db.query('SELECT * FROM users WHERE id = ?', ['1'])
  expect(result.rows).toHaveLength(1)
})
```

**See**: `packages/test/src/patterns/database-queries.test.example.ts` for complete examples.

## Authentication Testing

### Login Flow

```typescript
import { getTestRevealUI } from '../utils/integration-helpers'

it('should complete login flow', async () => {
  const revealui = await getTestRevealUI()
  
  const loginResult = await revealui.login({
    collection: 'users',
    data: { email: 'test@example.com', password: 'password' },
  })
  
  expect(loginResult.token).toBeDefined()
  expect(loginResult.user).toBeDefined()
})
```

### JWT Validation

```typescript
it('should validate JWT token', async () => {
  const loginResult = await revealui.login({ ... })
  
  // Use token for authenticated requests
  const req = { user: loginResult.user } as any
  const result = await revealui.find({ collection: 'users', req })
  
  expect(result.docs).toBeDefined()
})
```

**See**: `packages/test/src/patterns/authentication.test.example.ts` for complete examples.

## Payment Testing

### Stripe Integration

```typescript
// Requires Stripe test keys
it('should create payment intent', async () => {
  const paymentIntent = await stripe.paymentIntents.create({
    amount: 1000,
    currency: 'usd',
  })
  
  expect(paymentIntent.id).toBeDefined()
})
```

### Webhook Handling

```typescript
it('should verify webhook signature', async () => {
  const event = stripe.webhooks.constructEvent(
    payload,
    signature,
    webhookSecret
  )
  
  expect(event.type).toBe('payment_intent.succeeded')
})
```

**See**: `packages/test/src/patterns/payments.test.example.ts` for complete examples.

## Multi-Tenant Testing

### Tenant Isolation

```typescript
it('should isolate data by tenant', async () => {
  const user1 = await revealui.create({
    collection: 'users',
    data: {
      email: 'user1@example.com',
      tenants: [{ tenant: 1 }],
    },
  })
  
  const user2 = await revealui.create({
    collection: 'users',
    data: {
      email: 'user2@example.com',
      tenants: [{ tenant: 2 }],
    },
  })
  
  // Verify isolation
  expect(user1.tenants[0].tenant).toBe(1)
  expect(user2.tenants[0].tenant).toBe(2)
})
```

### Cross-Tenant Access Prevention

```typescript
it('should prevent cross-tenant access', async () => {
  const req = {
    user: { tenants: [{ tenant: 2 }] },
    tenant: { id: 2 },
  } as any
  
  // Should not return tenant 1 data
  const results = await revealui.find({
    collection: 'users',
    where: { tenant: { equals: 1 } },
    req,
  })
  
  expect(results.docs.length).toBe(0)
})
```

**See**: `packages/test/src/patterns/multi-tenant.test.example.ts` for complete examples.

## Best Practices

### 1. Use Test Fixtures

```typescript
import { createTestUser } from '../fixtures/users'

const user = createTestUser({ role: 'admin' })
```

### 2. Clean Up Test Data

```typescript
afterEach(async () => {
  await cleanupTestData()
})
```

### 3. Use Page Objects for E2E Tests

```typescript
import { LoginPage } from '../e2e/page-objects/LoginPage'

const loginPage = new LoginPage(page)
await loginPage.login(email, password)
```

### 4. Isolate Tests

```typescript
const context = await setupTestIsolation(page)
// ... test code ...
await cleanupTestData(context, page)
```

### 5. Mock External Services

```typescript
import { createMockDatabase } from '../mocks/database'

const mockDb = createMockDatabase()
```

## Common Pitfalls

### 1. Not Cleaning Up Test Data

**Problem**: Tests interfere with each other due to leftover data.

**Solution**: Always clean up test data in `afterEach` or `afterAll`.

### 2. Hardcoded Test Data

**Problem**: Tests break when data changes.

**Solution**: Use fixtures and factories to generate test data.

### 3. Fragile Selectors in E2E Tests

**Problem**: Tests break when UI changes.

**Solution**: Use page objects with robust selectors and fallbacks.

### 4. Not Isolating Tests

**Problem**: Tests depend on execution order.

**Solution**: Use test isolation utilities and unique test IDs.

### 5. Missing Error Handling

**Problem**: Tests fail with unclear errors.

**Solution**: Add proper error handling and meaningful error messages.

## Templates

### Unit Test Template

```typescript
import { describe, it, expect } from 'vitest'

describe('FeatureName', () => {
  it('should do something', () => {
    // Arrange
    const input = 'test'
    
    // Act
    const result = functionToTest(input)
    
    // Assert
    expect(result).toBe('expected')
  })
})
```

### Integration Test Template

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getTestRevealUI, trackTestData } from '../utils/integration-helpers'

describe('Feature Integration', () => {
  let revealui: RevealUIInstance

  beforeAll(async () => {
    revealui = await getTestRevealUI()
  })

  afterAll(async () => {
    await cleanupTestData()
  })

  it('should test feature', async () => {
    // Test implementation
  })
})
```

### E2E Test Template

```typescript
import { test, expect } from '@playwright/test'
import { LoginPage } from './page-objects/LoginPage'
import { setupTestIsolation, cleanupTestData } from './utils/test-isolation'

test('feature test', async ({ page }) => {
  const context = await setupTestIsolation(page)
  
  try {
    const loginPage = new LoginPage(page)
    await loginPage.login(email, password)
    
    // Test implementation
  } finally {
    await cleanupTestData(context, page)
  }
})
```

## Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Library Documentation](https://testing-library.com/)
- [RevealUI Test Package README](../README.md)
