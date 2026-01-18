# Testing Agent

Specialized agent for testing tasks in the RevealUI Framework.

## Responsibilities

- Writing unit tests with Vitest
- Creating E2E tests with Playwright
- Setting up test fixtures and mocks
- Testing CMS collections and hooks
- Testing access control patterns
- Improving test coverage

## Key Rules

1. **Test File Naming:**
   - Unit tests: `*.test.ts` (e.g., `collection.test.ts`)
   - E2E tests: `*.spec.ts` in `packages/test/src/e2e/` (e.g., `auth.spec.ts`)
   - Place tests next to source files or in `__tests__/` folders

2. **Vitest Configuration:**
   - Use `vitest.config.ts` in each package
   - Configure path aliases for imports
   - Use `@vitest/coverage-v8` for coverage

3. **Test Structure:**
   ```typescript
   import { describe, it, expect, beforeAll, afterAll } from 'vitest'
   
   describe('FeatureName', () => {
     beforeAll(async () => {
       // Setup
     })
     
     afterAll(async () => {
       // Cleanup
     })
     
     it('should do something', () => {
       expect(true).toBe(true)
     })
   })
   ```

4. **Mocking:**
   - Mock external dependencies with `vi.mock()`
   - Use `vi.fn()` for function mocks
   - Create test utilities in `__tests__/utils/`

## CMS Testing Patterns

### Testing Collections

Use `getTestRevealUI()` utility:

```typescript
// apps/cms/src/__tests__/health.test.ts
import { getTestRevealUI } from './utils/cms-test-utils'

describe('Collection Tests', () => {
  let revealui: any

  beforeAll(async () => {
    revealui = await getTestRevealUI()
  })

  it('should query collection', async () => {
    const result = await revealui.find({
      collection: 'users',
      limit: 1,
      depth: 0,
    })

    expect(result).toBeDefined()
    expect(result.docs).toBeDefined()
    expect(Array.isArray(result.docs)).toBe(true)
  })
})
```

### Testing Access Control

Test access control functions:

```typescript
import { anyone, isAdmin, isAdminAndUser } from '@/lib/access'

describe('Access Control', () => {
  it('should allow public read access', () => {
    const result = anyone({ req: { user: null } } as any)
    expect(result).toBe(true)
  })

  it('should restrict admin access', () => {
    const result = isAdmin({ req: { user: null } } as any)
    expect(result).toBe(false)
  })
})
```

### Testing Hooks

Test collection hooks:

```typescript
import { beforeChange } from './hooks/beforeChange'

describe('Hook Tests', () => {
  it('should modify data before change', async () => {
    const data = { title: 'Test' }
    const result = await beforeChange({
      data,
      req: { user: { id: '123' } },
      operation: 'create',
    } as any)

    expect(result.createdBy).toBe('123')
  })
})
```

### Testing Stripe Integration

Use Stripe test utilities:

```typescript
// apps/cms/src/__tests__/payments/stripe.test.ts
import {
  createMockStripe,
  createMockWebhookEvent,
} from '../utils/stripe-test-utils'

vi.mock('services', () => ({
  stripe: createMockStripe(),
}))

describe('Stripe Tests', () => {
  it('should handle webhook events', async () => {
    const event = createMockWebhookEvent('payment_intent.succeeded', {
      id: 'pi_123',
    })
    // Test webhook handling
  })
})
```

## E2E Testing Patterns

### Playwright Test Structure

```typescript
// packages/test/src/e2e/example.spec.ts
import { expect, test } from '@playwright/test'

test.describe('Feature Name', () => {
  test('should load page successfully', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/RevealUI/)
  })
})
```

### Console Error Testing

Capture and test console errors:

```typescript
test('page has no console errors', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text())
    }
  })

  await page.goto('/')

  // Filter out known non-critical errors
  const criticalErrors = errors.filter(
    (error) =>
      !error.includes('favicon') &&
      !error.includes('analytics'),
  )

  expect(criticalErrors.length).toBe(0)
})
```

### Accessibility Testing

```typescript
test('page has accessible heading structure', async ({ page }) => {
  await page.goto('/')
  const headings = page.locator('h1, h2, h3, h4, h5, h6')
  const count = await headings.count()
  expect(count).toBeGreaterThan(0)
})
```

### API Testing

```typescript
test('health endpoint returns 200', async ({ request }) => {
  const response = await request.get('/api/health')
  expect(response.status()).toBe(200)

  const data = await response.json()
  expect(data).toHaveProperty('status')
  expect(data).toHaveProperty('timestamp')
})
```

## Test Utilities

### CMS Test Utilities

Location: `apps/cms/src/__tests__/utils/cms-test-utils.ts`

- `getTestRevealUI()` - Get test RevealUI instance
- `clearTestRevealUI()` - Clear cached instance

### Stripe Test Utilities

Location: `apps/cms/src/__tests__/utils/stripe-test-utils.ts`

- `createMockStripe()` - Mock Stripe client
- `createMockWebhookEvent()` - Mock webhook events
- `createMockPaymentIntent()` - Mock payment intents

### Test Setup

Location: `apps/cms/src/__tests__/setup.ts`

- Sets up test environment variables
- Configures test database
- Cleans up before/after tests

## File Locations

- Unit tests: `**/__tests__/**/*.test.ts` or next to source files
- E2E tests: `packages/test/src/e2e/*.spec.ts`
- Test utilities: `apps/cms/src/__tests__/utils/`
- Test setup: `apps/cms/src/__tests__/setup.ts`

## Real Examples from Codebase

### Example: Health Check Test

File: `apps/cms/src/__tests__/health.test.ts`

Tests database connectivity and CMS initialization.

### Example: Access Control Test

File: `apps/cms/src/__tests__/auth/access-control.test.ts`

Tests collection and field-level access control.

### Example: E2E Auth Test

File: `packages/test/src/e2e/auth.spec.ts`

Tests authentication flows in browser.

### Example: Console Error Test

File: `packages/test/src/e2e/example.spec.ts` (line 149)

Captures and validates no console errors on page load.
