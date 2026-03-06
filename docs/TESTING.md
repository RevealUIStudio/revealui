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
- Node.js 24

### Integration Tests in CI

Integration tests run with PostgreSQL service:

```yaml
services:
  postgres:
    image: postgres:16
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
- [CI/CD Guide](./CI_CD_GUIDE.md)
- [CI/CD Guide](./CI_CD_GUIDE.md)
- [Test Utilities](https://github.com/RevealUIStudio/revealui/tree/main/packages/core/src/__tests__/utils/test-helpers.ts)
- [Test Fixtures](https://github.com/RevealUIStudio/revealui/tree/main/packages/db/__tests__/fixtures/)

---

# Component Testing Guide

This guide covers component testing practices for the RevealUI project using React Testing Library and Vitest.

## Table of Contents

- [Overview](#overview)
- [Testing Philosophy](#testing-philosophy)
- [Test Structure](#test-structure)
- [Component Test Patterns](#component-test-patterns)
- [Best Practices](#best-practices)
- [Common Scenarios](#common-scenarios)
- [Running Tests](#running-tests)
- [Coverage](#coverage)

## Overview

Component tests verify that React components render correctly, handle user interactions, maintain accessibility, and manage state as expected. We use:

- **Vitest** - Fast unit test framework
- **React Testing Library** - User-centric testing utilities
- **@testing-library/user-event** - Realistic user interaction simulation
- **@testing-library/jest-dom** - Custom matchers for DOM assertions

## Testing Philosophy

### User-Centric Testing

Test components from the user's perspective:

```typescript
// ✅ GOOD - Test user behavior
it('should submit form when user clicks submit button', async () => {
  const user = userEvent.setup()
  const onSubmit = vi.fn()

  render(<LoginForm onSubmit={onSubmit} />)

  await user.type(screen.getByLabelText('Email'), 'test@example.com')
  await user.type(screen.getByLabelText('Password'), 'password123')
  await user.click(screen.getByRole('button', { name: /submit/i }))

  expect(onSubmit).toHaveBeenCalled()
})

// ❌ BAD - Test implementation details
it('should update state when input changes', () => {
  const { result } = renderHook(() => useFormState())

  act(() => {
    result.current.setEmail('test@example.com')
  })

  expect(result.current.email).toBe('test@example.com')
})
```

### Accessibility First

Always test accessibility features:

```typescript
it('should have accessible form labels', () => {
  render(<LoginForm />)

  expect(screen.getByLabelText('Email')).toBeInTheDocument()
  expect(screen.getByLabelText('Password')).toBeInTheDocument()
})

it('should announce errors to screen readers', () => {
  render(<ErrorMessage error="Invalid email" />)

  const alert = screen.getByRole('alert')
  expect(alert).toHaveTextContent('Invalid email')
})
```

## Test Structure

### Organize by Feature/Behavior

Group tests by what they're testing, not by implementation:

```typescript
describe('Button', () => {
  describe('Rendering', () => {
    it('should render with text', () => { ... })
    it('should render with icon', () => { ... })
  })

  describe('Click Handling', () => {
    it('should call onClick when clicked', () => { ... })
    it('should not call onClick when disabled', () => { ... })
  })

  describe('Accessibility', () => {
    it('should be keyboard navigable', () => { ... })
    it('should have accessible name', () => { ... })
  })

  describe('Edge Cases', () => {
    it('should handle rapid clicks', () => { ... })
    it('should handle null children', () => { ... })
  })
})
```

### Standard Test Categories

Every component should have tests for:

1. **Rendering** - Basic rendering and props
2. **User Interaction** - Clicks, typing, focus
3. **States** - Loading, error, disabled, etc.
4. **Accessibility** - ARIA attributes, keyboard navigation
5. **Edge Cases** - Boundary conditions, error handling

## Component Test Patterns

### Basic Component Rendering

```typescript
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Button } from './Button'

