# Database Error Handling

Comprehensive Postgres error code parsing and handling for robust database operations.

## Overview

The database error handling system provides:

- **Postgres Error Code Parsing**: Maps Postgres error codes to user-friendly messages
- **Contextual Error Information**: Includes constraint names, table names, column names
- **Retry Guidance**: Flags transient errors that can be retried
- **Production Logging**: Structured logging with full error context
- **Type Safety**: TypeScript error classes with all metadata

## Quick Start

### Basic Usage

```typescript
import { handleDatabaseError } from '@revealui/core/utils/errors'
import { db } from '@revealui/db'

try {
  await db.insert(users).values({
    email: 'user@example.com',
    name: 'John Doe',
  })
} catch (error) {
  handleDatabaseError(error, 'insert user', { email: 'user@example.com' })
}
```

### API Route Usage

```typescript
import { handleApiError, handleDatabaseError } from '@revealui/core/utils/errors'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const data = await request.json()
    const user = await db.insert(users).values(data)
    return NextResponse.json(user)
  } catch (error) {
    // Convert database error to API response
    const apiError = handleApiError(
      handleDatabaseError(error, 'create user', { email: data.email }),
    )
    return NextResponse.json({ error: apiError.message }, { status: apiError.statusCode })
  }
}
```

## Error Types

### DatabaseError Class

```typescript
class DatabaseError extends Error {
  constructor(
    message: string,        // User-friendly message
    code: string,          // Error code (e.g., 'UNIQUE_VIOLATION')
    statusCode: number,    // HTTP status code
    pgCode?: string,       // Postgres error code (e.g., '23505')
    constraint?: string,   // Constraint name (e.g., 'users_email_unique')
    table?: string,        // Table name (e.g., 'users')
    column?: string,       // Column name (e.g., 'email')
    context?: object,      // Additional context
  )
}
```

## Supported Error Codes

### Integrity Constraint Violations (Class 23)

#### Unique Violation (23505)

**What it means**: Attempting to insert or update a row that violates a unique constraint.

**Example**:
```typescript
// Trying to insert duplicate email
await db.insert(users).values({ email: 'existing@example.com' })

// Error thrown:
DatabaseError {
  message: "Duplicate users email unique: this value already exists",
  code: "UNIQUE_VIOLATION",
  statusCode: 409,
  pgCode: "23505",
  constraint: "users_email_unique",
  table: "users"
}
```

**How to handle**:
- Show user-friendly message: "This email is already registered"
- Suggest alternatives (login instead of signup)
- Do not retry - will always fail

#### Foreign Key Violation (23503)

**What it means**: Attempting to insert/update with a foreign key that doesn't exist in the referenced table.

**Example**:
```typescript
// Trying to create post with non-existent author
await db.insert(posts).values({ authorId: 999, title: 'Post' })

// Error thrown:
DatabaseError {
  message: "Invalid posts author id fkey: referenced record does not exist",
  code: "FOREIGN_KEY_VIOLATION",
  statusCode: 400,
  pgCode: "23503",
  constraint: "posts_author_id_fkey",
  table: "posts"
}
```

**How to handle**:
- Validate foreign keys before insert/update
- Show error: "Referenced user does not exist"
- Check if referenced entity was deleted

#### Not Null Violation (23502)

**What it means**: Attempting to insert/update a null value in a NOT NULL column.

**Example**:
```typescript
// Missing required field
await db.insert(users).values({ name: 'John' }) // email is required

// Error thrown:
DatabaseError {
  message: "Missing required field: email cannot be null",
  code: "NOT_NULL_VIOLATION",
  statusCode: 400,
  pgCode: "23502",
  column: "email",
  table: "users"
}
```

**How to handle**:
- Validate required fields in API layer
- Show error: "Email is required"
- Use TypeScript types to prevent this at compile time

#### Check Constraint Violation (23514)

**What it means**: Attempting to insert/update a value that violates a CHECK constraint.

**Example**:
```typescript
// Age must be positive
await db.insert(users).values({ email: 'user@test.com', age: -5 })

// Error thrown:
DatabaseError {
  message: "Validation failed: users age check check constraint violated",
  code: "CHECK_VIOLATION",
  statusCode: 400,
  pgCode: "23514",
  constraint: "users_age_check",
  table: "users"
}
```

**How to handle**:
- Validate input before database operation
- Show specific validation error based on constraint name
- Add client-side validation

### Concurrency Errors (Class 40)

#### Deadlock Detected (40P01)

**What it means**: Two or more transactions are waiting for each other to release locks.

**Example**:
```typescript
// Transaction 1: Lock order A, then B
// Transaction 2: Lock order B, then A
// Result: Deadlock

// Error thrown:
DatabaseError {
  message: "Database deadlock detected - please retry the operation",
  code: "DEADLOCK_DETECTED",
  statusCode: 409,
  pgCode: "40P01",
  context: { retryable: true }
}
```

**How to handle**:
- **Retry automatically** with exponential backoff
- Reorder operations to prevent deadlocks
- Use consistent lock ordering across application
- Consider using SELECT FOR UPDATE NOWAIT

