---
title: "Setup Scripts"
description: "Scripts for initializing and configuring RevealUI development and production environments."
visibility: internal
status: verified
audience: contributor
---

# Setup Scripts

Scripts for initializing and configuring RevealUI databases, billing, secrets,
and MCP servers. Most are surfaced as root `package.json` aliases; a few are
libraries or helpers run directly via `tsx`.

## Quick Start

```bash
pnpm db:init          # Verify the connection and initialize tables
pnpm dev:up           # Bootstrap the local dev environment
pnpm setup:mcp        # Check and configure MCP servers
```

Secrets are managed through revvault, not interactive setup scripts. See
[../../docs/SECRETS.md](../../docs/SECRETS.md) for the revvault-first posture.

## Database Setup

| Script                      | Command                            | Description                                                       |
| --------------------------- | ---------------------------------- | ---------------------------------------------------------------- |
| `database.ts`               | `pnpm db:init`                     | Verify the connection and initialize RevealUI tables             |
| `reset-database.ts`         | `pnpm db:reset`                    | Drop all tables and reinitialize (destructive, backs up first)   |
| `seed-billing.ts`           | `pnpm db:seed:billing`             | Seed the Stripe billing catalog (`pnpm db:seed` runs this plus the admin and fleet-marketing seeders) |
| `assert-migration-count.ts` | `pnpm db:assert-migration-count`   | Assert the migration journal matches the applied-row count       |
| `backfill-migrations.ts`    | `pnpm db:backfill-migrations`      | Detect and fix missing migration tracking rows before drizzle-kit runs |
| `setup-dual-database.ts`    | run via `tsx`                      | Configure the two runtime DB components (NeonDB REST + ElectricSQL sync) |

**Note**: migrations run via `pnpm db:migrate` (forwarded to
`pnpm --filter @revealui/db db:migrate`). Postgres-native vector setup runs
through the same `pnpm db:migrate` path against Neon's `pgvector` extension. The
earlier Supabase-vector-specific scripts were removed during the Supabase
phase-out. Test-database utilities live in `scripts/dev-tools/`.

## Secrets & Credentials

| Script                | Command                                | Description                                                          |
| --------------------- | -------------------------------------- | ------------------------------------------------------------------- |
| `credentials.ts`      | `pnpm tsx scripts/setup/credentials.ts` | Bootstrap machine credentials: read from revvault and write `~/.npmrc` etc. |
| `gen-staging-secrets.ts` | `pnpm setup:staging-secrets`        | Owner-run generator for the staging secret bucket (writes to revvault) |

The staging manifest at `scripts/sync/revvault-vercel-staging.toml` then syncs
those vault values into Vercel via `pnpm vercel:sync:staging:apply`.

## MCP Server Setup

| Script         | Command          | Description                          |
| -------------- | ---------------- | ------------------------------------ |
| `setup-mcp.ts` | `pnpm setup:mcp` | Check and configure MCP servers      |

## Stripe & Billing

| Script                   | Command                    | Description                                             |
| ------------------------ | -------------------------- | ------------------------------------------------------- |
| `seed-stripe.ts`         | `pnpm stripe:seed`         | Seed Stripe products/prices and cache resolved price IDs |
| `seed-stripe.ts --check` | `pnpm stripe:catalog:check`| Check the Stripe catalog without writing                 |
| `sync-billing-catalog.ts`| `pnpm billing:catalog:sync`| Sync `billing_catalog` from env vars or the local Stripe cache |

Supporting Stripe helpers used by the scripts above (no direct alias):
`stripe-catalog.ts`, `stripe-price-match.ts`, `stripe-env-cache-path.ts`,
`stripe-revvault-sync.ts`.

```bash
# Seed Stripe products/prices and cache the resolved local price IDs
pnpm stripe:seed -- --skip-webhook

# Sync billing_catalog from env vars or the local cache
pnpm billing:catalog:sync
```

`pnpm stripe:seed` writes resolved price IDs to
`node_modules/.cache/revealui-stripe-env.json` for local development, so
`billing:catalog:sync` can populate `billing_catalog` before new price IDs are
copied into `.env` files.

## Licensing

| Script                    | Command                     | Description                          |
| ------------------------- | --------------------------- | ------------------------------------ |
| `issue-revforge-license.ts` | `pnpm revforge:issue-license` | Issue a RevForge license            |

## Development & Testing Tools

Development and integration-test utilities live in `scripts/dev-tools/`, not
here. See [../dev-tools/README.md](../dev-tools/README.md).

## Common Workflows

### New Developer Onboarding

```bash
# 1. Clone and install
git clone https://github.com/RevealUIStudio/revealui.git
cd revealui
pnpm install

# 2. Bootstrap local development
pnpm dev:up

# 3. Initialize and seed the database
pnpm db:init
pnpm db:seed

# 4. Start development
pnpm dev
```

### Local Testing Setup

```bash
pnpm db:migrate       # Run migrations
pnpm db:seed          # Seed test data
pnpm test             # Run tests
```

## Script Execution

Aliased scripts run via their `package.json` name. Scripts without an alias run
directly through `tsx`:

```bash
pnpm db:init                              # aliased
pnpm tsx scripts/setup/credentials.ts     # direct
```

## Error Codes

Setup scripts use standardized exit codes (from `@revealui/scripts/errors`):

- `0`, Success
- `2`, Configuration error (missing env vars, bad config)
- `3`, Execution error (command failed, service error)
- `4`, Validation error (invalid input)

## See Also

- [Main Scripts README](../README.md), overview of all script categories
- [Dev Tools](../dev-tools/README.md), development and integration-test utilities
- [Secrets](../../docs/SECRETS.md), revvault-first secret management