describe('Button', () => {
  it('should render without crashing', () => {
    render(<Button>Click me</Button>)

    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('should render with text', () => {
    render(<Button>Click me</Button>)

    expect(screen.getByText('Click me')).toBeInTheDocument()
  })
})
```

### User Interaction Testing

```typescript
import userEvent from '@testing-library/user-event'

it('should handle user interactions', async () => {
  const user = userEvent.setup()
  const handleClick = vi.fn()

  render(<Button onClick={handleClick}>Click me</Button>)

  await user.click(screen.getByRole('button'))

  expect(handleClick).toHaveBeenCalledOnce()
})

it('should handle keyboard input', async () => {
  const user = userEvent.setup()
  const handleChange = vi.fn()

  render(<Input onChange={handleChange} />)

  const input = screen.getByRole('textbox')
  await user.type(input, 'Hello')

  expect(handleChange).toHaveBeenCalledTimes(5) // Once per character
})
```

### Form Component Testing

```typescript
describe('LoginForm', () => {
  it('should validate required fields', async () => {
    const user = userEvent.setup()

    render(<LoginForm />)

    await user.click(screen.getByRole('button', { name: /submit/i }))

    expect(screen.getByText(/email is required/i)).toBeInTheDocument()
  })

  it('should submit valid form', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(<LoginForm onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText('Email'), 'test@example.com')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: /submit/i }))

    expect(onSubmit).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    })
  })
})
```

### Loading and Error States

```typescript
it('should show loading state', () => {
  render(<DataPanel loading={true} />)

  expect(screen.getByRole('status')).toBeInTheDocument()
  expect(screen.queryByText('Data content')).not.toBeInTheDocument()
})

