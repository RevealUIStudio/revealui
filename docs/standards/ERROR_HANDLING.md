# Error Handling Strategy

This document outlines error handling patterns for RevealUI Framework.

## Overview

RevealUI uses consistent error handling patterns across all packages:
- Standardized error types
- Proper error propagation
- User-friendly error messages
- Error logging integration
- Error monitoring integration

## Error Handling Patterns

### 1. API Route Handlers

**Pattern:**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@revealui/core/utils/logger'

export async function GET(req: NextRequest) {
  try {
    // Business logic
    const data = await fetchData()
    return NextResponse.json({ data })
  } catch (error) {
    logger.error('Failed to fetch data', {
      error: error instanceof Error ? error.message : String(error),
      path: req.url,
    })
    
    // Return user-friendly error
    return NextResponse.json(
      { error: 'Failed to fetch data' },
      { status: 500 }
    )
  }
}
```

**Best Practices:**
- Always wrap business logic in try-catch
- Log errors with context
- Return user-friendly messages (don't expose internals)
- Use appropriate HTTP status codes

### 2. Server Functions

**Pattern:**
```typescript
import { logger } from '@revealui/core/utils/logger'

export async function processDocument(id: string) {
  try {
    // Business logic
    return { success: true, data }
  } catch (error) {
    logger.error('Failed to process document', {
      documentId: id,
      error: error instanceof Error ? error.message : String(error),
    })
    
    // Re-throw or return error result
    throw error
  }
}
```

### 3. Validation Errors

**Pattern:**
```typescript
import { z } from 'zod/v4'
import { logger } from '@revealui/core/utils/logger'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export async function validateInput(data: unknown) {
  try {
    return schema.parse(data)
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Validation failed', {
        errors: error.errors,
      })
      // Return validation errors
      throw new Error(`Validation failed: ${error.errors.map(e => e.message).join(', ')}`)
    }
    throw error
  }
}
```

### 4. Database Errors

**Pattern:**
```typescript
import { logger } from '@revealui/core/utils/logger'

export async function createUser(data: UserData) {
  try {
    return await db.insert(users).values(data)
  } catch (error) {
    // Check for specific database errors
    if (error instanceof Error && error.message.includes('unique')) {
      logger.warn('User already exists', { email: data.email })
      throw new Error('User already exists')
    }
    
    logger.error('Database error', {
      error: error instanceof Error ? error.message : String(error),
      operation: 'createUser',
    })
    
    throw new Error('Failed to create user')
  }
}
```

## Error Types

### Application Errors

**Use for:**
- Business logic failures
- Validation failures
- Expected errors

```typescript
class ApplicationError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
  ) {
    super(message)
    this.name = 'ApplicationError'
  }
}

// Usage
throw new ApplicationError('User not found', 'USER_NOT_FOUND', 404)
```

### Validation Errors

**Use for:**
- Input validation failures
- Schema validation failures

```typescript
class ValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public value: unknown,
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}
```

## Error Monitoring

### Sentry Integration

Sentry is configured in `apps/cms/next.config.mjs` and will automatically capture errors.

**Manual Error Capture:**
```typescript
import * as Sentry from '@sentry/nextjs'

try {
  // Code that might fail
} catch (error) {
  Sentry.captureException(error, {
    tags: { component: 'user-service' },
    extra: { userId: '123' },
  })
  throw error
}
```

**Configuration:**
```bash
# Set Sentry DSN
NEXT_PUBLIC_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
SENTRY_ORG=your-org
SENTRY_PROJECT=your-project
```

## Error Response Format

### Standard API Error Response

```typescript
interface ErrorResponse {
  error: string
  code?: string
  details?: unknown
}

// Example
{
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": {
    "field": "email",
    "message": "Invalid email format"
  }
}
```

## Best Practices

### 1. Don't Expose Internals

❌ **Bad:**
```typescript
catch (error) {
  return NextResponse.json({ error: error.message }, { status: 500 })
}
```

✅ **Good:**
```typescript
catch (error) {
  logger.error('Internal error', { error: error.message })
  return NextResponse.json(
    { error: 'An error occurred' },
    { status: 500 }
  )
}
```

### 2. Include Context

✅ **Good:**
```typescript
logger.error('Failed to process payment', {
  userId: user.id,
  amount: payment.amount,
  error: error.message,
})
```

### 3. Use Appropriate Status Codes

- `400` - Bad Request (validation errors)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (permission denied)
- `404` - Not Found (resource doesn't exist)
- `409` - Conflict (resource already exists)
- `500` - Internal Server Error (unexpected errors)

### 4. Log Before Re-throwing

✅ **Good:**
```typescript
catch (error) {
  logger.error('Operation failed', { context })
  throw error  // Re-throw for error monitoring
}
```

## Testing Error Handling

```typescript
import { expect } from 'vitest'

it('should handle errors gracefully', async () => {
  await expect(functionThatThrows()).rejects.toThrow(ApplicationError)
  
  // Or check error response
  const response = await request('/api/endpoint')
  expect(response.status).toBe(500)
  expect(response.body.error).toBeDefined()
})
```

## Future Enhancements

- [ ] Custom error classes for specific error types
- [ ] Error recovery strategies
- [ ] Circuit breaker pattern for external services
- [ ] Retry logic with exponential backoff
- [ ] Error aggregation and analysis
