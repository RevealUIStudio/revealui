# Request Tracing & Context

Distributed tracing infrastructure for tracking requests across services with automatic request ID generation and propagation.

## Overview

Request tracing enables you to:
- **Track requests across services**: Follow a single request through multiple microservices
- **Debug production issues**: Find all logs related to a specific request
- **Measure performance**: Track request timing and duration
- **Correlate errors**: Link errors back to the original request
- **Audit user actions**: Track what users did and when

## Quick Start

### 1. Wrap API Routes

```typescript
// app/api/users/route.ts
import { withRequestContext } from '@revealui/core/utils/api-wrapper'
import { NextResponse } from 'next/server'
import { logger } from '@revealui/core/utils/logger'

export const GET = withRequestContext(async (request) => {
  // Request ID automatically available in all logs
  logger.info('Fetching users') // ✅ Includes requestId

  const users = await db.query.users.findMany()

  logger.info('Found users', { count: users.length }) // ✅ Includes requestId

  return NextResponse.json(users)
})
```

### 2. Automatic Request ID Propagation

```typescript
// All logs from this request will have the same requestId
[2026-02-01T12:00:00.000Z] [INFO] Incoming request {"requestId":"abc-123","method":"GET","path":"/api/users"}
[2026-02-01T12:00:00.050Z] [INFO] Fetching users {"requestId":"abc-123"}
[2026-02-01T12:00:00.100Z] [INFO] Found users {"requestId":"abc-123","count":42}
[2026-02-01T12:00:00.150Z] [INFO] Request completed {"requestId":"abc-123","status":200,"duration":150}
```

### 3. Response Headers

Every response includes request tracking headers:

```
x-request-id: abc-123
x-request-duration: 150
```

Clients can use these headers for:
- Error reporting (include request ID in bug reports)
- Performance monitoring
- Request correlation

---

## Features

### Automatic Request ID Generation

```typescript
// Middleware automatically generates unique request IDs
// Uses UUID v4 for guaranteed uniqueness

GET /api/users
Response Headers:
  x-request-id: 550e8400-e29b-41d4-a716-446655440000
```

### Request ID Extraction

```typescript
// If client sends request ID, it's preserved
// Supports multiple header formats:

Request Headers:
  x-request-id: custom-123        // ✅ Standard
  x-correlation-id: custom-123    // ✅ Correlation pattern
  x-trace-id: custom-123          // ✅ OpenTelemetry
  request-id: custom-123          // ✅ Simple

Response will use the same ID:
  x-request-id: custom-123
```

### Automatic Logging Enhancement

```typescript
// Logger automatically includes request ID
import { logger } from '@revealui/core/utils/logger'

// Without request context:
logger.info('User logged in')
// Output: [2026-02-01T12:00:00.000Z] [INFO] User logged in

// With request context:
logger.info('User logged in')
// Output: [2026-02-01T12:00:00.000Z] [INFO] User logged in {"requestId":"abc-123"}
```

---

## API Routes

### Basic API Route

```typescript
import { withRequestContext } from '@revealui/core/utils/api-wrapper'
import { NextResponse } from 'next/server'
import { logger } from '@revealui/core/utils/logger'

export const GET = withRequestContext(async (request) => {
  logger.info('Processing request')

  const data = await fetchData()

  return NextResponse.json(data)
})
```

**Features**:
- ✅ Automatic request ID generation
- ✅ Request/response logging
- ✅ Error handling with proper status codes
- ✅ Request timing
- ✅ Response headers (x-request-id, x-request-duration)

### POST with Validation

```typescript
export const POST = withRequestContext(async (request) => {
  const body = await request.json()

  logger.info('Creating user', { email: body.email })

  // Validation
  if (!body.email) {
    throw new ValidationError('Email is required', 'email', body.email)
  }

  // Database operation
  try {
    const user = await db.insert(users).values(body)
    logger.info('User created', { userId: user.id })
    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    // Error automatically logged with request ID
    throw error
  }
})
```

### Error Handling

