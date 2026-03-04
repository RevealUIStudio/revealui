# @revealui/utils

Shared utilities used across the RevealUI monorepo — structured logging, database helpers, and validation.

```bash
npm install @revealui/utils
```

## Subpath Exports

All exports are available from the main entry:

```ts
import { createLogger, logger, logError, logAudit, logQuery } from '@revealui/utils'
import { getSSLConfig, validateSSLConfig } from '@revealui/utils'
import { passwordSchema } from '@revealui/utils'
```

---

## Logging

A structured logger with configurable levels, destinations, and request context. Used throughout the monorepo — do not use `console.*` in production code; use this instead.

### `logger`

Global default logger instance. Use when no request context is available.

```ts
import { logger } from '@revealui/utils'

logger.info('Server started', { port: 3000 })
logger.warn('Config missing optional field', { field: 'adminEmail' })
logger.error('Unhandled exception', { error })
```

---

### `createLogger(context)`

Creates a scoped logger with persistent context fields attached to every log entry.

```ts
import { createLogger } from '@revealui/utils'

const log = createLogger({ module: 'auth', requestId: req.id })
log.info('User signed in', { userId: user.id })
log.error('Sign-in failed', { email, reason: 'invalid-password' })
```

Every entry produced by this logger will include `module` and `requestId` automatically.

---

### `Logger` class

Full logger class for advanced usage.

```ts
import { Logger } from '@revealui/utils'

const log = new Logger({
  level: 'debug',
  pretty: true,              // human-readable output in dev
  destination: 'console',    // 'console' | 'file' | 'remote'
  remoteUrl: 'https://...',  // required when destination='remote'
  onLog: (entry) => { /* custom handler */ },
})

// Methods: debug, info, warn, error, fatal
log.debug('Processing request', { path })
log.info('Collection queried', { slug, count })
log.warn('Rate limit approaching', { key, remaining: 5 })
log.error('DB query failed', { query, error })
log.fatal('Unrecoverable error — shutting down')
```

**`LoggerConfig`:**
```ts
interface LoggerConfig {
  level?: LogLevel            // minimum level to output (default: 'info')
  enabled?: boolean           // set false to silence (default: true)
  pretty?: boolean            // human-readable vs JSON output
  includeTimestamp?: boolean  // prepend ISO timestamp (default: true)
  includeStack?: boolean      // include stack traces on errors
  destination?: 'console' | 'file' | 'remote'
  remoteUrl?: string          // required when destination='remote'
  onLog?: (entry: LogEntry) => void
}
```

---

### `logger.child(context)`

Creates a child logger that inherits all parent configuration and context, merging in additional fields.

```ts
const requestLog = logger.child({ requestId: req.id, userId: session.userId })
requestLog.info('Request received', { method: req.method, path: req.url })
```

Child loggers share parent handlers (e.g. remote transport).

---

### `logError(error, context?)`

Convenience function — logs an `Error` at `error` level with the stack trace.

```ts
import { logError } from '@revealui/utils'

try {
  await db.query(...)
} catch (err) {
  logError(err as Error, { query: sql, userId })
}
```

---

### `logAudit(action, context?)`

Logs an audit event at `info` level. Use for security-sensitive operations.

```ts
import { logAudit } from '@revealui/utils'

logAudit('user.password_changed', { userId, ipAddress })
logAudit('admin.collection_deleted', { userId, collection: 'posts' })
```

---

### `logQuery(query, duration, context?)`

Logs a database query at `debug` level with execution time.

```ts
import { logQuery } from '@revealui/utils'

const start = performance.now()
const result = await db.select().from(posts)
logQuery('SELECT * FROM posts', performance.now() - start, { count: result.length })
```

---

### Types

```ts
type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

interface LogContext {
  [key: string]: unknown
  userId?: string
  requestId?: string
  sessionId?: string
  traceId?: string
  spanId?: string
}

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: LogContext
  error?: { name: string; message: string; stack?: string }
  metadata?: Record<string, unknown>
}
```

---

## Database Utilities

### `getSSLConfig(connectionString?)`

Returns an SSL config object suitable for passing to node-postgres. Handles Neon, Supabase, and standard Postgres connection strings.

```ts
import { getSSLConfig } from '@revealui/utils'

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: getSSLConfig(process.env.POSTGRES_URL),
})
```

**`SSLConfig`:**
```ts
interface SSLConfig {
  rejectUnauthorized: boolean
  ca?: string
}
```

---

### `validateSSLConfig(config)`

Validates an SSL config object. Throws if the config is malformed.

```ts
import { validateSSLConfig } from '@revealui/utils'

validateSSLConfig({ rejectUnauthorized: true })
```

---

## Validation

### `passwordSchema`

Zod schema for validating password strength. Used by `@revealui/auth`.

```ts
import { passwordSchema } from '@revealui/utils'

const result = passwordSchema.safeParse(userInput)
if (!result.success) {
  // result.error.issues → list of failing rules
}
```

**Rules enforced:**
- Minimum 12 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one digit
- At least one special character

```ts
type Password = z.infer<typeof passwordSchema>
```

---

## Related

- [`@revealui/core`](/reference/core) — Re-exports `createLogger` and `logger` for app-level use
- [`@revealui/auth`](/reference/auth) — Uses `passwordSchema` and `logAudit`
- [`@revealui/db`](/reference/db) — Uses `getSSLConfig` for connection pool setup
