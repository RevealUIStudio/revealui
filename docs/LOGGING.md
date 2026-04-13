# Logging Guide

**Last Updated:** 2026-02-04

## Overview

RevealUI has a comprehensive logging system already implemented in `@revealui/core`. This guide shows how to use it instead of `console.log`.

## Quick Start

```typescript
// Client-side (React components, browser code)
import { logger } from '@revealui/core/utils/logger'

// Server-side (API routes, server components)
import { logger } from '@revealui/core/server'
// OR
import { logger } from '@revealui/core/utils/logger/server'
```

## Basic Usage

### Log Levels

```typescript
logger.debug('Debug information', { details: 'extra info' })
logger.info('Informational message', { userId: '123' })
logger.warn('Warning message', { reason: 'deprecated API' })
logger.error('Error occurred', new Error('Something went wrong'))
logger.fatal('Fatal error', new Error('System failure'))
```

### Creating Context-Aware Loggers

```typescript
import { createLogger } from '@revealui/core/utils/logger'

const userLogger = createLogger({ userId: '123', sessionId: 'abc' })
userLogger.info('User action') // Includes userId and sessionId automatically
```

## Advanced Features

### Request Logging

```typescript
import { createRequestLogger } from '@revealui/core/observability/logger'

const requestLogger = createRequestLogger({
  includeBody: true,
  includeHeaders: true
})

// Use in middleware
app.use(requestLogger)
```

### Performance Logging

```typescript
import { logPerformance } from '@revealui/core/observability/logger'

const start = Date.now()
// ... operation ...
const duration = Date.now() - start

logPerformance('database query', duration, { query: 'SELECT * FROM users' })
// Automatically warns if duration > 1000ms
```

### Audit Logging

For security-sensitive operations:

```typescript
import { logAudit } from '@revealui/core/observability/logger'

logAudit('user.login', {
  userId: user.id,
  ip: request.ip,
  timestamp: new Date()
})
```

### Database Query Logging

```typescript
import { logQuery } from '@revealui/core/observability/logger'

logQuery('SELECT * FROM users WHERE id = $1', 45, {
  table: 'users',
  operation: 'SELECT'
})
// Automatically warns on slow queries (> 1000ms)
```

### API Call Logging

```typescript
import { logAPICall } from '@revealui/core/observability/logger'

logAPICall('POST', '/api/users', 201, 150, {
  userId: '123',
  created: true
})
```

### Cache Logging

```typescript
import { logCache } from '@revealui/core/observability/logger'

logCache('hit', 'user:123', { ttl: 3600 })
logCache('miss', 'user:456')
logCache('set', 'user:789', { ttl: 3600 })
logCache('delete', 'user:123')
```

### User Action Logging

```typescript
import { logUserAction } from '@revealui/core/observability/logger'

logUserAction('profile.update', user.id, {
  fields: ['name', 'email'],
  success: true
})
```

## Configuration

### Environment Variables

```bash
# Set log level (default: info)
LOG_LEVEL=debug  # debug | info | warn | error | fatal

# Pretty printing (default: true in development, false in production)
NODE_ENV=production
```

### Custom Configuration

```typescript
import { Logger } from '@revealui/core/observability/logger'

const customLogger = new Logger({
  level: 'debug',
  enabled: true,
  pretty: false,
  includeTimestamp: true,
  includeStack: true,
  destination: 'console', // 'console' | 'file' | 'remote'
  remoteUrl: 'https://logs.example.com/ingest',
  onLog: (entry) => {
    // Custom log handler
    console.log('Custom:', entry)
  }
})
```

## Security Features

### Sensitive Data Sanitization

```typescript
import { redactLogContext } from '@revealui/security'

const userData = {
  email: 'user@example.com',
  password: 'secret123',
  token: 'abc123',
  name: 'John Doe'
}

const safe = redactLogContext(userData)
// { email: 'user@example.com', password: '[REDACTED]', token: '[REDACTED]', name: 'John Doe' }
```

Automatically redacts:
- `password`
- `token`
- `secret`
- `apiKey`
- `accessToken`
- `refreshToken`
- `creditCard`
- `ssn`

### Log Sampling

For high-volume logs, sample only a percentage:

```typescript
import { createSampledLogger } from '@revealui/core/observability/logger'

// Log only 10% of messages
const sampledLogger = createSampledLogger(0.1)

// Use like normal logger
sampledLogger.debug('This may or may not be logged')
```

## Migration from console.log

### Before

```typescript
console.log('User logged in')
console.log('User ID:', userId)
console.error('Login failed:', error)
console.warn('Deprecated API used')
```

### After

```typescript
import { logger } from '@revealui/core/utils/logger'

logger.info('User logged in', { userId })
logger.error('Login failed', error, { userId })
logger.warn('Deprecated API used', { api: 'v1/users' })
```

## Structured Logging

The logger outputs structured JSON in production:

```json
{
  "timestamp": "2026-02-04T12:00:00.000Z",
  "level": "info",
  "message": "User logged in",
  "context": {
    "userId": "123",
    "sessionId": "abc",
    "requestId": "xyz"
  }
}
```

This makes logs searchable and parseable by log aggregation tools like:
- ELK Stack (Elasticsearch, Logstash, Kibana)
- Splunk
- Datadog
- New Relic
- CloudWatch

## Client vs Server Loggers

### Client Logger (`@revealui/core/utils/logger`)
- Browser-safe (no Node.js dependencies)
- No `crypto` or `async_hooks`
- Suitable for React components

### Server Logger (`@revealui/core/utils/logger/server`)
- Full Node.js support
- Request context tracking with async_hooks
- Performance tracking
- File logging support

## Best Practices

1. **Use appropriate log levels:**
   - `debug`: Detailed diagnostic information
   - `info`: General informational messages
   - `warn`: Warning messages (non-critical issues)
   - `error`: Error messages (recoverable errors)
   - `fatal`: Fatal errors (system-critical failures)

2. **Include context:**
   ```typescript
   // ❌ Bad
   logger.info('Operation completed')

   // ✅ Good
   logger.info('Operation completed', {
     operation: 'user.create',
     userId: '123',
     duration: 45
   })
   ```

3. **Never log sensitive data:**
   ```typescript
   // ❌ Bad
   logger.info('Login', { password: user.password })

   // ✅ Good
   logger.info('Login', { userId: user.id })
   ```

4. **Use specialized loggers:**
   ```typescript
   // ❌ Generic
   logger.info('Query took 1500ms')

   // ✅ Specialized
   logQuery(query, 1500, { table: 'users' })
   ```

5. **Create child loggers for modules:**
   ```typescript
   const authLogger = createLogger({ module: 'auth' })
   authLogger.info('Login attempt') // Includes module: 'auth'
   ```

## ESLint Configuration

Add this rule to prevent `console.*` usage:

```javascript
// eslint.config.js
export default [
  {
    rules: {
      'no-console': ['error', {
        allow: [] // No console methods allowed
      }]
    }
  }
]
```

## Testing

In tests, you can mock the logger:

```typescript
import { vi } from 'vitest'
import { logger } from '@revealui/core/utils/logger'

// Mock logger
vi.spyOn(logger, 'info').mockImplementation(() => {})
vi.spyOn(logger, 'error').mockImplementation(() => {})

// Your test
myFunction()

expect(logger.info).toHaveBeenCalledWith('Expected message', { context: 'data' })
```

## Further Reading

- [Logger Implementation](../packages/core/src/observability/logger.ts)
- [Server Logger](../packages/core/src/utils/logger-server.ts)
- [Client Logger](../packages/core/src/utils/logger-client.ts)