```typescript
export const DELETE = withRequestContext(async (request) => {
  const id = request.nextUrl.searchParams.get('id')

  if (!id) {
    throw new ApplicationError('User ID required', 'MISSING_ID', 400)
  }

  try {
    await db.delete(users).where(eq(users.id, id))
    return NextResponse.json({ success: true })
  } catch (error) {
    // Errors are automatically:
    // 1. Logged with request ID
    // 2. Converted to proper API responses
    // 3. Include request ID in response headers
    throw error
  }
})
```

---

## Server Actions

### Basic Server Action

```typescript
'use server'

import { withServerActionContext } from '@revealui/core/utils/api-wrapper'
import { logger } from '@revealui/core/utils/logger'

export const createPost = withServerActionContext(async (data) => {
  logger.info('Creating post', { title: data.title })

  const post = await db.insert(posts).values(data)

  logger.info('Post created', { postId: post.id })

  return post
})
```

### With Authentication

```typescript
'use server'

import { withServerActionContext } from '@revealui/core/utils/api-wrapper'
import { updateRequestContext } from '@revealui/core/utils/request-context'
import { logger } from '@revealui/core/utils/logger'
import { getCurrentUser } from '@/lib/auth'

export const updateProfile = withServerActionContext(async (data) => {
  const user = await getCurrentUser()

  // Add user ID to context for all subsequent logs
  updateRequestContext({ userId: user.id })

  logger.info('Updating profile') // Now includes userId

  const updated = await db.update(profiles)
    .set(data)
    .where(eq(profiles.userId, user.id))

  logger.info('Profile updated')

  return updated
})
```

---

## Manual Context Management

### Accessing Request Context

```typescript
import { getRequestContext, getRequestId } from '@revealui/core/utils/request-context'

// Get full context
const context = getRequestContext()
if (context) {
  console.log('Request ID:', context.requestId)
  console.log('Path:', context.path)
  console.log('Method:', context.method)
  console.log('User ID:', context.userId)
}

// Get just request ID
const requestId = getRequestId()
if (requestId) {
  console.log('Request ID:', requestId)
}
```

### Updating Context

```typescript
import { updateRequestContext } from '@revealui/core/utils/request-context'

// Add user ID after authentication
updateRequestContext({ userId: user.id })

// Add custom metadata
updateRequestContext({
  metadata: {
    experimentId: 'exp-123',
    featureFlag: 'new-ui',
  },
})
```

### Manual Context Creation

```typescript
import { runInRequestContext, createRequestContext } from '@revealui/core/utils/request-context'

// For background jobs, cron tasks, etc.
const context = createRequestContext({
  path: '/jobs/send-emails',
  method: 'CRON',
})

await runInRequestContext(context, async () => {
  // All code here has request context
  logger.info('Starting email job') // Includes requestId

  await sendEmails()

  logger.info('Email job complete')
})
```

---

## Service-to-Service Communication

### Propagating Request ID to External Services

```typescript
import { getRequestHeaders } from '@revealui/core/utils/request-context'

// Automatically propagate request ID to downstream services
const response = await fetch('https://api.example.com/users', {
  headers: {
    ...getRequestHeaders(), // ✅ Includes x-request-id
    'Authorization': 'Bearer token',
    'Content-Type': 'application/json',
  },
})
```

### Full Example with External API

```typescript
export const GET = withRequestContext(async (request) => {
  logger.info('Fetching user data from external API')

  // Call external service with request ID
  const response = await fetch('https://api.example.com/users/123', {
    headers: {
      ...getRequestHeaders(), // Propagates x-request-id
      'Authorization': 'Bearer token',
    },
  })

  if (!response.ok) {
    logger.error('External API failed', {
      status: response.status,
      // requestId automatically included
    })
    throw new Error('External API error')
  }

  const data = await response.json()

  logger.info('External API success', {
    userId: data.id,
    // requestId automatically included
  })

  return NextResponse.json(data)
})
```

---

## Request Timing

### Automatic Duration Tracking

```typescript
import { getRequestDuration } from '@revealui/core/utils/request-context'

export const GET = withRequestContext(async (request) => {
  logger.info('Starting request')

  await someSlowOperation()

  const duration = getRequestDuration()
  logger.info('Operation completed', { duration })

  // Response automatically includes x-request-duration header
  return NextResponse.json({ success: true })
})
```