it('should show error state', () => {
  render(<DataPanel error="Failed to load" />)

  expect(screen.getByText(/failed to load/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
})
```

### Conditional Rendering

```typescript
it('should render conditionally based on props', () => {
  const { rerender } = render(<Alert show={false} />)

  expect(screen.queryByRole('alert')).not.toBeInTheDocument()

  rerender(<Alert show={true} />)

  expect(screen.getByRole('alert')).toBeInTheDocument()
})
```

### Testing with Context

```typescript
it('should use context values', () => {
  render(
    <ThemeContext.Provider value={{ theme: 'dark' }}>
      <ThemedComponent />
    </ThemeContext.Provider>
  )

  expect(screen.getByTestId('theme-indicator')).toHaveTextContent('dark')
})
```

### Mocking Child Components

```typescript
// Mock heavy child components
vi.mock('./HeavyChart', () => ({
  HeavyChart: () => <div>Mocked Chart</div>
}))

it('should render with mocked children', () => {
  render(<Dashboard />)

  expect(screen.getByText('Mocked Chart')).toBeInTheDocument()
})
```

## Best Practices

### 1. Use Semantic Queries

Prefer queries that reflect how users interact:

```typescript
// ✅ GOOD - Semantic queries
screen.getByRole('button', { name: /submit/i })
screen.getByLabelText('Email')
screen.getByPlaceholderText('Enter your name')
screen.getByText('Welcome')

// ❌ BAD - Implementation details
screen.getByTestId('submit-button')
screen.getByClassName('email-input')
```

### 2. Async Testing

Always await user interactions and async operations:

```typescript
// ✅ GOOD - Await async operations
it('should load data', async () => {
  render(<DataComponent />)

  await waitFor(() => {
    expect(screen.getByText('Data loaded')).toBeInTheDocument()
  })
})

// ❌ BAD - Not awaiting
it('should load data', () => {
  render(<DataComponent />)

  expect(screen.getByText('Data loaded')).toBeInTheDocument() // Might fail
})
```

### 3. Clean Up

Use proper cleanup and mock restoration:

```typescript
import { beforeEach, afterEach, vi } from 'vitest'

const originalError = console.error

beforeEach(() => {
  // Mock console.error to avoid cluttering test output
  console.error = vi.fn()
})

afterEach(() => {
  // Restore original console.error
  console.error = originalError

  // Clear all mocks
  vi.clearAllMocks()
})
```

### 4. Test Accessibility

Always include accessibility tests:

```typescript
describe('Accessibility', () => {
  it('should have proper ARIA attributes', () => {
    render(<Modal isOpen={true} />)

    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
  })

  it('should be keyboard navigable', async () => {
    const user = userEvent.setup()

    render(<Menu />)

    await user.tab()
    expect(screen.getByRole('button')).toHaveFocus()
  })

  it('should announce changes to screen readers', () => {
    render(<Notification message="Success" />)

    const liveRegion = screen.getByRole('status')
    expect(liveRegion).toHaveAttribute('aria-live', 'polite')
  })
})
```

### 5. Test Edge Cases

Don't forget boundary conditions:

```typescript
describe('Edge Cases', () => {
  it('should handle empty data', () => {
    render(<DataList items={[]} />)

    expect(screen.getByText(/no items/i)).toBeInTheDocument()
  })

  it('should handle very long text', () => {
    const longText = 'A'.repeat(1000)

    render(<TextDisplay text={longText} />)

    expect(screen.getByText(longText)).toBeInTheDocument()
  })

  it('should handle rapid interactions', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()

    render(<Button onClick={onClick}>Click</Button>)

    const button = screen.getByRole('button')
    for (let i = 0; i < 10; i++) {
      await user.click(button)
    }

    expect(onClick).toHaveBeenCalledTimes(10)
  })
})
```

## Common Scenarios

### Testing Forms

```typescript
describe('RegistrationForm', () => {
  it('should validate email format', async () => {
    const user = userEvent.setup()

    render(<RegistrationForm />)

    await user.type(screen.getByLabelText('Email'), 'invalid-email')
    await user.click(screen.getByRole('button', { name: /submit/i }))

    expect(screen.getByText(/invalid email/i)).toBeInTheDocument()
  })

  it('should show password strength', async () => {
    const user = userEvent.setup()

    render(<RegistrationForm />)

    await user.type(screen.getByLabelText('Password'), 'weak')
    expect(screen.getByText(/weak password/i)).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Password'))
    await user.type(screen.getByLabelText('Password'), 'StrongP@ssw0rd123')
    expect(screen.getByText(/strong password/i)).toBeInTheDocument()
  })
})
```

### Testing Modals/Dialogs

```typescript
describe('Modal', () => {
  it('should trap focus inside modal', async () => {
    const user = userEvent.setup()

    render(<Modal isOpen={true}>
      <button>First</button>
      <button>Last</button>
    </Modal>)

    const firstButton = screen.getByRole('button', { name: 'First' })
    const lastButton = screen.getByRole('button', { name: 'Last' })

    firstButton.focus()
    await user.tab()
    expect(lastButton).toHaveFocus()

    await user.tab()
    expect(firstButton).toHaveFocus() // Wrapped back
  })

  it('should close on Escape key', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()

    render(<Modal isOpen={true} onClose={onClose}>Content</Modal>)

    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalled()
  })
})
```

### Testing Lists

```typescript
describe('UserList', () => {
  it('should render all users', () => {
    const users = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ]

    render(<UserList users={users} />)

    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('should filter users by search', async () => {
    const user = userEvent.setup()
    const users = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ]

    render(<UserList users={users} />)

    await user.type(screen.getByRole('searchbox'), 'Ali')

    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.queryByText('Bob')).not.toBeInTheDocument()
  })
})
```

### Testing Error Boundaries

```typescript
describe('ErrorBoundary', () => {
  it('should catch errors from children', () => {
    const ThrowError = () => {
      throw new Error('Test error')
    }

    // Suppress console.error
    const originalError = console.error
    console.error = vi.fn()

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    )

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()

    console.error = originalError
  })
})
```

## Running Tests

### Run All Component Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Run tests for specific component
pnpm test Button.test.tsx

# Run tests in specific directory
pnpm test apps/cms
```

### Run Tests in CI

```bash
# Run all tests with coverage
pnpm test:ci

# This runs:
# - All test files
# - Generates coverage report
# - Fails if coverage thresholds not met
```

