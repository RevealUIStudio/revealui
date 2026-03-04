# @revealui/utils

Zero-dependency shared utilities for RevealUI — structured logging, database helpers, and validation.

## Why This Package Exists

Extracting shared utilities to `@revealui/utils` breaks circular dependencies between core, db, and contracts:

```
utils (no dependencies)
  ^
  |-- contracts
  |-- db
  |-- core
```

## Features

- **Structured Logger** — Multiple log levels, context propagation, child loggers, pluggable handlers
- **Database Utilities** — SSL configuration, connection string parsing, security validation
- **Validation** — Common validation helpers

## Installation

```bash
pnpm add @revealui/utils
```

## Usage

### Logger

```typescript
import { logger, createLogger } from '@revealui/utils'

// Default logger
logger.info('Application started')
logger.error('Something failed', { error })

// Child logger with context
const requestLogger = createLogger({ requestId: '123', service: 'api' })
requestLogger.info('Processing request')

// Add custom log handler (e.g. database transport)
logger.addLogHandler(async (entry) => {
  await db.insert(appLogs).values(entry)
})
```

### Database Utilities

```typescript
import { getSSLConfig } from '@revealui/utils/database'

// Auto-configure SSL for PostgreSQL connections
const sslConfig = getSSLConfig(process.env.POSTGRES_URL)
```

### Validation

```typescript
import { validate } from '@revealui/utils/validation'
```

## Exports

| Subpath | Contents |
|---------|----------|
| `@revealui/utils` | Logger and main utilities |
| `@revealui/utils/logger` | Logger module (createLogger, log levels, handlers) |
| `@revealui/utils/database` | SSL config, connection string parsing |
| `@revealui/utils/validation` | Validation helpers |

## Logger Features

| Feature | Description |
|---------|-------------|
| Log levels | `debug`, `info`, `warn`, `error`, `fatal` |
| Context propagation | Attach metadata (requestId, service, etc.) |
| Child loggers | Inherit parent context with additional fields |
| Log handlers | Pluggable async handlers (DB, remote, etc.) |
| Pretty printing | Colored output in development |

## Development

```bash
# Build
pnpm build

# Type check
pnpm typecheck

# Run tests
pnpm test

# Watch mode
pnpm dev
```

## Related

- [Core Package](../core/README.md) — Uses utils for logging and error handling
- [DB Package](../db/README.md) — Uses utils for SSL and connection helpers

## License

MIT