### Performance Monitoring

```typescript
export const GET = withRequestContext(async (request) => {
  const startDb = Date.now()
  const users = await db.query.users.findMany()
  const dbDuration = Date.now() - startDb

  logger.info('Database query completed', {
    dbDuration,
    count: users.length,
  })

  const startApi = Date.now()
  await enrichUserData(users)
  const apiDuration = Date.now() - startApi

  logger.info('API enrichment completed', {
    apiDuration,
  })

  const totalDuration = getRequestDuration()
  logger.info('Request completed', {
    totalDuration,
    breakdown: { db: dbDuration, api: apiDuration },
  })

  return NextResponse.json(users)
})
```

---

## Debugging in Production

### Finding All Logs for a Request

When a user reports an error, get the request ID from:
1. Error message (if your error reporting includes it)
2. Response header (x-request-id)
3. Browser console (log response headers)

Then search logs:

```bash
# Grep logs for specific request
grep "requestId\":\"abc-123" app.log

# Output:
[2026-02-01T12:00:00.000Z] [INFO] Incoming request {"requestId":"abc-123","method":"POST","path":"/api/users"}
[2026-02-01T12:00:00.050Z] [INFO] Validating user data {"requestId":"abc-123"}
[2026-02-01T12:00:00.075Z] [ERROR] Validation failed {"requestId":"abc-123","field":"email"}
[2026-02-01T12:00:00.100Z] [ERROR] Request failed {"requestId":"abc-123","status":400,"duration":100}
```

### Client-Side Error Reporting

```typescript
// client/error-handler.ts
async function reportError(error: Error) {
  // Get request ID from most recent API call
  const lastRequestId = localStorage.getItem('last-request-id')

  await fetch('/api/errors', {
    method: 'POST',
    body: JSON.stringify({
      message: error.message,
      stack: error.stack,
      requestId: lastRequestId, // ✅ Include for debugging
    }),
  })
}

// Save request ID from API responses
async function apiCall(url: string) {
  const response = await fetch(url)

  // Save request ID for error reporting
  const requestId = response.headers.get('x-request-id')
  if (requestId) {
    localStorage.setItem('last-request-id', requestId)
  }

  return response
}
```

---

## Middleware Configuration

### Next.js Middleware (CMS App)

```typescript
// apps/admin/src/middleware.ts
import { createRequestContext, extractRequestId, generateRequestId } from '@revealui/core/utils/request-context'
import { NextResponse } from 'next/server'

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

export function middleware(request: NextRequest) {
  const existingRequestId = extractRequestId(Object.fromEntries(request.headers.entries()))
  const requestId = existingRequestId || generateRequestId()

  const context = createRequestContext({
    headers: Object.fromEntries(request.headers.entries()),
    path: request.nextUrl.pathname,
    method: request.method,
    ip: request.ip || request.headers.get('x-forwarded-for') || undefined,
  })

  const response = NextResponse.next()

  // Add request ID to response
  response.headers.set('x-request-id', requestId)
  response.headers.set('Access-Control-Expose-Headers', 'x-request-id')

  // Add timing
  const duration = Date.now() - context.startTime
  response.headers.set('x-request-duration', duration.toString())

  return response
}
```

---

## Best Practices

### 1. Always Use Request Context for API Routes

```typescript
// ✅ Good: Use withRequestContext wrapper
export const GET = withRequestContext(async (request) => {
  // Request ID available, automatic error handling
  return NextResponse.json({ data })
})

// ❌ Bad: Manual handling
export async function GET(request: NextRequest) {
  // No request ID, no automatic error handling
  return NextResponse.json({ data })
}
```

### 2. Include Request ID in External Error Reports

```typescript
import { getRequestId } from '@revealui/core/utils/request-context'
import * as Sentry from '@sentry/nextjs'

try {
  await riskyOperation()
} catch (error) {
  // Include request ID in Sentry
  Sentry.captureException(error, {
    tags: {
      requestId: getRequestId(),
    },
  })

  throw error
}
```

### 3. Propagate Request ID to All Services

