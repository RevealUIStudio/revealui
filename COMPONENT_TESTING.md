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
pnpm test apps/dashboard
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
- `apps/dashboard/src/__tests__/components/SystemHealthPanel.test.tsx` - Complex component
- `apps/dashboard/src/__tests__/components/AgentPanel.test.tsx` - Stateful component
- `apps/dashboard/src/__tests__/components/ErrorBoundary.test.tsx` - Error handling

---

**Last Updated**: February 2026
**Version**: 1.0.0
