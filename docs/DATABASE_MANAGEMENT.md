# Database Management Guide

This guide describes the database management scripts available in RevealUI and their usage across different development environments.

**Last Updated:** 2026-01-31

---

## Table of Contents

1. [Overview](#overview)
2. [Available Commands](#available-commands)
3. [Command Details](#command-details)
4. [Environment Variables](#environment-variables)
5. [Environment-Specific Usage](#environment-specific-usage)
6. [Database Locations](#database-locations)
7. [Common Workflows](#common-workflows)
8. [Troubleshooting](#troubleshooting)
9. [Best Practices](#best-practices)

---

## Overview

RevealUI provides a **unified interface** for database operations through pnpm scripts. These work consistently across all development environments (Nix, Dev Containers, Manual setup).

## Available Commands

### Core Database Commands

| Command | Description | File | Environment Variables Required |
|---------|-------------|------|-------------------------------|
| `pnpm db:init` | Initialize database connection and verify setup | `scripts/setup/database.ts` | `POSTGRES_URL`, `DATABASE_URL`, or `SUPABASE_DATABASE_URI` |
| `pnpm db:migrate` | Run Drizzle migrations | `scripts/setup/migrations.ts` | `POSTGRES_URL` or `DATABASE_URL` |
| `pnpm db:reset` | Drop all tables and recreate schema | `scripts/setup/reset-database.ts` | Same as init |
| `pnpm db:seed` | Seed database with sample data | `scripts/setup/seed-sample-content.ts` | Same as init |
| `pnpm db:backup` | Create JSON backup of all tables | `scripts/commands/database/backup.ts` | Same as init |
| `pnpm db:restore` | Restore from backup file | `scripts/commands/database/restore.ts` | Same as init |
| `pnpm db:status` | Check database connection and table count | `scripts/commands/database/status.ts` | Same as init |
| `pnpm db:setup-test` | Setup test database | `scripts/dev-tools/test-database.ts` | Test-specific vars |

## Command Details

### `pnpm db:init`

**Purpose:** Verify database connection and initialize RevealUI tables.

**What it does:**
1. Detects database provider (Neon, Supabase, Vercel, Generic)
2. Tests connection with `SELECT NOW()` query
3. Checks PostgreSQL version
4. Verifies RevealUI system tables exist:
   - `revealui_locked_documents`
   - `revealui_locked_documents_rels`
   - `revealui_preferences`
   - `revealui_preferences_rels`
   - `revealui_migrations`
5. Lists all RevealUI tables found

**Environment Variables (priority order):**
- `DATABASE_URL` (primary)
- `POSTGRES_URL` (fallback)
- `SUPABASE_DATABASE_URI` (Supabase-specific)

**Usage:**
```bash
# First-time setup
pnpm db:init

# Check what gets initialized
# (Safe to run multiple times - idempotent)
```

**Exit codes:**
- `0` - Success
- `1` - Configuration error (no connection string)
- `2` - Execution error (connection failed)

### `pnpm db:migrate`

**Purpose:** Run Drizzle schema migrations to update database structure.

**What it does:**
1. Checks for `POSTGRES_URL` or `DATABASE_URL`
2. Generates new migrations if schema changed (`pnpm db:generate`)
3. Pushes schema changes to database (`pnpm db:push`)
4. Verifies migration success:
   - Checks `node_id_mappings` table exists
   - Checks `embedding_metadata` column in `agent_memories`

**Interactive:** Yes (prompts before modifying database)

**Usage:**
```bash
# Run migrations interactively
pnpm db:migrate

# In CI (auto-confirm)
CI=true pnpm db:migrate
```

**Safety:**
- Shows warning before modifying database
- Requires confirmation unless in CI
- Uses transactions (rollback on error)

### `pnpm db:reset`

**Purpose:** Complete database reset (drop all tables, recreate schema).

**What it does:**
1. Validates database connections
2. Creates backup (unless `--no-backup`)
3. Drops all tables and custom types (enums)
4. Runs migrations to recreate schema
5. Optionally seeds sample data (`--seed`)

**Flags:**
- `--confirm` / `-y` - Skip confirmation prompt
- `--no-backup` - Skip backup creation
- `--seed` - Seed sample data after reset
- `--database=rest` - Reset only REST database (Neon)
- `--database=vector` - Reset only Vector database (Supabase)
- `--force` - Allow in CI environment

**Safety Features:**
- **Interactive confirmation** (unless `--confirm`)
- **Automatic backups** to `.revealui/backups/` (unless `--no-backup`)
- **Transaction support** (rollback on error)
- **CI protection** (requires `--force` in CI)
- **Keeps last 5 backups** (auto-cleanup)

**Usage:**
```bash
# Interactive reset (safest)
pnpm db:reset

# Quick reset with backup
pnpm db:reset --confirm

# Reset without backup (faster)
pnpm db:reset --confirm --no-backup

# Reset and seed sample data
pnpm db:reset --seed

# Reset only REST database
pnpm db:reset --database=rest
```

**Backup location:**
```
.revealui/backups/db-backup-2026-01-30T12-34-56.json
```

### `pnpm db:seed`

**Purpose:** Populate database with sample content for development.

**What it does:**
- Seeds sample users, posts, pages, media, etc.
- Creates test data for all collections
- Uses realistic sample content

**Usage:**
```bash
# Seed database
pnpm db:seed

# Often combined with reset
pnpm db:reset --seed
```

### `pnpm db:backup`

**Purpose:** Create JSON backup of all database tables.

**What it does:**
1. Connects to database
2. Exports all tables to JSON format
3. Saves to `.revealui/backups/` directory
4. Cleans up old backups (keeps last 5)

**Usage:**
```bash
# Create backup
pnpm db:backup

# Backups saved to:
# .revealui/backups/db-backup-<timestamp>.json
```

### `pnpm db:restore`

**Purpose:** Restore database from backup file.

**Usage:**
```bash
# Restore from specific backup
pnpm db:restore .revealui/backups/db-backup-2026-01-30T12-34-56.json
```

### `pnpm db:status`

**Purpose:** Check database connection and current state.

**What it does:**
- Tests database connection
- Shows PostgreSQL version
- Lists table count
- Shows database provider (Neon, Supabase, etc.)

**Usage:**
```bash
# Quick health check
pnpm db:status
```

## Environment Variables

### Required Variables

**Primary:** (at least one required)
- `DATABASE_URL` - PostgreSQL connection string
- `POSTGRES_URL` - Alternative name (Neon convention)
- `SUPABASE_DATABASE_URI` - Supabase-specific

**Format:**
```bash
# Standard PostgreSQL
postgresql://user:password@host:port/database

# Neon (serverless)
postgresql://user:password@host.neon.tech/database?sslmode=require

# Supabase (connection pooling)
postgresql://postgres:password@db.project.supabase.co:5432/postgres
```

### Optional Variables

- `NODE_ENV` - Affects logging level (`development`, `production`, `test`)
- `CI` - Skips interactive prompts when set to `true`

## Environment-Specific Usage

### Pure Nix Environment

**Server control** (Nix-specific helpers):
```bash
db-init     # Initialize PostgreSQL data directory
db-start    # Start PostgreSQL server
db-stop     # Stop PostgreSQL server
db-status   # Check if server running
db-reset    # Delete data directory and reinitialize
db-psql     # Connect with psql client
```

**Application-level** (use pnpm scripts):
```bash
pnpm db:init      # Verify connection, check tables
pnpm db:migrate   # Run schema migrations
pnpm db:seed      # Seed sample data
pnpm db:reset     # Reset database
```

**Typical workflow:**
```bash
# 1. Start PostgreSQL (Nix helper)
db-start

# 2. Initialize database (pnpm script)
pnpm db:init

# 3. Run migrations (pnpm script)
pnpm db:migrate

# 4. Seed data (pnpm script)
pnpm db:seed
```

### Dev Containers

**Server control** (Docker Compose):
```bash
# PostgreSQL runs automatically in container
# No manual start/stop needed

# If needed:
docker-compose restart db
docker-compose logs db
```

**Application-level** (use pnpm scripts):
```bash
pnpm db:init      # Same as Nix
pnpm db:migrate   # Same as Nix
pnpm db:seed      # Same as Nix
pnpm db:reset     # Same as Nix
```

**Connection string:**
```bash
# In Dev Container, database host is "db" (service name)
DATABASE_URL=postgresql://postgres@db:5432/revealui
```

### Manual Setup

**Server control** (OS-specific):
```bash
# macOS (Homebrew)
brew services start postgresql@16
brew services stop postgresql@16

# Linux (systemd)
sudo systemctl start postgresql
sudo systemctl stop postgresql

# Windows (manual)
pg_ctl -D "C:\Program Files\PostgreSQL\16\data" start
pg_ctl -D "C:\Program Files\PostgreSQL\16\data" stop
```

**Application-level** (use pnpm scripts):
```bash
pnpm db:init      # Same as other environments
pnpm db:migrate   # Same as other environments
pnpm db:seed      # Same as other environments
pnpm db:reset     # Same as other environments
```

## Database Locations

### Local Development

| Environment | PostgreSQL Data Directory | Gitignored? |
|-------------|---------------------------|-------------|
| **Nix** | `.pgdata/` | ✅ Yes |
| **Dev Containers** | Docker volume (unnamed) | N/A (container) |
| **Manual** | System-dependent | N/A (outside project) |

**Backups** (all environments):
- Directory: `.revealui/backups/`
- Format: `db-backup-<timestamp>.json`
- Retention: Last 5 backups kept
- Gitignored: ✅ Yes (via `.revealui/`)

## Common Workflows

### First-Time Setup

```bash
# 1. Ensure PostgreSQL is running
# (Nix: db-start, Docker: automatic, Manual: OS-specific)

# 2. Initialize database
pnpm db:init

# 3. Run migrations
pnpm db:migrate

# 4. (Optional) Seed sample data
pnpm db:seed

# 5. Start development
pnpm dev
```

### Reset to Clean State

```bash
# Interactive (safest)
pnpm db:reset

# Quick reset (no prompts, with backup)
pnpm db:reset --confirm

# Full reset with sample data
pnpm db:reset --confirm --seed
```

### Before Testing

```bash
# Reset database to known state
pnpm db:reset --confirm --no-backup

# Run tests
pnpm test
```

### Before Deployment

```bash
# Backup production-like data
pnpm db:backup

# Verify migrations work
pnpm db:migrate

# Test with production-like data
pnpm dev
```

## Troubleshooting

### "No database connection string found"

**Solution:**
```bash
# Check environment variables
echo $DATABASE_URL
echo $POSTGRES_URL

# Create .env.development.local if missing
cp .env.template .env.development.local

# Edit with your database URL
code .env.development.local
```

### "Connection refused" or "Connection timeout"

**Nix:**
```bash
# Check if PostgreSQL is running
db-status

# Start if not running
db-start

# Check logs
cat .pgdata/logfile
```

**Dev Containers:**
```bash
# Check database container
docker-compose ps

# View logs
docker-compose logs db

# Restart if needed
docker-compose restart db
```

**Manual:**
```bash
# Check if PostgreSQL is running
# macOS:
brew services list

# Linux:
sudo systemctl status postgresql

# Windows:
pg_ctl status -D "C:\Program Files\PostgreSQL\16\data"
```

### "Permission denied" on tables

**Cause:** User doesn't have permissions on tables

**Solution:**
```bash
# Reset database with proper permissions
pnpm db:reset --confirm
```

### "Database already exists" during migration

**Cause:** Migrations already applied

**Solution:**
```bash
# Check migration status
pnpm db:status

# If needed, reset and migrate
pnpm db:reset --confirm
pnpm db:migrate
```

### Backup restoration fails

**Solution:**
```bash
# Reset database first
pnpm db:reset --confirm --no-backup

# Then restore
pnpm db:restore .revealui/backups/db-backup-<timestamp>.json
```

## Best Practices

### DO ✅

**Use pnpm scripts** for consistency across environments
```bash
pnpm db:init      # ✅ Works everywhere
pnpm db:migrate   # ✅ Works everywhere
```

**Back up before destructive operations**
```bash
pnpm db:backup
pnpm db:reset
```

**Test migrations before deployment**
```bash
pnpm db:backup
pnpm db:migrate
# Test thoroughly
pnpm db:restore backup.json  # If issues found
```

**Use `--confirm` in scripts**
```json
{
  "scripts": {
    "db:fresh": "pnpm db:reset --confirm --seed"
  }
}
```

### DON'T ❌

**Don't use environment-specific commands in shared scripts**
```bash
# ❌ Bad (Nix-specific)
db-start && pnpm dev

# ✅ Good (environment-agnostic)
pnpm dev
```

**Don't skip backups in production-like environments**
```bash
# ❌ Dangerous
pnpm db:reset --no-backup

# ✅ Safer
pnpm db:reset  # Creates backup automatically
```

**Don't hardcode connection strings**
```typescript
// ❌ Bad
const db = postgres('postgresql://postgres@localhost:5432/revealui');

// ✅ Good
const db = postgres(process.env.DATABASE_URL!);
```

### CI/CD Integration

**GitHub Actions:**
```yaml
- name: Setup database
  run: |
    pnpm db:init
    pnpm db:migrate
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}

- name: Run tests
  run: pnpm test
```

**Docker Compose (CI):**
```yaml
services:
  db:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: revealui_test
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres

  app:
    depends_on:
      - db
    environment:
      DATABASE_URL: postgresql://postgres:postgres@db:5432/revealui_test
    command: |
      pnpm db:init
      pnpm db:migrate
      pnpm test
```

### Migration Path

**From Devbox → Pure Nix:**
```bash
# 1. Export from Devbox
devbox shell
pg_dump -d revealui > backup.sql
exit

# 2. Switch to Nix
rm -rf .devbox/
direnv allow

# 3. Import to Nix
db-start
pnpm db:init
psql -d revealui < backup.sql
```

**Between Environments:**
```bash
# 1. Export from old environment
pnpm db:backup
# Or: pg_dump -d revealui > backup.sql

# 2. Setup new environment
# (follow environment-specific setup)

# 3. Import to new environment
pnpm db:restore backup.json
# Or: psql -d revealui < backup.sql
```

---

## Related Documentation

- [Database Guide](./DATABASE.md) - Schema, architecture, Drizzle ORM queries, dual-DB setup
- [CI Environment](./CI_ENVIRONMENT.md) - CI/CD environment specifications
- [Development Overview](./README.md) - Development navigation hub
- [Master Index](../INDEX.md) - Complete documentation index

---

**Last Updated:** 2026-01-31
**Part of:** Development Guide consolidation