```typescript
// ✅ Good: Propagate request ID
const response = await fetch(url, {
  headers: {
    ...getRequestHeaders(), // Includes x-request-id
    'Authorization': 'Bearer token',
  },
})

// ❌ Bad: No propagation (loses trace)
const response = await fetch(url, {
  headers: {
    'Authorization': 'Bearer token',
  },
})
```

### 4. Log at Key Decision Points

```typescript
export const POST = withRequestContext(async (request) => {
  const data = await request.json()

  // Log input
  logger.info('Creating order', { userId: data.userId, items: data.items.length })

  // Log validation
  if (!isValid(data)) {
    logger.warn('Invalid order data', { errors: validate(data) })
    throw new ValidationError('Invalid data', 'order', data)
  }

  // Log business logic
  logger.info('Processing payment', { amount: data.total })
  await processPayment(data)

  // Log success
  logger.info('Order created successfully', { orderId: order.id })

  return NextResponse.json(order)
})
```

### 5. Track Slow Requests

```typescript
export const GET = withRequestContext(async (request) => {
  const result = await fetchData()

  const duration = getRequestDuration()

  // Alert on slow requests
  if (duration > 1000) {
    logger.warn('Slow request detected', {
      duration,
      path: request.nextUrl.pathname,
      // Consider optimization
    })
  }

  return NextResponse.json(result)
})
```

---

## Integration with Monitoring

### Sentry Integration

```typescript
import * as Sentry from '@sentry/nextjs'
import { getRequestContext } from '@revealui/core/utils/request-context'

Sentry.init({
  beforeSend(event) {
    const context = getRequestContext()
    if (context) {
      event.tags = {
        ...event.tags,
        requestId: context.requestId,
      }
      event.contexts = {
        ...event.contexts,
        request: {
          requestId: context.requestId,
          path: context.path,
          method: context.method,
          userId: context.userId,
        },
      }
    }
    return event
  },
})
```

### Custom Metrics

```typescript
import { getRequestContext } from '@revealui/core/utils/request-context'

function trackMetric(name: string, value: number) {
  const context = getRequestContext()

  metrics.track({
    name,
    value,
    tags: {
      requestId: context?.requestId,
      path: context?.path,
      userId: context?.userId,
    },
  })
}
```

---

## Testing

### Unit Tests with Request Context

```typescript
import { describe, it, expect } from 'vitest'
import { runInRequestContext, createRequestContext, getRequestId } from '@revealui/core/utils/request-context'

describe('User Service', () => {
  it('should create user with request context', async () => {
    const context = createRequestContext({
      path: '/api/users',
      method: 'POST',
    })

    await runInRequestContext(context, async () => {
      // Request ID available in service
      const requestId = getRequestId()
      expect(requestId).toBeDefined()

      // Create user
      const user = await createUser({ email: 'test@example.com' })

      // Verify logs include request ID
      expect(user).toBeDefined()
    })
  })
})
```

---

## Reference

### Request Context API

| Function | Description | Returns |
|----------|-------------|---------|
| `generateRequestId()` | Generate new UUID request ID | `string` |
| `getRequestContext()` | Get current request context | `RequestContext \| undefined` |
| `getRequestId()` | Get current request ID | `string \| undefined` |
| `getRequestDuration()` | Get request duration in ms | `number \| undefined` |
| `getRequestHeaders()` | Get headers for service calls | `Record<string, string>` |
| `runInRequestContext(ctx, fn)` | Run function in context | `T` |
| `updateRequestContext(updates)` | Update current context | `void` |
| `createRequestContext(opts)` | Create new context | `RequestContext` |
| `extractRequestId(headers)` | Extract ID from headers | `string \| undefined` |

### Wrapper API

| Function | Description |
|----------|-------------|
| `withRequestContext(handler)` | Wrap API route handler |
| `withServerActionContext(action)` | Wrap server action |

### Request Context Type

```typescript
interface RequestContext {
  requestId: string
  startTime: number
  userId?: string
  ip?: string
  userAgent?: string
  path?: string
  method?: string
  metadata?: Record<string, unknown>
}
```

---

**Last Updated**: 2026-02-01
**Version**: 1.0.0
