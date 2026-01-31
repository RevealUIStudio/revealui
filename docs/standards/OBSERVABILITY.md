# Observability: Error Handling & Logging

This document outlines error handling and logging strategies for RevealUI Framework, providing comprehensive guidance on observability practices.

---

## Table of Contents

- [Overview](#overview)
- [Logging Strategy](#logging-strategy)
  - [Basic Usage](#basic-usage)
  - [Log Levels](#log-levels)
  - [Configuration](#configuration)
  - [Best Practices](#logging-best-practices)
- [Error Handling](#error-handling)
  - [Error Handling Patterns](#error-handling-patterns)
  - [Error Types](#error-types)
  - [Error Response Format](#error-response-format)
  - [Best Practices](#error-handling-best-practices)
- [Error Monitoring](#error-monitoring)
- [Testing](#testing)
- [Future Enhancements](#future-enhancements)

---

## Overview

RevealUI uses consistent observability patterns across all packages:
- Standardized error types
- Structured logging with configurable log levels
- Proper error propagation
- User-friendly error messages
- Error logging integration
- Error monitoring integration

---

## Logging Strategy

### Basic Usage

```typescript
import { logger } from '@revealui/core/utils/logger'

// Info log
logger.info('User logged in', { userId: '123', email: 'user@example.com' })

// Warning log
logger.warn('Rate limit approaching', { userId: '123', requests: 95 })

// Error log
logger.error('Failed to save document', {
  documentId: '456',
  error: error.message
})

// Debug log (only in development)
logger.debug('Cache hit', { key: 'user:123' })
```

### Creating Custom Logger

```typescript
import { createLogger } from '@revealui/core/utils/logger'

// Create logger with custom log level
const logger = createLogger('debug') // Options: 'debug' | 'info' | 'warn' | 'error'
```

### Log Levels

| Level | Use Case | Default Output |
|-------|----------|----------------|
| `debug` | Development debugging | Only in development |
| `info` | General information | ✅ Always |
| `warn` | Warnings, non-critical issues | ✅ Always |
| `error` | Errors, failures | ✅ Always |

### Configuration

#### Environment Variables

```bash
# Set minimum log level (default: 'info')
LOG_LEVEL=debug  # Options: debug, info, warn, error
```

#### Production Logging

In production, the logger can be extended to use structured logging services:

1. **Vercel** - Automatic log aggregation
2. **Sentry** - Error monitoring (already configured)
3. **Datadog** - APM and logging
4. **CloudWatch** - AWS logging

To integrate with a logging service, modify `packages/core/src/core/utils/logger.ts`:

```typescript
export function createLogger(minLevel?: LogLevel): Logger {
  if (process.env.LOG_SERVICE === 'datadog') {
    return new DatadogLogger(minLevel)
  }
  // Default console logger
  return new ConsoleLogger(minLevel)
}
```

### Logging Best Practices

#### 1. Use Structured Data

✅ **Good:**
```typescript
logger.error('Failed to save document', {
  documentId: '123',
  collection: 'pages',
  userId: '456',
  error: error.message,
})
```

❌ **Bad:**
```typescript
logger.error(`Failed to save document ${documentId} for user ${userId}: ${error}`)
```

#### 2. Include Context

Always include relevant context:
- User ID (if available)
- Request ID (if available)
- Resource IDs
- Error details

#### 3. Appropriate Log Levels

- **debug**: Development debugging, verbose information
- **info**: Important events (user actions, successful operations)
- **warn**: Non-critical issues (rate limits, missing optional data)
- **error**: Failures, exceptions, critical issues

#### 4. Don't Log Sensitive Data

❌ **Never log:**
- Passwords
- Tokens (API keys, session tokens)
- Credit card numbers
- PII (personally identifiable information) unless necessary

#### 5. Performance Considerations

- Don't log in tight loops
- Use `debug` level for verbose logging
- Consider log volume in production

### Migration from console.log

#### Before
```typescript
console.log('User logged in:', userId)
console.error('Error:', error)
```

#### After
```typescript
import { logger } from '@revealui/core/utils/logger'

logger.info('User logged in', { userId })
logger.error('Error', { error: error.message })
```

---

## Error Handling

### Error Handling Patterns

#### 1. API Route Handlers

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

#### 2. Server Functions

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

#### 3. Validation Errors

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

#### 4. Database Errors

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

### Error Types

#### Application Errors

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

#### Validation Errors

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

### Error Response Format

#### Standard API Error Response

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

### Error Handling Best Practices

#### 1. Don't Expose Internals

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

#### 2. Include Context

✅ **Good:**
```typescript
logger.error('Failed to process payment', {
  userId: user.id,
  amount: payment.amount,
  error: error.message,
})
```

#### 3. Use Appropriate Status Codes

- `400` - Bad Request (validation errors)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (permission denied)
- `404` - Not Found (resource doesn't exist)
- `409` - Conflict (resource already exists)
- `500` - Internal Server Error (unexpected errors)

#### 4. Log Before Re-throwing

✅ **Good:**
```typescript
catch (error) {
  logger.error('Operation failed', { context })
  throw error  // Re-throw for error monitoring
}
```

---

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

### Integration with Error Monitoring

The logger works with error monitoring services:

```typescript
// Sentry integration (if configured)
import * as Sentry from '@sentry/nextjs'

logger.error('Failed operation', { context })
// Sentry will automatically capture this if error monitoring is configured
```

---

## Testing

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

---

## Future Enhancements

- [ ] Custom error classes for specific error types
- [ ] Error recovery strategies
- [ ] Circuit breaker pattern for external services
- [ ] Retry logic with exponential backoff
- [ ] Error aggregation and analysis
- [ ] Structured logging service integration (Datadog, CloudWatch)
- [ ] Log aggregation configuration
- [ ] Request ID tracking
- [ ] Performance metrics logging
- [ ] Audit log integration

---

## Related Documentation

- [CODE_STYLE.md](./CODE_STYLE.md) - Code style and formatting standards
- [SAFEGUARDS.md](./SAFEGUARDS.md) - Development safeguards and quality gates
- [MODULE_RESOLUTION_STRATEGY.md](./MODULE_RESOLUTION_STRATEGY.md) - Module resolution patterns
