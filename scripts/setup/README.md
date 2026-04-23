# Setup Scripts

Essential scripts for initializing and configuring RevealUI development and production environments.

## Quick Start

```bash
# First-time setup (most common)
pnpm setup:env        # Configure environment variables
pnpm setup:node       # Ensure correct Node.js version
pnpm revealui doctor  # Check local workspace health
pnpm revealui dev up  # Bootstrap local dev environment

# For MCP server development
pnpm setup:mcp        # Validate MCP credentials and setup
revealui dev up --include mcp
```

## Database Setup

### Core Database Scripts

| Script                   | Command           | Description                                    |
| ------------------------ | ----------------- | ---------------------------------------------- |
| `database.ts`            | `pnpm db:init`    | Initialize database schema and tables          |
| `reset-database.ts`      | `pnpm db:reset`   | Drop all tables and reinitialize (DESTRUCTIVE) |
| `migrations.ts`          | `pnpm db:migrate` | Run pending database migrations                |
| `seed-sample-content.ts` | `pnpm db:seed`    | Populate database with sample data             |

### Advanced Database Scripts

| Script                     | Purpose                                        |
| -------------------------- | ---------------------------------------------- |
| `setup-dual-database.ts`   | Configure both REST and Vector databases       |
| `setup-vector-database.ts` | Set up Supabase vector database for embeddings |
| `migrate-vector-data.ts`   | Migrate data to vector database                |

**Note**: Test database utilities have been moved to `scripts/dev-tools/`

### Database Maintenance

| Script                   | Purpose                                |
| ------------------------ | -------------------------------------- |
| `cleanup-rate-limits.ts` | Clear rate limit records from database |
| `cleanup-sessions.ts`    | Remove expired session data            |

## Environment Configuration

| Script                     | Command             | Description                            |
| -------------------------- | ------------------- | -------------------------------------- |
| `environment.ts`           | `pnpm setup:env`    | Interactive environment variable setup |
| `validate-env.ts`          | `pnpm validate:env` | Verify all required env vars are set   |
| `sync-env-to-dev-local.ts` | -                   | Sync env vars between files            |
| `generate-secret.ts`       | -                   | Generate cryptographic secrets         |

### Environment Variables Required

See `.env.template` for full list. Key variables:

```bash
# Database
DATABASE_URL=postgresql://...
POSTGRES_URL=postgresql://...

# Authentication
REVEALUI_SECRET=<32-char-secret>
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...

# Optional
STRIPE_SECRET_KEY=sk_...      # For payment features
VERCEL_TOKEN=...               # For deployment
```

## Development Tools

| Script                  | Command           | Description                                   |
| ----------------------- | ----------------- | --------------------------------------------- |
| `setup-node-version.ts` | `pnpm setup:node` | Ensure correct Node.js version (via `.nvmrc`) |
| `setup-mcp.ts`          | `pnpm setup:mcp`  | Validate MCP credentials for AI development   |
| `setup-docker-wsl2.ts`  | -                 | Configure Docker on WSL2 (Windows only)       |
| `install-clean.ts`      | -                 | Clean install of all dependencies             |

## Development & Testing Tools

Development and testing utilities have been moved to `scripts/dev-tools/`:

- `test-database.ts` - Test database management
- `teardown-test-database.ts` - Clean up test databases
- `test-neon-connection.ts` - Verify Neon connectivity
- `run-integration-tests.ts` - Execute integration tests
- `run-memory-tests.ts` - Run tests with memory profiling
- `verify-test-setup.ts` - Verify test environment setup

See `scripts/dev-tools/README.md` for details.

## Advanced Setup

### Docker & WSL2

```bash
# Windows developers using WSL2
pnpm tsx scripts/setup/setup-docker-wsl2.ts
```

### MCP Server Development

```bash
# Configure MCP credentials for AI-powered development
pnpm setup:mcp

# Include MCP checks in the standard RevealUI bootstrap
revealui dev up --include mcp

# This sets up integration with:
# - Supabase MCP (database management)
# - Vercel MCP (deployment)
# - Stripe MCP (payments)
# - Neon MCP (database)
```

### Stripe Catalog Seeding

```bash
# Preview Stripe catalog changes
pnpm stripe:seed -- --dry-run

# Seed Stripe products/prices and cache the resolved local price IDs
pnpm stripe:seed -- --skip-webhook

# Sync billing_catalog from env vars or the local .revealui/stripe-env.json cache
pnpm billing:catalog:sync
```

`pnpm stripe:seed` now writes resolved price IDs to `.revealui/stripe-env.json` for local development.
That lets `billing:catalog:sync` populate `billing_catalog` even before you manually copy new price IDs into `.env` files.

### Dual Database Configuration

```bash
# Set up both REST API database and Vector database
pnpm tsx scripts/setup/setup-dual-database.ts
```

## Maintenance Scripts

| Script                       | When to Use                             |
| ---------------------------- | --------------------------------------- |
| `cleanup-failed-attempts.ts` | After failed migration attempts         |
| `test-cycle-fix.ts`          | Fix circular dependency issues in tests |

## Troubleshooting

### Database Connection Issues

```bash
# Verify database connectivity
pnpm tsx scripts/setup/test-neon-connection.ts

# Check database status
pnpm revealui doctor
```

### Environment Variable Issues

```bash
# Validate all required variables are set
pnpm validate:env

# Regenerate environment file
pnpm setup:env --force
```

### Test Database Issues

```bash
# Clean up test databases
pnpm tsx scripts/dev-tools/teardown-test-database.ts

# Verify test setup
pnpm tsx scripts/dev-tools/verify-test-setup.ts
```

### Clean Reinstall

```bash
# Nuclear option: clean everything and reinstall
pnpm tsx scripts/setup/install-clean.ts
```

## Common Workflows

### New Developer Onboarding

```bash
# 1. Clone repository
git clone https://github.com/RevealUIStudio/revealui.git
cd revealui

# 2. Install dependencies
pnpm install

# 3. Configure environment
pnpm setup:env

# 4. Verify Node version
pnpm setup:node

# 5. Bootstrap local development
pnpm revealui dev up

# 6. Seed sample data (optional)
pnpm db:seed

# 7. Start development
pnpm dev
```

### Setting Up CI/CD Environment

```bash
# Set required environment variables in CI
export DATABASE_URL="postgresql://..."
export REVEALUI_SECRET="..."

# Validate environment
pnpm validate:env --strict

# Run integration tests
pnpm test:integration
```

### Local Testing Setup

```bash
# 1. Inspect local bootstrap plan
pnpm revealui dev up --dry-run

# 2. Run migrations
pnpm db:migrate

# 3. Seed test data
pnpm db:seed

# 4. Run tests
pnpm test
```

## Script Execution

All setup scripts can be executed directly via `tsx`:

```bash
# Using package.json scripts (recommended)
pnpm setup:env

# Direct execution (for scripts without npm aliases)
pnpm tsx scripts/setup/test-neon-connection.ts

# With arguments
pnpm setup:env --force
```

## Error Codes

Setup scripts use standardized exit codes (defined in `scripts/lib/errors.ts`):

- `0` - Success
- `2` - Configuration error (missing env vars, bad config)
- `3` - Execution error (command failed, service error)
- `4` - Validation error (invalid input)

## See Also

- [Main Scripts README](../README.md) - Overview of all script categories
- [Database Commands CLI](../cli/db.ts) - Unified database management interface
- [Setup CLI](../cli/setup.ts) - Unified setup command interface
- [Script Development Guide](../README.md#script-development-guide) - Script development methodology and best practices
