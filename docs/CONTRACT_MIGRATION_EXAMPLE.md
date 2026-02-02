# Contract Migration Example: Sign-Up API

This document shows a real-world example of migrating manual validation to contract-based validation.

## Overview

The sign-up API endpoint (`apps/cms/src/app/api/auth/sign-up/route.ts`) was refactored to use the contract system, demonstrating the benefits of unified type validation.

## Before: Manual Validation (49 lines)

```typescript
import { sanitizeEmail, sanitizeName } from '@/lib/utils/sanitize'

// ... 49 lines of manual validation code ...

if (!body || typeof body !== 'object') {
  return createValidationErrorResponse('Request body must be an object', 'body', body)
}

const { email, password, name } = body as {
  email?: unknown
  password?: unknown
  name?: unknown
}

if (!(email && password && name)) {
  return createValidationErrorResponse('Email, password, and name are required', 'body', {
    email: !!email,
    password: !!password,
    name: !!name,
  })
}

// Sanitize inputs
if (typeof email !== 'string') {
  return createValidationErrorResponse('Email must be a string', 'email', email)
}
const sanitizedEmail = sanitizeEmail(email)
if (!sanitizedEmail) {
  return createValidationErrorResponse('Invalid email format', 'email', email)
}

if (typeof name !== 'string') {
  return createValidationErrorResponse('Name must be a string', 'name', name)
}
const sanitizedName = sanitizeName(name)
if (!sanitizedName || sanitizedName.length === 0) {
  return createValidationErrorResponse('Name is required and must be valid', 'name', name)
}

// Validate password strength (handled by auth package, but check length here)
if (typeof password !== 'string') {
  return createValidationErrorResponse('Password must be a string', 'password', null)
}
if (password.length < 8) {
  return createValidationErrorResponse(
    'Password must be at least 8 characters',
    'password',
    null,
    {
      minLength: 8,
      actualLength: password.length,
    },
  )
}
```

### Problems with Manual Validation:
- **Repetitive**: Type checks, null checks, sanitization repeated for each field
- **Error-prone**: Easy to forget a validation rule or sanitization step
- **Hard to maintain**: Changes require updating validation logic in multiple places
- **No type safety**: No TypeScript types derived from validation rules
- **Scattered logic**: Sanitization functions in separate files

## After: Contract-Based Validation (18 lines)

### Step 1: Define the Contract

```typescript
// packages/contracts/src/api/auth.ts
import { z } from 'zod/v4'
import { createContract } from '../foundation/contract.js'

export const SignUpRequestSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email format')
    .transform((email) => email.toLowerCase().trim()),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long'),
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters')
    .transform((name) => name.trim().replace(/\s+/g, ' ')),
})

export type SignUpRequest = z.infer<typeof SignUpRequestSchema>

export const SignUpRequestContract = createContract({
  name: 'SignUpRequest',
  version: '1',
  description: 'Validates user sign-up request data',
  schema: SignUpRequestSchema,
})
```

### Step 2: Use the Contract in the API Route

```typescript
import { SignUpRequestContract } from '@revealui/contracts'

// Validate request body using contract
const validationResult = SignUpRequestContract.validate(body)

if (!validationResult.success) {
  // Extract first validation error for user-friendly response
  const firstIssue = validationResult.errors.issues[0]
  return createValidationErrorResponse(
    firstIssue?.message || 'Validation failed',
    firstIssue?.path?.join('.') || 'body',
    body,
    {
      issues: validationResult.errors.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    },
  )
}

// Contract automatically sanitizes email (lowercase, trim) and name (trim, normalize spaces)
const { email: sanitizedEmail, password, name: sanitizedName } = validationResult.data
```

## Benefits of Contract-Based Validation

### 1. Less Code (-31 lines, 63% reduction)
- Reduced from 49 lines to 18 lines
- More concise and readable

### 2. Type Safety
```typescript
// TypeScript knows the exact shape
const data: SignUpRequest = validationResult.data
// data.email is string (guaranteed lowercase, trimmed)
// data.password is string (guaranteed min 8 chars)
// data.name is string (guaranteed 1-100 chars, normalized)
```

### 3. Built-in Sanitization
- Email: automatically lowercased and trimmed
- Name: automatically trimmed and whitespace normalized
- No separate sanitization functions needed

### 4. Reusable Schema
```typescript
// Can be used anywhere in the codebase
import { SignUpRequestSchema } from '@revealui/contracts'

// In React forms
const form = useForm({ schema: SignUpRequestSchema })

// In backend validation
const result = SignUpRequestContract.validate(data)

// In tests
const mockData: SignUpRequest = { ... }
```

### 5. Centralized Validation Rules
- All validation rules defined in one place
- Change password requirement to 12 chars? Update one line
- Add email domain validation? Add it to the schema

### 6. Better Error Messages
```typescript
// Zod provides detailed error paths
{
  issues: [
    { path: 'email', message: 'Invalid email format' },
    { path: 'password', message: 'Password must be at least 8 characters long' }
  ]
}
```

## Migration Checklist

When migrating an API endpoint to use contracts:

- [ ] **Create contract file** in `packages/contracts/src/api/`
- [ ] **Define Zod schema** with validation rules and transformations
- [ ] **Create contract** using `createContract()`
- [ ] **Export from contracts package** (`packages/contracts/src/index.ts`)
- [ ] **Replace manual validation** with `contract.validate()`
- [ ] **Remove now-unused imports** (sanitize functions, type guards)
- [ ] **Update error handling** to use contract validation errors
- [ ] **Test the endpoint** with valid and invalid data
- [ ] **Document the pattern** for the team

## Testing the Refactored Endpoint

```bash
# Valid request
curl -X POST http://localhost:3000/api/auth/sign-up \
  -H "Content-Type: application/json" \
  -d '{
    "email": "  USER@EXAMPLE.COM  ",
    "password": "securepass123",
    "name": "  John   Doe  "
  }'

# Response includes sanitized data:
# email: "user@example.com" (lowercase, trimmed)
# name: "John Doe" (trimmed, normalized spaces)

# Invalid request
curl -X POST http://localhost:3000/api/auth/sign-up \
  -H "Content-Type: application/json" \
  -d '{
    "email": "not-an-email",
    "password": "short",
    "name": ""
  }'

# Response includes detailed validation errors:
{
  "error": "Invalid email format",
  "field": "email",
  "details": {
    "issues": [
      { "path": "email", "message": "Invalid email format" },
      { "path": "password", "message": "Password must be at least 8 characters long" },
      { "path": "name", "message": "Name is required" }
    ]
  }
}
```

## Next Steps

Other API endpoints to migrate:
1. **Sign-in endpoint** - Similar validation needs (email, password)
2. **Create site endpoint** - Complex nested validation (settings, theme, SEO)
3. **Create page endpoint** - Validation with relationships (parent pages, templates)
4. **Update user profile** - Partial validation (optional fields)

## Related Documentation

- [Type System Architecture](./TYPE_SYSTEM.md)
- [Contract System Overview](./CONTRACTS.md)
- [API Contracts](../packages/contracts/src/api/README.md)
