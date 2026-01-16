# Logging Strategy

This document outlines the logging strategy for RevealUI Framework.

## Overview

RevealUI uses structured logging with configurable log levels. The logger is designed to:
- Provide consistent log formatting
- Support structured data (context objects)
- Be easily extensible for production logging services
- Follow best practices for production logging

## Usage

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

## Log Levels

| Level | Use Case | Default Output |
|-------|----------|----------------|
| `debug` | Development debugging | Only in development |
| `info` | General information | ✅ Always |
| `warn` | Warnings, non-critical issues | ✅ Always |
| `error` | Errors, failures | ✅ Always |

## Configuration

### Environment Variables

```bash
# Set minimum log level (default: 'info')
LOG_LEVEL=debug  # Options: debug, info, warn, error
```

### Production Logging

In production, the logger can be extended to use structured logging services:

1. **Vercel** - Automatic log aggregation
2. **Sentry** - Error monitoring (already configured)
3. **Datadog** - APM and logging
4. **CloudWatch** - AWS logging

To integrate with a logging service, modify `packages/revealui/src/core/utils/logger.ts`:

```typescript
export function createLogger(minLevel?: LogLevel): Logger {
  if (process.env.LOG_SERVICE === 'datadog') {
    return new DatadogLogger(minLevel)
  }
  // Default console logger
  return new ConsoleLogger(minLevel)
}
```

## Best Practices

### 1. Use Structured Data

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

### 2. Include Context

Always include relevant context:
- User ID (if available)
- Request ID (if available)
- Resource IDs
- Error details

### 3. Appropriate Log Levels

- **debug**: Development debugging, verbose information
- **info**: Important events (user actions, successful operations)
- **warn**: Non-critical issues (rate limits, missing optional data)
- **error**: Failures, exceptions, critical issues

### 4. Don't Log Sensitive Data

❌ **Never log:**
- Passwords
- Tokens (API keys, session tokens)
- Credit card numbers
- PII (personally identifiable information) unless necessary

### 5. Performance Considerations

- Don't log in tight loops
- Use `debug` level for verbose logging
- Consider log volume in production

## Migration from console.log

### Before
```typescript
console.log('User logged in:', userId)
console.error('Error:', error)
```

### After
```typescript
import { logger } from '@revealui/core/utils/logger'

logger.info('User logged in', { userId })
logger.error('Error', { error: error.message })
```

## Integration with Error Monitoring

The logger works with error monitoring services:

```typescript
// Sentry integration (if configured)
import * as Sentry from '@sentry/nextjs'

logger.error('Failed operation', { context })
// Sentry will automatically capture this if error monitoring is configured
```

## Future Enhancements

- [ ] Structured logging service integration (Datadog, CloudWatch)
- [ ] Log aggregation configuration
- [ ] Request ID tracking
- [ ] Performance metrics logging
- [ ] Audit log integration
