# Error Response Utilities Guide

This guide explains when and how to use the different error response utilities in the CMS app.

## Overview

The CMS app provides two sets of error response utilities to handle different routing contexts:

1. **`error-response.ts`** - For Next.js route handlers (uses `NextResponse`)
2. **`error-response-handler.ts`** - For RevealHandler routes (uses standard `Response`)

Both utilities use the same `ErrorResponse` interface for consistency, ensuring all error responses follow the same format regardless of where they're generated.

## Error Response Format

All error responses follow this standard format:

```typescript
interface ErrorResponse {
  error: string        // Error type/category (e.g., 'VALIDATION_ERROR', 'UNAUTHORIZED')
  message: string      // Human-readable error message
  code?: string        // Optional error code for programmatic handling
  details?: unknown    // Optional additional details (validation errors, context, etc.)
}
```

## When to Use Which Utility

### Use `error-response.ts` for Next.js Route Handlers

**Location**: `apps/cms/src/lib/utils/error-response.ts`

**Use when**:
- Creating API routes in `apps/cms/src/app/api/`
- Routes that use Next.js `NextRequest` and return `NextResponse`
- Example: Chat API, admin routes, etc.

**Example**:
```typescript
import { NextRequest } from 'next/server'
import {
  createErrorResponse,
  createValidationErrorResponse,
  createApplicationErrorResponse,
} from '@/lib/utils/error-response'

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    
    // Validation
    if (!data.email) {
      return createValidationErrorResponse(
        'Email is required',
        'email',
        data.email,
      )
    }

    // Business logic...
    return NextResponse.json({ success: true })
  } catch (error) {
    return createErrorResponse(error, {
      endpoint: '/api/users',
      method: 'POST',
    })
  }
}
```

### Use `error-response-handler.ts` for RevealHandler Routes

**Location**: `apps/cms/src/lib/utils/error-response-handler.ts`

**Use when**:
- Creating handlers that use `RevealHandler` type
- Routes that need to return standard `Response` objects (not `NextResponse`)
- Example: Stripe proxy handlers, collection hooks, custom endpoints

**Important**: `RevealHandler` requires `Promise<Response> | Response`, so you **cannot** use `NextResponse` here.

**Example**:
```typescript
import type { RevealHandler, RevealRequest } from '@revealui/core'
import {
  createErrorResponse,
  createValidationErrorResponse,
  createApplicationErrorResponse,
} from '@/lib/utils/error-response-handler'

export const myHandler: RevealHandler = async (req: RevealRequest) => {
  if (!req.user) {
    return createApplicationErrorResponse('Unauthorized', 'UNAUTHORIZED', 401)
  }

  try {
    // Parse request body
    if (!req.body) {
      return createValidationErrorResponse('No body provided', 'body', null)
    }

    // Business logic...
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return createErrorResponse(error, {
      endpoint: '/api/custom',
      operation: 'my_operation',
    })
  }
}
```

## Available Functions

Both utilities provide the same set of functions (with different return types):

### `createErrorResponse(error, context?)`

Converts any error to a standardized error response.

- **Parameters**:
  - `error`: Any error (Error, ValidationError, ApplicationError, string, etc.)
  - `context`: Optional context object for error handling
- **Returns**: `NextResponse<ErrorResponse>` or `Response` (depending on utility)

```typescript
// Handles all error types automatically
const response = createErrorResponse(new Error('Database connection failed'), {
  endpoint: '/api/users',
  operation: 'list_users',
})
```

### `createValidationErrorResponse(message, field, value, details?)`

Creates a validation error response (400 status).

- **Parameters**:
  - `message`: Error message
  - `field`: Field that failed validation
  - `value`: Invalid value
  - `details`: Optional additional validation details
- **Returns**: `NextResponse<ErrorResponse>` or `Response` (400 status)

```typescript
const response = createValidationErrorResponse(
  'Invalid email format',
  'email',
  'not-an-email',
  {
    expectedFormat: 'email@example.com',
  },
)
```

### `createApplicationErrorResponse(message, code, statusCode?, context?)`

Creates an application error response with custom status code.

- **Parameters**:
  - `message`: Error message
  - `code`: Error code (e.g., 'NOT_FOUND', 'UNAUTHORIZED')
  - `statusCode`: HTTP status code (default: 500)
  - `context`: Optional additional context
- **Returns**: `NextResponse<ErrorResponse>` or `Response`