**Retry logic**:
```typescript
async function retryOnDeadlock<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      if (error instanceof DatabaseError && error.code === 'DEADLOCK_DETECTED' && i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 100))
        continue
      }
      throw error
    }
  }
  throw new Error('Max retries exceeded')
}
```

#### Serialization Failure (40001)

**What it means**: Concurrent updates to the same row causing isolation level conflict.

**Example**:
```typescript
// Two requests updating account balance simultaneously

// Error thrown:
DatabaseError {
  message: "Concurrent update conflict - please retry the operation",
  code: "SERIALIZATION_FAILURE",
  statusCode: 409,
  pgCode: "40001",
  context: { retryable: true }
}
```

**How to handle**:
- **Retry automatically** (safe to retry)
- Use optimistic locking (version column)
- Consider row-level locking with SELECT FOR UPDATE

### Timeout Errors (Class 57)

#### Query Canceled (57014)

**What it means**: Query execution exceeded timeout limit.

**Example**:
```typescript
// Long-running analytics query
await db.execute(sql`
  SELECT * FROM orders
  JOIN users ON orders.user_id = users.id
  WHERE created_at < NOW() - INTERVAL '5 years'
`)

// Error thrown:
DatabaseError {
  message: "Database query timeout - operation took too long",
  code: "QUERY_TIMEOUT",
  statusCode: 504,
  pgCode: "57014"
}
```

**How to handle**:
- Optimize query with indexes
- Break into smaller queries
- Use pagination for large datasets
- Increase statement_timeout for specific queries
- Consider async job queue for heavy operations

### Connection Errors (Class 08)

#### Connection Failure (08006)

**What it means**: Database connection was lost or cannot be established.

**Example**:
```typescript
// Database unreachable

// Error thrown:
DatabaseError {
  message: "Database connection error - please try again",
  code: "CONNECTION_ERROR",
  statusCode: 503,
  pgCode: "08006",
  context: { retryable: true }
}
```

**How to handle**:
- **Retry with exponential backoff**
- Check database server status
- Verify connection string and credentials
- Check firewall/network rules
- Monitor connection pool health

### Resource Errors (Class 53)

#### Too Many Connections (53300)

**What it means**: Database connection pool is exhausted.

**Example**:
```typescript
// All connections in use

// Error thrown:
DatabaseError {
  message: "Database resource limit reached - please try again later",
  code: "RESOURCE_ERROR",
  statusCode: 503,
  pgCode: "53300",
  context: { retryable: true }
}
```

**How to handle**:
- Implement connection pooling properly
- Close connections after use
- Increase max_connections (carefully)
- Add rate limiting to API
- Monitor active connections

#### Out of Memory (53200)

**What it means**: Database server ran out of memory during query execution.

**How to handle**:
- Optimize query to use less memory
- Add LIMIT to queries
- Use streaming for large result sets
- Increase database memory (infrastructure)

### Schema Errors (Class 42)

#### Undefined Table (42P01)

**What it means**: Attempting to query a table that doesn't exist.

**Example**:
```typescript
// Table not created or wrong database

// Error thrown:
DatabaseError {
  message: "Database schema error - table or column does not exist",
  code: "SCHEMA_ERROR",
  statusCode: 500,
  pgCode: "42P01",
  table: "nonexistent_table"
}
```

**How to handle**:
- Run database migrations
- Check database connection (connecting to wrong DB?)
- Verify table name spelling
- This is usually a deployment/configuration issue

## Best Practices

### 1. Always Provide Context

```typescript
// ✅ Good: Includes operation and relevant data
try {
  await db.insert(users).values(userData)
} catch (error) {
  handleDatabaseError(error, 'insert user', {
    email: userData.email,
    source: 'signup-form',
  })
}

// ❌ Bad: No context
try {
  await db.insert(users).values(userData)
} catch (error) {
  handleDatabaseError(error, 'database operation')
}
```

### 2. Implement Retry Logic for Transient Errors

```typescript
async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries = 3,
): Promise<T> {
  let lastError: Error

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error

      // Check if error is retryable
      if (error instanceof DatabaseError && error.context?.retryable) {
        const delay = Math.pow(2, attempt) * 100 // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }

      // Non-retryable error, throw immediately
      throw error
    }
  }

  throw lastError!
}

// Usage
const user = await withRetry(
  () => db.insert(users).values(userData),
  'insert user',
)
```

### 3. Validate Before Database Operations

```typescript
// ✅ Good: Validate constraints before database call
function validateUser(data: unknown) {
  if (!data.email) {
    throw new ValidationError('Email is required', 'email', data.email)
  }
  if (!isValidEmail(data.email)) {
    throw new ValidationError('Invalid email format', 'email', data.email)
  }
  // Check uniqueness with a query before insert
  const existing = await db.query.users.findFirst({
    where: eq(users.email, data.email)
  })
  if (existing) {
    throw new ApplicationError('Email already registered', 'EMAIL_EXISTS', 409)
  }
}

try {
  validateUser(userData)
  await db.insert(users).values(userData)
} catch (error) {
  // Handle both validation and database errors
  return handleApiError(error)
}
```

