---
title: "Development & Testing Tools"
description: "Development utilities for testing, debugging, and validating the RevealUI codebase."
visibility: internal
status: verified
audience: contributor
---

# Development & Testing Tools

Development utilities for testing, debugging, and validating the RevealUI codebase.

## Test Database Management

### test-database.ts
**Purpose**: Cross-platform test database setup
**Usage**: `pnpm db:setup-test`

Starts PostgreSQL test database and runs migrations. Uses Docker Compose with test configuration.

Features:
- Auto-detects `docker compose` vs `docker-compose`
- Waits for database readiness
- Applies migrations
- Enables pgvector extension
- Outputs connection string for tests

Environment:
- Uses `infrastructure/docker-compose/services/test.yml`
- Creates database at `postgresql://test:test@localhost:5433/test_revealui`

### test-neon-connection.ts
**Purpose**: Verify Neon database connectivity

Tests connection to Neon database and validates configuration.

## Integration Testing

### run-integration-tests.ts
**Purpose**: Execute integration test suite with proper database config
**Usage**: `pnpm test:integration`

Runs integration tests for packages that require database access (e.g., `@revealui/ai`).

Features:
- Sets up test database automatically
- Configures test environment variables
- Runs tests with proper isolation

### run-memory-tests.ts
**Purpose**: Run tests with memory profiling

Executes tests while monitoring memory usage to detect leaks and optimize performance.

### verify-test-setup.ts
**Purpose**: Verify test environment is correctly configured

Checks:
- Docker availability
- Database connectivity
- Required environment variables
- Migration status
- Test script locations

## Sync & Data Testing

### test-electric-sync.ts
**Purpose**: Test Electric-SQL synchronization

Tests Electric sync configuration and connectivity.

## Troubleshooting

### Test Database Issues

```bash
# Verify test setup
pnpm tsx scripts/dev-tools/verify-test-setup.ts

# Setup fresh test database
pnpm db:setup-test
```

### Common Issues

**Database won't start**
- Ensure Docker is running
- Check port 5433 is not in use
- Review Docker Compose logs

**Migrations fail**
- Verify migration files exist in `packages/db/migrations/`
- Check database permissions
- Ensure pgvector extension is available

**Tests can't connect**
- Confirm `POSTGRES_URL` environment variable is set
- Verify database is running: `docker ps`
- Check network connectivity

## Related

- Test configuration: `scripts/__tests__/`
- Setup scripts: `scripts/setup/`
- Validation scripts: `scripts/validate/`
- Database commands: `scripts/commands/database/`