```typescript
const response = createApplicationErrorResponse(
  'Resource not found',
  'NOT_FOUND',
  404,
  {
    resource: 'user',
    id: '123',
  },
)
```

### `createSuccessResponse(data, statusCode?)` (Next.js only)

Creates a success response with data. Only available in `error-response.ts`.

- **Parameters**:
  - `data`: Response data
  - `statusCode`: HTTP status code (default: 200)
- **Returns**: `NextResponse<T>`

```typescript
const response = createSuccessResponse({ id: '123', name: 'Test' }, 201)
```

## Error Types from @revealui/core

The utilities integrate with error classes from `@revealui/core/utils/errors`:

- **`ValidationError`**: For input validation errors (automatically returns 400)
- **`ApplicationError`**: For application-level errors (custom status code)

```typescript
import { ValidationError, ApplicationError } from '@revealui/core/utils/errors'

// These are automatically handled correctly by createErrorResponse()
throw new ValidationError('Invalid input', 'email', 'value')
throw new ApplicationError('Not found', 'NOT_FOUND', 404)
```

## Best Practices

1. **Use the correct utility for your route type**
   - ❌ Don't use `error-response.ts` in `RevealHandler` routes
   - ❌ Don't use `error-response-handler.ts` in Next.js route handlers
   - ✅ Check your route's return type to determine which to use

2. **Always wrap request.json() in try/catch**
   ```typescript
   try {
     const data = await request.json()
   } catch (error) {
     return createValidationErrorResponse(
       'Invalid JSON in request body',
       'body',
       null,
       { parseError: error.message },
     )
   }
   ```

3. **Provide context for errors**
   ```typescript
   return createErrorResponse(error, {
     endpoint: '/api/users',
     operation: 'create_user',
     userId: user.id,
   })
   ```

4. **Use specific error types when possible**
   ```typescript
   // Good: Specific validation error
   return createValidationErrorResponse('Email required', 'email', null)

   // Good: Specific application error
   return createApplicationErrorResponse('Not authorized', 'UNAUTHORIZED', 401)

   // Fallback: Generic error handler
   return createErrorResponse(error)
   ```

5. **Keep error messages user-friendly**
   - ✅ "Invalid email format"
   - ❌ "Email validation failed: regex mismatch at position 3"

## Migration Guide

If you have existing routes with custom error handling:

### Before
```typescript
return new Response(JSON.stringify({ error: 'Invalid input' }), {
  status: 400,
  headers: { 'Content-Type': 'application/json' },
})
```

### After
```typescript
// For Next.js routes:
return createValidationErrorResponse('Invalid input', 'body', data)

// For RevealHandler routes:
return createHandlerValidationErrorResponse('Invalid input', 'body', data)
```

## Type Safety

Both utilities are fully typed with TypeScript:

- `error-response.ts` returns `NextResponse<ErrorResponse>`
- `error-response-handler.ts` returns `Response`
- Both use the shared `ErrorResponse` interface from `error-types.ts`

This ensures type safety while maintaining consistency across different routing contexts.

## Testing

See `apps/cms/src/lib/utils/__tests__/error-response.test.ts` for integration tests covering both utilities.

## Migration Checklist

Use this checklist to migrate existing routes to use error utilities:

- [ ] Replace `NextResponse.json({ error: ... }, { status: ... })` with error utilities
- [ ] Wrap `request.json()` in try/catch with `createValidationErrorResponse`
- [ ] Replace validation checks with `createValidationErrorResponse`
- [ ] Replace authorization checks with `createApplicationErrorResponse`
- [ ] Replace catch blocks to use `createErrorResponse` instead of `handleApiError` + manual Response
- [ ] Remove unused `handleApiError` imports (keep `logger` if needed)
- [ ] Test error responses match the standard format

### Current Adoption Status

**All routes migrated! ✅** (17/17 routes using error utilities)

- ✅ Auth routes (6): sign-up, sign-in, me, session, sign-out, password-reset
- ✅ Memory routes (5): episodic, search, working, context
- ✅ Shape routes (3): conversations, agent-contexts, agent-memories
- ✅ GDPR routes (2): export, delete
- ✅ Chat route (1): chat

## Related Files

- `apps/cms/src/lib/utils/error-types.ts` - Shared ErrorResponse interface
- `apps/cms/src/lib/utils/error-response.ts` - Next.js route handler utilities
- `apps/cms/src/lib/utils/error-response-handler.ts` - RevealHandler utilities
- `@revealui/core/utils/errors` - Base error classes (ValidationError, ApplicationError)
