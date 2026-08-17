---
title: "@revealui/config"
description: "Environment configuration management for RevealUI - type-safe environment variables with Zod validation."
visibility: public
status: verified
audience: user
---

# @revealui/config

Environment configuration management for RevealUI - type-safe environment variables with Zod validation.

## Features

- **Type-safe**: Full TypeScript support with Zod validation
- **Environment detection**: Automatically detects NODE_ENV
- **Dotenv loading**: Loads `.env` files with priority
- **Validation**: Validates all environment variables on load (`packages/config/src/validator.ts:57`)
- **MCP Configuration**: Configuration management for MCP servers
- **RevealUI Config**: RevealUI-specific configuration

## Installation

```bash
pnpm add @revealui/config
```

## Usage

### Load Environment Configuration

```typescript
import { getConfig } from '@revealui/config'

// Get validated config (cached after first call)
const config = getConfig()

// Access validated config
console.log(config.database.url) // Type-safe access
console.log(config.stripe.secretKey)
console.log(config.storage.r2) // Cloudflare R2 config (undefined when the R2_* vars are unset)
```

The package also exports a lazy-proxy default export (`packages/config/src/index.ts:317`) that validates on first property access:

```typescript
import config from '@revealui/config'
// Validation runs on first property access, not on import
console.log(config.database.url)
```

### RevealUI Shared Configuration

The `./revealui` subpath provides shared framework config for apps in the monorepo:

```typescript
import { getSharedCMSConfig, getSharedWebConfig } from '@revealui/config/revealui'

// In apps/admin revealui.config.ts
export default buildConfig({ ...getSharedCMSConfig(), /* app overrides */ })

// In Vite-based apps
const config = { ...getSharedWebConfig(), /* app overrides */ }
```

### MCP Configuration

```typescript
import { getMcpConfig } from '@revealui/config/mcp'

const mcpConfig = getMcpConfig()
// Returns: { persistenceDriver, electricDatabaseUrl, electricApiKey, metricsMode, pgvectorEnabled }
```

## Environment Variables

The config package validates these environment variables (schema: `packages/config/src/schema.ts:187`):

### Required Variables

```env
# Database
POSTGRES_URL=postgresql://user:password@host/database

# RevealUI (schema: packages/config/src/schema.ts requiredSchema)
REVEALUI_SECRET=your_secret_key_here
REVEALUI_PUBLIC_SERVER_URL=http://localhost:4000
NEXT_PUBLIC_SERVER_URL=http://localhost:3004
```

### Optional Variables

```env
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Storage — Cloudflare R2 (S3-compatible object storage)
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=revealui-media
R2_PUBLIC_BASE_URL=https://media.revealui.com

# Vercel
VERCEL_API_KEY=vercel_...

# Neon
NEON_API_KEY=neon_...
```

> **Note:** prior versions of this list included a `SUPABASE_*` block. Those env vars are not validated by `@revealui/config` (legacy leak from the removed customer Supabase MCP adapter). This package validates only the runtime env that `@revealui/server` and `@revealui/admin` actually read.

## File Loading Priority

File loading is environment-specific (`packages/config/src/loader.ts`). **`process.env` always wins** when values are merged.

| Environment | Files loaded |
|-------------|--------------|
| **production** | None (process.env only) |
| **test** | First existing of `.env.test.local`, then `.env.test` (both gitignored; copy `.env.test.example`) |
| **development** | First existing of `.env.development.local`, then `.env.local`, then `.env` |

## Validation

The package uses Zod schemas to validate configuration:

```typescript
import { getConfig, resetConfig } from '@revealui/config'

try {
  const config = getConfig()
  // Config is valid and type-safe
} catch (error) {
  // Validation failed - missing or invalid variables
  console.error('Configuration error:', error)
}

// Reset the cached config (useful for testing)
resetConfig()
```

## Development

```bash
# Build package
pnpm --filter @revealui/config build

# Run tests
pnpm --filter @revealui/config test

# Type check
pnpm --filter @revealui/config typecheck

# Lint
pnpm --filter @revealui/config lint
```

## When to Use This

- You need type-safe access to environment variables with Zod validation
- You want automatic `.env` file loading with priority-based overrides
- You're configuring MCP servers or RevealUI-specific settings
- **Not** for runtime feature flags  -  use `@revealui/core/features` instead
- **Not** for secrets management  -  use your platform's secret store and let this package validate what's loaded

## Design Principles

- **Unified**: One config loader (`getConfig`, `packages/config/src/index.ts:183`) validates and types all environment variables across every app and package
- **Hermetic**: Validation runs at load time  -  invalid or missing variables fail fast, never leak into runtime

## Related Documentation

- [Environment Variables Guide](../../docs/ENVIRONMENT-VARIABLES-GUIDE.md) - Complete environment setup
- [Quick Start](../../docs/QUICK_START.md) - Initial setup instructions
- [MCP Guide](../mcp/README.md) - MCP server configuration

## License

MIT
