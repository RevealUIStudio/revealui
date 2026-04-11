# @revealui/config

Environment configuration management for RevealUI - type-safe environment variables with Zod validation.

## Features

- **Type-safe**: Full TypeScript support with Zod validation
- **Environment detection**: Automatically detects NODE_ENV
- **Dotenv loading**: Loads `.env` files with priority
- **Validation**: Validates all environment variables on load
- **MCP Configuration**: Configuration management for MCP servers
- **RevealUI Config**: RevealUI-specific configuration

## Installation

```bash
pnpm add @revealui/config
```

## Usage

### Load Environment Configuration

```typescript
import { loadConfig } from '@revealui/config'

// Load and validate environment variables
const config = loadConfig()

// Access validated config
console.log(config.database.url) // Type-safe access
console.log(config.stripe.secretKey)
console.log(config.vercel.token)
```

### RevealUI Configuration

```typescript
import { getRevealUIConfig } from '@revealui/config/revealui'

const config = getRevealUIConfig()
// Returns validated RevealUI configuration
```

### MCP Configuration

```typescript
import { getMCPConfig } from '@revealui/config/mcp'

const mcpConfig = getMCPConfig()
// Returns MCP server configuration
```

## Environment Variables

The config package validates these environment variables:

### Required Variables

```env
# Database
POSTGRES_URL=postgresql://user:password@host/database

# RevealUI
REVEALUI_SECRET=your_secret_key_here
REVEALUI_PUBLIC_SERVER_URL=http://localhost:4000
```

### Optional Variables

```env
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Vercel
VERCEL_API_KEY=vercel_...
BLOB_READ_WRITE_TOKEN=vercel_blob_...

# Neon
NEON_API_KEY=neon_...

# Supabase
SUPABASE_URL=https://....supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

## File Loading Priority

Environment variables are loaded in this order (later overrides earlier):

1. System environment variables
2. `.env` (shared defaults, if present)
3. `.env.local` (local overrides)
4. `.env.development.local` (development mode)
5. `.env.production.local` (production mode)

## Validation

The package uses Zod schemas to validate configuration:

```typescript
import { loadConfig } from '@revealui/config'

try {
  const config = loadConfig()
  // Config is valid and type-safe
} catch (error) {
  // Validation failed - missing or invalid variables
  console.error('Configuration error:', error)
}
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

## JOSHUA Alignment

- **Unified**: One config loader validates and types all environment variables across every app and package
- **Hermetic**: Validation runs at load time  -  invalid or missing variables fail fast, never leak into runtime

## Related Documentation

- [Environment Variables Guide](../../docs/ENVIRONMENT_VARIABLES_GUIDE.md) - Complete environment setup
- [Quick Start](../../docs/QUICK_START.md) - Initial setup instructions
- [MCP Guide](../../docs/MCP.md) - MCP server configuration

## License

MIT
