---
title: "Development & Testing Tools"
description: "Development utilities for running apps locally, focusing watchers, and integration testing."
visibility: internal
status: verified
audience: contributor
---

# Development & Testing Tools

Development utilities for running the RevealUI apps locally, focusing dev
watchers, provisioning a test database, and running integration tests. Each is
surfaced as a root `package.json` alias.

## Local Development

### revealui-shell.sh

**Purpose**: bootstrap the local dev environment.
**Command**: `pnpm dev:up`

Shell entry point that brings up the local development stack.

### admin-local.ts

**Purpose**: run the admin app locally and programmatically (headless-friendly).
**Command**: `pnpm dev:admin:local`

Distinct from `pnpm dev:admin`, which starts the admin dev server without
provisioning a database.

### dev-focus.ts

**Purpose**: start dev watchers only for specified packages/apps.
**Command**: `pnpm dev:focus <targets...>`

```bash
pnpm dev:focus api core    # Watch API and core only
```

### dev-watchdog.ts

**Purpose**: monitor file activity and kill idle dev watchers.
**Command**: `pnpm dev:watched`

Runs alongside `pnpm dev` or `pnpm dev:focus`. When no source files have been
modified for the configured idle timeout, it sends SIGTERM to the dev process
group.

### Dismount-WSLDev.ps1

PowerShell helper for dismounting the portable WSL dev drive.

## Database & Types

### test-database.ts

**Purpose**: provision a test / local-dev Postgres database (idempotent,
connection-string first).
**Command**: `pnpm db:setup-test`

Resolves the target database from an explicit connection string
(`--url=…` > `TEST_DATABASE_URL` > `POSTGRES_URL` > `DATABASE_URL`), then applies
migrations and enables required extensions.

### post-migration-types.ts

**Purpose**: regenerate TypeScript types after database migrations.
**Command**: `pnpm db:generate-types`

Run after applying Drizzle migrations to keep types in sync.
`pnpm db:migrate-and-generate` runs the migration and this step together.

## Integration Testing

### run-integration-tests.ts

**Purpose**: run integration tests with the correct database configuration.
**Command**: `pnpm test:integration`

Automatically provisions the test database when `POSTGRES_URL` is not set, then
runs the integration suites for packages that require database access.

## Troubleshooting

### Test Database Issues

```bash
# Provision a fresh test database
pnpm db:setup-test
```

**Database won't start**
- Ensure Docker is running.
- Check the target port is not already in use.

**Migrations fail**
- Verify migration files exist in `packages/db/migrations/`.
- Ensure the `pgvector` extension is available.

**Tests can't connect**
- Confirm `POSTGRES_URL` (or one of the fallbacks above) is set.
- Verify the database is running: `docker ps`.

## Related

- Setup scripts: [`../setup/README.md`](../setup/README.md)
- Validation scripts: [`../validate/README.md`](../validate/README.md)
- Database commands: `scripts/commands/database/`