### Debug Tests

```typescript
import { screen, debug } from '@testing-library/react'

it('should debug component', () => {
  render(<MyComponent />)

  // Print entire document
  screen.debug()

  // Print specific element
  screen.debug(screen.getByRole('button'))
})
```

## Coverage

### Coverage Thresholds

Current project thresholds (vitest.config.ts):

```typescript
coverage: {
  thresholds: {
    lines: 70,
    functions: 70,
    branches: 65,
    statements: 70,
  }
}
```

### View Coverage Report

```bash
# Generate and open coverage report
pnpm test:coverage
open coverage/index.html
```

### Coverage Best Practices

1. **Aim for meaningful coverage** - Don't chase 100%, focus on critical paths
2. **Test user flows** - Cover complete user journeys
3. **Don't test implementation details** - Test behavior, not internals
4. **Cover edge cases** - Null values, empty arrays, extreme inputs
5. **Test error states** - Loading, errors, empty states

## File Organization

```
src/
├── components/
│   ├── Button.tsx
│   ├── Input.tsx
│   └── Card.tsx
└── __tests__/
    └── components/
        ├── Button.test.tsx
        ├── Input.test.tsx
        └── Card.test.tsx
```

## Resources

- [React Testing Library Docs](https://testing-library.com/docs/react-testing-library/intro/)
- [Vitest Docs](https://vitest.dev/)
- [Testing Library Queries](https://testing-library.com/docs/queries/about)
- [User Event API](https://testing-library.com/docs/user-event/intro)
- [Common Mistakes](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

## Examples

See example test files:

- `packages/presentation/src/__tests__/components/Button.test.tsx` - Button component
- `packages/presentation/src/__tests__/components/Input.test.tsx` - Form input
- `packages/presentation/src/__tests__/components/Checkbox.test.tsx` - Checkbox with states
- `packages/presentation/src/__tests__/components/Card.test.tsx` - Composite component
- `apps/cms/src/__tests__/components/AgentPanel.test.tsx` - Stateful component
- `apps/cms/src/__tests__/components/ErrorBoundary.test.tsx` - Error handling

---

**Last Updated**: February 2026
**Version**: 1.0.0

---

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

- [Testing Guide](./TESTING.md)
- [Test Utilities](https://github.com/RevealUIStudio/revealui/tree/main/packages/core/src/__tests__/utils/test-helpers.ts)
- [Test Fixtures](https://github.com/RevealUIStudio/revealui/tree/main/packages/db/__tests__/fixtures/)
- [CI/CD Guide](./CI_CD_GUIDE.md)

---

# E2E Testing Guide

Comprehensive guide to end-to-end testing with Playwright for the RevealUI project.

## Table of Contents

- [Overview](#overview)
- [Setup](#setup)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Test Organization](#test-organization)
- [Best Practices](#best-practices)
- [Common Patterns](#common-patterns)
- [Debugging](#debugging)
- [CI Integration](#ci-integration)
- [Performance Testing](#performance-testing)

## Overview

E2E (End-to-End) tests verify complete user workflows from the browser perspective, testing the entire application stack including:

- Frontend UI and interactions
- API endpoints and responses
- Database operations
- Authentication flows
- Third-party integrations

### Why Playwright?

- **Cross-browser testing** - Chromium, Firefox, WebKit
- **Auto-wait** - Intelligent waiting for elements
- **Screenshots & videos** - Debug failures easily
- **Network interception** - Test error scenarios
- **Mobile emulation** - Test responsive designs
- **Fast & reliable** - Parallel execution, retry logic

## Setup

### Installation

Playwright is already installed. If setting up fresh:

```bash
pnpm add -D @playwright/test playwright
```

### Configuration

Configuration is in `playwright.config.ts`:

```typescript
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
})
```

### Browser Installation

Install browsers for testing:

```bash
pnpm exec playwright install
```

Install with system dependencies:

```bash
pnpm exec playwright install --with-deps
```

## Running Tests

### Run All Tests

```bash
# Run all E2E tests
pnpm test:e2e

# Run with UI mode (visual debugger)
pnpm exec playwright test --ui

# Run in headed mode (see browser)
pnpm exec playwright test --headed
```

### Run Specific Tests

```bash
# Run single test file
pnpm exec playwright test e2e/auth.e2e.ts

# Run tests matching pattern
pnpm exec playwright test auth

# Run specific test by name
pnpm exec playwright test -g "should login with valid credentials"
```

### Run on Specific Browser

```bash
# Run on Chromium only
pnpm exec playwright test --project=chromium

# Run on Firefox
pnpm exec playwright test --project=firefox

# Run on mobile
pnpm exec playwright test --project=mobile-chrome
```

### Debug Mode

```bash
# Run in debug mode with inspector
pnpm exec playwright test --debug

# Debug specific test
pnpm exec playwright test auth.e2e.ts --debug
```

## Writing Tests

### Basic Test Structure

```typescript
import { test, expect } from '@playwright/test'

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Setup before each test
    await page.goto('/')
  })

  test('should perform action', async ({ page }) => {
    // Arrange
    await page.goto('/login')

    // Act
    await page.fill('input[name="email"]', 'test@example.com')
    await page.click('button[type="submit"]')

    // Assert
    await expect(page).toHaveURL(/dashboard/)
  })
})
```

### Using Test Helpers

```typescript
import { fillField, waitForNetworkIdle } from './utils/test-helpers'

test('should login', async ({ page }) => {
  await page.goto('/login')

  await fillField(page, 'input[name="email"]', 'test@example.com')
  await fillField(page, 'input[name="password"]', 'password123')
  await page.click('button[type="submit"]')

  await waitForNetworkIdle(page)

  await expect(page).toHaveURL(/dashboard/)
})
```

## Test Organization

### File Structure

```
e2e/
├── auth.e2e.ts                 # Authentication tests
├── user-flows.e2e.ts           # Critical user journeys
├── error-scenarios.e2e.ts      # Error handling tests
├── performance.e2e.ts          # Performance tests
├── utils/
│   └── test-helpers.ts         # Shared utilities
├── fixtures/
│   └── test-data.ts            # Test data
├── global-setup.ts             # Global setup
└── global-teardown.ts          # Global cleanup
```

### Test Categories

Organize tests by:

1. **Feature** - Group by application feature
2. **User Flow** - Group by complete user journey
3. **Error Scenario** - Group by error type
4. **Browser** - Separate mobile/desktop if needed

### Naming Conventions

```typescript
// File names: feature.e2e.ts
auth.e2e.ts
checkout.e2e.ts
search.e2e.ts

// Test names: should + action + expected result
test('should login with valid credentials', ...)
test('should show error for invalid email', ...)
test('should redirect to dashboard after signup', ...)
```

## Best Practices

### 1. Use Semantic Selectors

```typescript
// ✅ GOOD - Semantic, resilient
await page.click('button[type="submit"]')
await page.click('[aria-label="Close"]')
await page.click('text="Login"')

// ❌ BAD - Fragile, implementation-specific
await page.click('.btn-primary-xyz123')
await page.click('#submit-button-wrapper > button')
```

### 2. Auto-Waiting

Playwright auto-waits for elements. Don't add unnecessary waits:

```typescript
// ✅ GOOD - Playwright waits automatically
await page.click('button')

// ❌ BAD - Unnecessary timeout
await page.waitForTimeout(1000)
await page.click('button')
```

### 3. Assertions

Use explicit expectations:

```typescript
// ✅ GOOD - Clear expectations
await expect(page.locator('h1')).toHaveText('Dashboard')
await expect(page).toHaveURL(/dashboard/)
await expect(page.locator('.error')).toBeVisible()

// ❌ BAD - Vague checks
expect(await page.textContent('h1')).toBeTruthy()
```

### 4. Isolation

Keep tests independent:

```typescript
test.beforeEach(async ({ page }) => {
  // Clear state before each test
  await page.goto('/')
  await clearStorage(page)
})

test.afterEach(async ({ page }) => {
  // Clean up after each test
  await page.close()
})
```

### 5. Page Object Model (Optional)

For complex pages, use page objects:

```typescript
// pages/LoginPage.ts
export class LoginPage {
  constructor(private page: Page) {}

  async login(email: string, password: string) {
    await this.page.fill('input[name="email"]', email)
    await this.page.fill('input[name="password"]', password)
    await this.page.click('button[type="submit"]')
  }

  async expectLoginSuccess() {
    await expect(this.page).toHaveURL(/dashboard/)
  }
}

// In test
const loginPage = new LoginPage(page)
await loginPage.login('test@example.com', 'password123')
await loginPage.expectLoginSuccess()
```

## Common Patterns

### Navigation

```typescript
// Navigate to page
await page.goto('/dashboard')

// Click and navigate
await Promise.all([
  page.waitForNavigation(),
  page.click('a[href="/settings"]'),
])

// Wait for URL
await page.waitForURL('**/dashboard')
```

### Form Handling

```typescript
// Fill form
await page.fill('input[name="email"]', 'test@example.com')
await page.fill('input[name="password"]', 'password123')

// Select dropdown
await page.selectOption('select[name="country"]', 'US')

// Check checkbox
await page.check('input[type="checkbox"]')

// Upload file
await page.setInputFiles('input[type="file"]', 'path/to/file.pdf')

// Submit form
await page.click('button[type="submit"]')
```

### Waiting Strategies

```typescript
// Wait for selector
await page.waitForSelector('.results')

// Wait for network idle
await page.waitForLoadState('networkidle')

// Wait for specific response
await page.waitForResponse((resp) =>
  resp.url().includes('/api/data')
)

// Wait for function
await page.waitForFunction(() =>
  document.querySelectorAll('.item').length > 5
)
```

### Network Interception

```typescript
// Mock API response
await page.route('**/api/users', (route) => {
  route.fulfill({
    status: 200,
    body: JSON.stringify([{ id: 1, name: 'Test User' }]),
  })
})

// Block resources
await page.route('**/*.{png,jpg,jpeg}', (route) => route.abort())

// Modify requests
await page.route('**/api/**', (route) => {
  const headers = { ...route.request().headers(), 'X-Custom': 'value' }
  route.continue({ headers })
})
```

### Screenshots & Videos

```typescript
// Take screenshot
await page.screenshot({ path: 'screenshot.png' })

// Screenshot specific element
await page.locator('.header').screenshot({ path: 'header.png' })

// Full page screenshot
await page.screenshot({ path: 'fullpage.png', fullPage: true })

// Video is automatic (configured in playwright.config.ts)
// Videos saved to test-results/ on failure
```

### Mobile Testing

```typescript
// Use mobile viewport
test.use({ viewport: { width: 375, height: 667 } })

test('should work on mobile', async ({ page }) => {
  await page.goto('/')

  // Test mobile-specific features
  const mobileMenu = page.locator('.mobile-menu')
  await expect(mobileMenu).toBeVisible()
})

// Or use device emulation
test.use({ ...devices['iPhone 12'] })
```

### Authentication State

```typescript
// Save authentication state
await page.context().storageState({ path: 'auth.json' })

// Reuse authentication state
test.use({ storageState: 'auth.json' })

test('should access protected route', async ({ page }) => {
  await page.goto('/dashboard')
  // Already authenticated
})
```

## Debugging

### Debug Tools

```bash
# Run with Playwright Inspector
pnpm exec playwright test --debug

# Run specific test in debug mode
pnpm exec playwright test auth --debug -g "should login"

# Open last HTML report
pnpm exec playwright show-report
```

### Console Logging

```typescript
// Log page console
page.on('console', (msg) => console.log('PAGE LOG:', msg.text()))

// Log network requests
page.on('request', (request) =>
  console.log('>>', request.method(), request.url())
)
page.on('response', (response) =>
  console.log('<<', response.status(), response.url())
)

// Log page errors
page.on('pageerror', (error) =>
  console.log('PAGE ERROR:', error.message)
)
```

### Trace Viewer

```typescript
// Traces are automatically captured on first retry
// View trace:
pnpm exec playwright show-trace trace.zip

// Or configure to always trace:
// playwright.config.ts
use: {
  trace: 'on', // Always capture trace
}
```

### Slow Motion

```typescript
// Slow down test execution
test.use({ launchOptions: { slowMo: 1000 } }) // 1 second delay

test('slow test', async ({ page }) => {
  await page.goto('/')
  // Each action delayed by 1 second
})
```

## CI Integration

### GitHub Actions

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - uses: pnpm/action-setup@v2

      - name: Install dependencies
        run: pnpm install

      - name: Install Playwright browsers
        run: pnpm exec playwright install --with-deps

      - name: Start application
        run: pnpm dev &
        env:
          PORT: 3000

      - name: Wait for server
        run: npx wait-on http://localhost:3000

      - name: Run E2E tests
        run: pnpm test:e2e

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/

      - name: Upload videos
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: test-videos
          path: test-results/
```

### Docker

```dockerfile
# Dockerfile.e2e
FROM mcr.microsoft.com/playwright:v1.58.0-jammy

WORKDIR /app

COPY package*.json ./
RUN pnpm install

COPY . .

CMD ["pnpm", "test:e2e"]
```

```bash
# Run in Docker
docker build -f Dockerfile.e2e -t revealui-e2e .
docker run revealui-e2e
```

## Performance Testing

### Performance Metrics

```typescript
import { checkPerformance } from './utils/test-helpers'

test('should meet performance budget', async ({ page }) => {
  await page.goto('/')

  const metrics = await checkPerformance(page, {
    domContentLoaded: 3000, // 3s max
    loadComplete: 5000, // 5s max
    firstPaint: 2000, // 2s max
  })

  console.log('Performance metrics:', metrics)
})
```

### Lighthouse Integration

```typescript
import { playAudit } from 'playwright-lighthouse'

test('should pass Lighthouse audit', async ({ page, context }) => {
  await page.goto('/')

  await playAudit({
    page,
    port: 9222,
    thresholds: {
      performance: 90,
      accessibility: 95,
      'best-practices': 90,
      seo: 90,
    },
  })
})
```

### Network Simulation

```typescript
import { simulateSlowNetwork } from './utils/test-helpers'

test('should work on slow network', async ({ page }) => {
  await simulateSlowNetwork(page)

  await page.goto('/')

  // Should still load within acceptable time
  await expect(page.locator('h1')).toBeVisible({ timeout: 10000 })
})
```

## Troubleshooting

### Common Issues

**Tests timing out:**
```typescript
// Increase timeout
test.setTimeout(60000) // 60 seconds

// Or per-action timeout
await page.click('button', { timeout: 30000 })
```

**Flaky tests:**
```typescript
// Use built-in retry
test.describe.configure({ retries: 2 })

// Or wait for stable state
await page.waitForLoadState('networkidle')
await page.waitForLoadState('domcontentloaded')
```

**Element not found:**
```typescript
// Use more specific selectors
await page.locator('button:has-text("Submit")').click()

// Wait for element
await page.waitForSelector('button')

// Check if element exists
const count = await page.locator('button').count()
```

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [API Reference](https://playwright.dev/docs/api/class-playwright)
- [Examples](https://github.com/microsoft/playwright/tree/main/examples)
- [Discord Community](https://aka.ms/playwright/discord)

## Test Examples

See example E2E tests in:

- `e2e/auth.e2e.ts` - Authentication flows (43 tests)
- `e2e/user-flows.e2e.ts` - Critical user journeys (25+ tests)
- `e2e/error-scenarios.e2e.ts` - Error handling (40+ tests)
- `e2e/utils/test-helpers.ts` - Reusable test utilities

---

**Last Updated**: February 2026
**Version**: 1.0.0