### 4. Use Transactions for Complex Operations

```typescript
// Ensures atomicity and proper error handling
await db.transaction(async (tx) => {
  try {
    const user = await tx.insert(users).values(userData).returning()
    await tx.insert(profiles).values({ userId: user.id, ...profileData })
    return user
  } catch (error) {
    // Transaction will be rolled back automatically
    handleDatabaseError(error, 'create user with profile', { email: userData.email })
  }
})
```

### 5. Monitor Database Errors

```typescript
// Log database errors for monitoring and alerting
import { logger } from '@revealui/core/utils/logger'

try {
  await db.insert(users).values(userData)
} catch (error) {
  // DatabaseError is already logged by handleDatabaseError
  // But you can add custom metrics/alerts
  if (error instanceof DatabaseError) {
    // Send to monitoring service
    metrics.increment('database.errors', {
      code: error.code,
      table: error.table,
      operation: 'insert user',
    })

    // Alert on critical errors
    if (['DEADLOCK_DETECTED', 'CONNECTION_ERROR', 'RESOURCE_ERROR'].includes(error.code)) {
      alerting.critical('Database issue detected', { error })
    }
  }
  throw error
}
```

## API Response Format

### Success Response

```json
{
  "data": { "id": 1, "email": "user@example.com" },
  "success": true
}
```

### Error Response (Unique Violation)

```json
{
  "error": {
    "message": "Duplicate users email unique: this value already exists",
    "code": "UNIQUE_VIOLATION",
    "statusCode": 409,
    "retryable": false
  }
}
```

### Error Response (Deadlock)

```json
{
  "error": {
    "message": "Database deadlock detected - please retry the operation",
    "code": "DEADLOCK_DETECTED",
    "statusCode": 409,
    "retryable": true
  }
}
```

## Testing

### Mock Database Errors

```typescript
import { describe, it, expect, vi } from 'vitest'
import { handleDatabaseError, PostgresErrorCode } from '../errors'

describe('Database Error Handling', () => {
  it('should handle unique violation', () => {
    const pgError = {
      code: PostgresErrorCode.UNIQUE_VIOLATION,
      constraint: 'users_email_unique',
      table: 'users',
    }

    expect(() => {
      handleDatabaseError(pgError, 'insert user')
    }).toThrow('Duplicate users email unique')
  })
})
```

### Integration Testing

```typescript
describe('User Creation', () => {
  it('should return 409 for duplicate email', async () => {
    // Create first user
    await db.insert(users).values({ email: 'test@example.com' })

    // Try to create duplicate
    try {
      await db.insert(users).values({ email: 'test@example.com' })
      fail('Should have thrown error')
    } catch (error) {
      expect(error).toBeInstanceOf(DatabaseError)
      expect(error.statusCode).toBe(409)
      expect(error.code).toBe('UNIQUE_VIOLATION')
    }
  })
})
```

## Migration Guide

### From Basic Error Handling

**Before**:
```typescript
try {
  await db.insert(users).values(userData)
} catch (error) {
  console.error('Database error:', error)
  throw new Error('Failed to create user')
}
```

**After**:
```typescript
import { handleDatabaseError } from '@revealui/core/utils/errors'

try {
  await db.insert(users).values(userData)
} catch (error) {
  handleDatabaseError(error, 'insert user', { email: userData.email })
}
```

Benefits:
- ✅ User-friendly error messages
- ✅ Proper HTTP status codes
- ✅ Structured logging
- ✅ Retry guidance
- ✅ Full error context

## Reference

### Complete Error Code List

| Code | Name | Class | Retryable | Status |
|------|------|-------|-----------|--------|
| 23505 | Unique Violation | Constraint | No | 409 |
| 23503 | Foreign Key Violation | Constraint | No | 400 |
| 23502 | Not Null Violation | Constraint | No | 400 |
| 23514 | Check Violation | Constraint | No | 400 |
| 40P01 | Deadlock Detected | Concurrency | Yes | 409 |
| 40001 | Serialization Failure | Concurrency | Yes | 409 |
| 57014 | Query Canceled | Timeout | No | 504 |
| 08000 | Connection Exception | Connection | Yes | 503 |
| 08006 | Connection Failure | Connection | Yes | 503 |
| 53300 | Too Many Connections | Resource | Yes | 503 |
| 53200 | Out of Memory | Resource | Yes | 503 |
| 42P01 | Undefined Table | Schema | No | 500 |
| 42703 | Undefined Column | Schema | No | 500 |

### Further Reading

- [PostgreSQL Error Codes](https://www.postgresql.org/docs/current/errcodes-appendix.html)
- [Handling Deadlocks](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-DEADLOCKS)
- [Connection Pooling Best Practices](https://node-postgres.com/features/pooling)

---

**Last Updated**: 2026-02-01
**Version**: 1.0.0
