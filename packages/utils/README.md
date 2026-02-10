# @revealui/utils

Shared utilities for RevealUI - logger, SSL config, and common helpers.

## Purpose

This package contains zero-dependency utilities that are used across multiple packages in the RevealUI monorepo. It was created to break circular dependencies between `@revealui/core`, `@revealui/db`, and `@revealui/contracts`.

## Contents

### Logger
Structured logging infrastructure with support for:
- Multiple log levels (debug, info, warn, error, fatal)
- Context propagation
- Pretty printing for development
- Remote logging support
- Child loggers with inherited context

### Database Utilities
- SSL configuration for PostgreSQL connections
- Connection string parsing
- Security validation for production environments

## Usage

```typescript
// Import logger
import { logger, createLogger } from '@revealui/utils'

// Use default logger
logger.info('Application started')

// Create child logger with context
const requestLogger = createLogger({ requestId: '123' })
requestLogger.info('Processing request')

// Import database utilities
import { getSSLConfig } from '@revealui/utils/database'

const sslConfig = getSSLConfig(process.env.DATABASE_URL)
```

## Why This Package Exists

Previously, these utilities lived in `@revealui/core`, which created a circular dependency:
```
contracts → db → core → contracts (circular!)
```

By extracting shared utilities to `@revealui/utils`, we get a clean dependency graph:
```
utils (no dependencies)
  ↑
  ├── contracts
  ├── db
  └── core
```

## Development

```bash
# Build
pnpm build

# Type check
pnpm typecheck

# Watch mode
pnpm dev
```

## License

MIT
