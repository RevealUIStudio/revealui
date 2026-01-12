# Unit Tests

This directory contains unit tests for shared utilities, validation functions, and framework components.

## Structure

```
src/units/
  ├── validation/     # Validation utility tests (email, password, etc.)
  ├── auth/           # Authentication utility tests (JWT, sessions, etc.)
  ├── payments/       # Payment utility tests (Stripe helpers, etc.)
  ├── utils/          # General utility tests (test-helpers, etc.)
  └── helpers/        # Helper function tests
```

## Running Unit Tests

```bash
# Run all unit tests
pnpm test:unit

# Run unit tests in watch mode
pnpm test:unit:watch

# Run unit tests with coverage
pnpm test:coverage:unit

# Run specific test file
pnpm test src/units/validation/email-validation.test.ts
```

## Writing Unit Tests

### Example Test Structure

```typescript
import { describe, it, expect } from 'vitest'

describe('FeatureName', () => {
  describe('functionName', () => {
    it('should do something correctly', () => {
      // Arrange
      const input = 'test'
      
      // Act
      const result = functionToTest(input)
      
      // Assert
      expect(result).toBe('expected')
    })
    
    it('should handle edge cases', () => {
      // Test edge cases
    })
  })
})
```

## Best Practices

1. **Test one thing at a time**: Each test should verify a single behavior
2. **Use descriptive names**: Test names should clearly describe what they test
3. **Arrange-Act-Assert**: Structure tests with clear sections
4. **Test edge cases**: Include tests for null, undefined, empty strings, etc.
5. **Use fixtures**: Import test data from `src/fixtures/`
6. **Use helpers**: Import utilities from `src/utils/`

## Test Utilities

Import test utilities from `src/utils/`:

```typescript
import { waitFor, retry, createTestId } from '../../utils/test-helpers'
import { mockStripe, mockSupabase } from '../../utils/mocks'
```

## Test Fixtures

Import test fixtures from `src/fixtures/`:

```typescript
import { createTestUser, defaultTestUsers } from '../../fixtures/users'
import { createTestPayment } from '../../fixtures/payments'
```
