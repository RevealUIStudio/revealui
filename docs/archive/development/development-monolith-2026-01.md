# Development Guide

This comprehensive guide covers all development tools, configurations, and workflows for RevealUI.

**Last Updated:** 2026-01-31

---

## Table of Contents

1. [CI/CD Environment](#cicd-environment)
   - [Environment Specifications](#environment-specifications)
   - [Local vs CI Comparison](#local-vs-ci-comparison)
   - [Why CI Doesn't Use Nix or Docker](#why-ci-doesnt-use-nix-or-docker)
   - [CI Workflow Stages](#ci-workflow-stages)
   - [Environment Variables](#environment-variables)
   - [Testing Against CI Locally](#testing-against-ci-locally)
   - [Common CI Issues](#common-ci-issues)
   - [Node.js Version Strategy](#nodejs-version-strategy)
   - [Best Practices](#ci-best-practices)

2. [Database Management](#database-management)
   - [Available Commands](#available-commands)
   - [Command Details](#command-details)
   - [Environment Variables](#database-environment-variables)
   - [Environment-Specific Usage](#environment-specific-usage)
   - [Database Locations](#database-locations)
   - [Common Workflows](#common-workflows)
   - [Troubleshooting](#database-troubleshooting)
   - [Best Practices](#database-best-practices)

3. [Path Aliases and Module Resolution](#path-aliases-and-module-resolution)
   - [Why Path Aliases?](#why-path-aliases)
   - [Monorepo Strategy](#monorepo-strategy)
   - [Configuration Patterns](#configuration-patterns)
   - [Synchronization Checklist](#synchronization-checklist)
   - [Common Patterns by Package Type](#common-patterns-by-package-type)
   - [Module Resolution Strategies](#module-resolution-strategies)
   - [Troubleshooting](#path-alias-troubleshooting)
   - [Best Practices](#path-alias-best-practices)

4. [TypeScript Strict Mode](#typescript-strict-mode)
   - [Current State](#current-state)
   - [Why Strict Mode Matters](#why-strict-mode-matters)
   - [Migration Strategy](#migration-strategy)
   - [Implementation Checklist](#implementation-checklist)
   - [Testing Strategy](#testing-strategy)
   - [Risk Mitigation](#risk-mitigation)
   - [Success Metrics](#success-metrics)
   - [Timeline](#timeline)
   - [Best Practices](#best-practices)

---

## CI/CD Environment

This section explains the CI/CD environment used by RevealUI and how it differs from local development environments.

### Overview

RevealUI uses **vanilla GitHub Actions** for CI/CD, not Nix or Docker. This is an intentional choice for simplicity, speed, and reliability.

### Environment Specifications

#### Versions

| Tool | Version | Source |
|------|---------|--------|
| **Node.js** | 24.12.0 | `actions/setup-node@v4` |
| **pnpm** | 10.28.2 | `pnpm/action-setup@v4` |
| **PostgreSQL** | 16 (pg16) | Docker `pgvector/pgvector:pg16` |
| **pgvector** | Latest | Included in Docker image |
| **OS** | ubuntu-latest | GitHub Actions default |

#### Configuration Files

**Primary CI workflow:** `.github/workflows/ci.yml`

**Key sections:**
```yaml
# Node.js setup
- uses: actions/setup-node@v4
  with:
    node-version: '24.12.0'

# pnpm setup
- uses: pnpm/action-setup@v4
  with:
    version: 10.28.2

# PostgreSQL service
services:
  postgres:
    image: pgvector/pgvector:pg16
    env:
      POSTGRES_DB: revealui
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - 5432:5432
```

### Local vs CI Comparison

| Aspect | Pure Nix (Local) | Dev Containers (Local) | Manual (Local) | CI |
|--------|------------------|------------------------|----------------|-----|
| **Node.js** | ⚠️ 22 | ✅ 24.12.0 | ✅ 24.12.0 | ✅ 24.12.0 |
| **pnpm** | ✅ 10.28.2 | ✅ 10.28.2 | ✅ 10.28.2 | ✅ 10.28.2 |
| **PostgreSQL** | ✅ 16 | ✅ 16 | ⚠️ Varies | ✅ 16 |
| **pgvector** | ✅ Yes | ✅ Yes | ⚠️ Maybe | ✅ Yes |
| **Setup method** | direnv + Nix | docker-compose | manual | GitHub Actions |
| **Database location** | `.pgdata/` | Docker volume | System | Service container |
| **Environment manager** | Nix flakes | Docker | None | GitHub Actions |
| **Build speed** | ⚡ Fast | 🐌 Slower | ⚡ Fast | ⚡ Fast (cached) |

#### Parity Analysis

**✅ Close Parity:**
- pnpm version (exact match)
- PostgreSQL version (exact match)
- pgvector extension (present in both)

**⚠️ Partial Parity:**
- Node.js version (Nix: 22, Others/CI: 24.12.0)

**❌ No Parity:**
- Environment setup method (different approaches)
- Database location (not relevant to code)

### Why CI Doesn't Use Nix or Docker

#### Performance

**GitHub Actions with native Node.js is faster:**
- No Nix installation overhead (~30-60s)
- No Docker build time (~1-2 minutes)
- Optimized caching with `actions/cache`
- Pre-installed tools on runners

**Benchmark (typical CI run):**
- Vanilla Actions: ~3-4 minutes
- With Nix: ~4-6 minutes (first run), ~3-4 minutes (cached)
- With Docker: ~5-7 minutes (first run), ~4-5 minutes (cached)

#### Simplicity

**Standard GitHub Actions are easier to:**
- Understand (familiar YAML syntax)
- Maintain (no Nix/Docker expertise needed)
- Debug (better GitHub Actions logging)
- Customize (extensive action ecosystem)

#### Reliability

**Fewer moving parts:**
- No Nix flake evaluation failures
- No Docker layer caching issues
- No container networking complexities
- Direct access to GitHub Actions features

#### Caching

**GitHub's built-in caching works better:**
- `actions/cache` optimized for Actions runners
- `actions/setup-node` has built-in caching
- `pnpm/action-setup` has optimized store caching
- Faster cache restoration than Nix/Docker

### CI Workflow Stages

#### 1. Setup (30-60s)

```yaml
- Checkout code
- Setup Node.js 24.12.0
- Setup pnpm 10.28.2
- Cache pnpm store
- Start PostgreSQL service
```

#### 2. Install Dependencies (1-2 minutes)

```yaml
- pnpm install --frozen-lockfile
- Cache restored: ~30s
- Fresh install: ~2 minutes
```

#### 3. Build (1-2 minutes)

```yaml
- pnpm build
- TypeScript compilation
- Next.js build
- Turbo cache enabled
```

#### 4. Test (1-2 minutes)

```yaml
- pnpm test
- Database migrations
- Unit tests
- Integration tests
```

#### 5. Lint & Type Check (30s-1 minute)

```yaml
- pnpm lint
- pnpm type-check
```

**Total CI time:** ~3-7 minutes (depending on cache hits)

### Environment Variables

#### CI-Specific Variables

Set in GitHub Actions secrets/variables:

```bash
# Database (provided by service container)
POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/revealui

# Node environment
NODE_ENV=test
CI=true

# Cache control
TURBO_TOKEN=${{ secrets.TURBO_TOKEN }}
TURBO_TEAM=${{ secrets.TURBO_TEAM }}
```

#### Local vs CI

| Variable | Local (Nix) | Local (Docker) | CI |
|----------|-------------|----------------|-----|
| `POSTGRES_URL` | `localhost:5432` | `db:5432` | `localhost:5432` |
| `PGDATA` | `.pgdata/` | N/A (volume) | N/A (service) |
| `NODE_ENV` | `development` | `development` | `test` |
| `CI` | Not set | Not set | `true` |

### Testing Against CI Locally

#### Option 1: Use Act (GitHub Actions locally)

```bash
# Install act
brew install act  # macOS
# or: curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Run CI locally
act push

# Run specific job
act -j test
```

**Pros:** Exact CI simulation
**Cons:** Slow, requires Docker, not all features supported

#### Option 2: Use Dev Containers

Dev Containers match CI most closely (Node 24.12.0).

```bash
# Open in VS Code Dev Container
# Run commands:
pnpm install
pnpm build
pnpm test
```

**Pros:** Fast, full feature support
**Cons:** Still not exact CI environment

#### Option 3: Manual Node 24 testing (Nix users)

```bash
# Exit Nix shell
exit

# Use nvm for Node 24
nvm use 24.12.0
pnpm install
pnpm test
```

**Pros:** Tests Node 24 compatibility
**Cons:** Tedious, no PostgreSQL from Nix

### Common CI Issues

#### Issue: "Cannot find module" errors

**Cause:** Missing dependency in `package.json`
**Solution:** Install and commit:
```bash
pnpm add <missing-package>
git add package.json pnpm-lock.yaml
git commit -m "Add missing dependency"
```

#### Issue: Tests pass locally, fail in CI

**Possible causes:**
1. **Node version difference** (Nix: 22 vs CI: 24)
2. **Environment variable missing** in CI secrets
3. **Timezone difference** (CI uses UTC)
4. **File system case sensitivity** (CI: Linux, Local: might be Mac)

**Debug:**
```bash
# Check Node version locally
node --version

# Run tests with CI environment variables
NODE_ENV=test CI=true pnpm test

# Check for case-sensitive imports
# (import './Component.tsx' vs './component.tsx')
```

#### Issue: Database connection fails

**Cause:** Connection string mismatch

**Local (Nix):**
```bash
postgresql://postgres@localhost:5432/revealui
```

**CI:**
```bash
postgresql://postgres:postgres@localhost:5432/revealui
```

**Solution:** Make connection string configurable:
```typescript
const url = process.env.POSTGRES_URL || 'postgresql://postgres@localhost:5432/revealui';
```

#### Issue: Build succeeds locally, fails in CI

**Possible causes:**
1. **TypeScript errors ignored locally** (strict mode difference)
2. **ESLint warnings treated as errors** in CI
3. **Different build caching** (Turbo cache)

**Solution:**
```bash
# Run with CI-like strictness
NODE_ENV=production pnpm build

# Clear Turbo cache
rm -rf .turbo
pnpm build
```

### Node.js Version Strategy

#### Current State

- **CI:** Node.js 24.12.0 (target version)
- **Dev Containers:** Node.js 24.12.0 (matches CI)
- **Nix:** Node.js 22 (nixpkgs limitation)
- **Manual:** Node.js 24.12.0 (user installs)

#### Why This Is Acceptable

**Node.js 22 and 24 are highly compatible:**
- Same major APIs
- No breaking changes in our use case
- RevealUI doesn't use Node 24-specific features (yet)

**CI catches Node 24 issues:**
- All PRs run tests on Node 24
- Any Node 24-specific breakage fails CI
- Team gets immediate feedback

#### When to Worry

**Watch for:**
- CI tests failing with Node-specific errors
- Crypto/Buffer API differences (rare)
- Module resolution changes (rare)
- Performance characteristics (unlikely)

**If issues arise:**
1. Check CI logs for Node version-specific errors
2. Test locally on Node 24 (use Dev Containers or nvm)
3. Update code to be compatible with both versions
4. Document any version-specific workarounds

#### Future Plans

**When Node.js 24 arrives in nixpkgs:**
```nix
# Update flake.nix
nodejs = pkgs.nodejs_24;  # Currently: nodejs_22
```

**Timeline:** Expected Q1-Q2 2026 (monitor nixpkgs unstable)

**Tracking:** See `flake.nix` lines 14-16 for update status

### CI Best Practices

#### Write CI-Agnostic Code

**✅ Good:**
```typescript
// Use environment variables
const dbUrl = process.env.POSTGRES_URL;

// Detect CI environment
const isCI = process.env.CI === 'true';

// Make tests timezone-agnostic
const date = new Date().toISOString();
```

**❌ Bad:**
```typescript
// Hardcoded connection
const dbUrl = 'postgresql://postgres@localhost:5432/revealui';

// Assumes local setup
const dataDir = '.pgdata/';

// Timezone-dependent tests
expect(date).toBe('2026-01-30 08:00:00');  // Fails in UTC
```

#### Test in CI Early

**Don't wait for CI to find issues:**

```bash
# Before pushing, run CI-like checks
NODE_ENV=test pnpm build
NODE_ENV=test pnpm test
pnpm lint
pnpm type-check

# Or use a pre-push hook (recommended)
```

#### Keep CI Fast

**Optimization tips:**
- Use `--frozen-lockfile` (don't update lockfile in CI)
- Enable Turbo caching
- Cache pnpm store with `actions/cache`
- Only run tests on affected packages
- Use matrix builds for parallel testing

#### Monitor CI Performance

**Track metrics:**
- Build time (target: <5 minutes)
- Cache hit rate (target: >80%)
- Test execution time (target: <2 minutes)
- Flaky test frequency (target: 0%)

**Tools:**
- GitHub Actions insights (built-in)
- Turbo Remote Cache analytics
- Custom timing logs in workflows

#### Troubleshooting Checklist

When CI fails but local passes:

- [ ] Check Node.js version (`node --version`)
- [ ] Check environment variables (CI secrets configured?)
- [ ] Check database connection string
- [ ] Run tests with `NODE_ENV=test`
- [ ] Check timezone-dependent logic
- [ ] Check file path case sensitivity
- [ ] Clear caches and rebuild
- [ ] Check for flaky tests (race conditions)
- [ ] Review CI logs for specific error messages

#### Future Improvements

**Under consideration:**

1. **Add Nix to CI (optional workflow)**
   - Test Nix environment in CI
   - Validate flake.nix correctness
   - Compare build times

2. **Node.js version matrix**
   - Test on both Node 22 and 24
   - Ensure compatibility
   - Catch version-specific issues early

3. **Turbo Remote Cache**
   - Share build cache across CI runs
   - Faster builds for unchanged packages
   - Already configured, need Vercel account

4. **Parallel test execution**
   - Split tests across multiple runners
   - Reduce total CI time
   - Cost vs speed tradeoff

**Rejected ideas:**
- ❌ **Use Nix in CI** - Too slow, overcomplicated
- ❌ **Use Dev Containers in CI** - Docker overhead, slower than native
- ❌ **Match local environments exactly** - Unnecessary constraint, different priorities

---

## Database Management

This section describes the database management scripts available in RevealUI and their usage across different development environments.

### Overview

RevealUI provides a **unified interface** for database operations through pnpm scripts. These work consistently across all development environments (Nix, Dev Containers, Manual setup).

### Available Commands

#### Core Database Commands

| Command | Description | File | Environment Variables Required |
|---------|-------------|------|-------------------------------|
| `pnpm db:init` | Initialize database connection and verify setup | `scripts/setup/database.ts` | `POSTGRES_URL`, `DATABASE_URL`, or `SUPABASE_DATABASE_URI` |
| `pnpm db:migrate` | Run Drizzle migrations | `scripts/setup/migrations.ts` | `POSTGRES_URL` or `DATABASE_URL` |
| `pnpm db:reset` | Drop all tables and recreate schema | `scripts/setup/reset-database.ts` | Same as init |
| `pnpm db:seed` | Seed database with sample data | `scripts/setup/seed-sample-content.ts` | Same as init |
| `pnpm db:backup` | Create JSON backup of all tables | `scripts/commands/database/backup.ts` | Same as init |
| `pnpm db:restore` | Restore from backup file | `scripts/commands/database/restore.ts` | Same as init |
| `pnpm db:status` | Check database connection and table count | `scripts/commands/database/status.ts` | Same as init |
| `pnpm db:setup-test` | Setup test database | `scripts/setup/test-database.ts` | Test-specific vars |

### Command Details

#### `pnpm db:init`

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

#### `pnpm db:migrate`

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

#### `pnpm db:reset`

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

#### `pnpm db:seed`

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

#### `pnpm db:backup`

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

#### `pnpm db:restore`

**Purpose:** Restore database from backup file.

**Usage:**
```bash
# Restore from specific backup
pnpm db:restore .revealui/backups/db-backup-2026-01-30T12-34-56.json
```

#### `pnpm db:status`

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

### Database Environment Variables

#### Required Variables

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

#### Optional Variables

- `NODE_ENV` - Affects logging level (`development`, `production`, `test`)
- `CI` - Skips interactive prompts when set to `true`

### Environment-Specific Usage

#### Pure Nix Environment

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

#### Dev Containers

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

#### Manual Setup

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

### Database Locations

#### Local Development

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

### Common Workflows

#### First-Time Setup

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

#### Reset to Clean State

```bash
# Interactive (safest)
pnpm db:reset

# Quick reset (no prompts, with backup)
pnpm db:reset --confirm

# Full reset with sample data
pnpm db:reset --confirm --seed
```

#### Before Testing

```bash
# Reset database to known state
pnpm db:reset --confirm --no-backup

# Run tests
pnpm test
```

#### Before Deployment

```bash
# Backup production-like data
pnpm db:backup

# Verify migrations work
pnpm db:migrate

# Test with production-like data
pnpm dev
```

### Database Troubleshooting

#### "No database connection string found"

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

#### "Connection refused" or "Connection timeout"

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

#### "Permission denied" on tables

**Cause:** User doesn't have permissions on tables

**Solution:**
```bash
# Reset database with proper permissions
pnpm db:reset --confirm
```

#### "Database already exists" during migration

**Cause:** Migrations already applied

**Solution:**
```bash
# Check migration status
pnpm db:status

# If needed, reset and migrate
pnpm db:reset --confirm
pnpm db:migrate
```

#### Backup restoration fails

**Solution:**
```bash
# Reset database first
pnpm db:reset --confirm --no-backup

# Then restore
pnpm db:restore .revealui/backups/db-backup-<timestamp>.json
```

### Database Best Practices

#### DO:

✅ **Use pnpm scripts** for consistency across environments
```bash
pnpm db:init      # ✅ Works everywhere
pnpm db:migrate   # ✅ Works everywhere
```

✅ **Back up before destructive operations**
```bash
pnpm db:backup
pnpm db:reset
```

✅ **Test migrations before deployment**
```bash
pnpm db:backup
pnpm db:migrate
# Test thoroughly
pnpm db:restore backup.json  # If issues found
```

✅ **Use `--confirm` in scripts**
```json
{
  "scripts": {
    "db:fresh": "pnpm db:reset --confirm --seed"
  }
}
```

#### DON'T:

❌ **Don't use environment-specific commands in shared scripts**
```bash
# ❌ Bad (Nix-specific)
db-start && pnpm dev

# ✅ Good (environment-agnostic)
pnpm dev
```

❌ **Don't skip backups in production-like environments**
```bash
# ❌ Dangerous
pnpm db:reset --no-backup

# ✅ Safer
pnpm db:reset  # Creates backup automatically
```

❌ **Don't hardcode connection strings**
```typescript
// ❌ Bad
const db = postgres('postgresql://postgres@localhost:5432/revealui');

// ✅ Good
const db = postgres(process.env.DATABASE_URL!);
```

#### CI/CD Integration

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

#### Migration Path

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

## Path Aliases and Module Resolution

This section explains the path alias strategy used across the RevealUI monorepo for both TypeScript compilation (`tsconfig.json`) and test resolution (`vitest.config.ts`).

### Why Path Aliases?

#### Benefits

1. **Clean imports** - `import { foo } from '@/lib/foo'` vs `import { foo } from '../../../lib/foo'`
2. **Refactoring safety** - Moving files doesn't break imports
3. **Consistency** - Uniform import style across the codebase
4. **IntelliSense** - Better IDE autocomplete and navigation

#### Trade-offs

- **Configuration overhead** - Must sync between tools
- **Learning curve** - New developers need to understand alias patterns
- **Build tool support** - Not all tools support all alias formats

### Monorepo Strategy

#### Workspace Package References

**Preferred approach:** Use workspace protocol
```json
{
  "dependencies": {
    "@revealui/core": "workspace:*",
    "@revealui/contracts": "workspace:*"
  }
}
```

**Why?**
- pnpm handles resolution automatically
- No aliases needed in most cases
- Type checking works out of the box

#### Internal Package Aliases

**When to use:** Within a package's source code

**Example:** `packages/services/tsconfig.json`
```json
{
  "compilerOptions": {
    "paths": {
      "services/*": ["./dist/*", "./src/*"]
    }
  }
}
```

### Configuration Patterns

#### Pattern 1: Root Path Alias (`@`)

**Used in:** Apps (cms, web, dashboard)

**TypeScript (`tsconfig.json`):**
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

**Vitest (`vitest.config.ts`):**
```typescript
import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
```

**Usage:**
```typescript
// Instead of:
import { Button } from '../../../components/Button'

// Use:
import { Button } from '@/components/Button'
```

#### Pattern 2: Package Name Alias

**Used in:** Packages with complex internal structure

**TypeScript (`tsconfig.json`):**
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "services/*": ["./src/*"]
    }
  }
}
```

**Vitest (`vitest.config.ts`):**
```typescript
export default defineConfig({
  resolve: {
    alias: {
      'services': path.resolve(__dirname, './src')
    }
  }
})
```

**Usage:**
```typescript
import { stripeService } from 'services/core/stripe'
```

#### Pattern 3: Workspace Cross-Package Aliases

**Used in:** Test files referencing other workspace packages

**Example:** `packages/core/vitest.config.ts`
```typescript
export default defineConfig({
  resolve: {
    alias: {
      '@revealui/contracts': path.resolve(__dirname, '../contracts/src')
    }
  }
})
```

**Why?**
- Vitest may not resolve workspace packages correctly in all cases
- Ensures tests can import from source (not dist)
- Faster test execution (no build step needed)

### Synchronization Checklist

When adding or modifying path aliases, update **both** files:

#### 1. TypeScript Configuration
✅ Update `tsconfig.json` with `paths` mapping
✅ Verify IDE autocomplete works
✅ Run `pnpm typecheck` to confirm no errors

#### 2. Vitest Configuration
✅ Update `vitest.config.ts` with `resolve.alias`
✅ Ensure paths match TypeScript config
✅ Run `pnpm test` to verify resolution

#### 3. Documentation
✅ Update this document if introducing new patterns

### Common Patterns by Package Type

#### Application (Next.js)

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@/components/*": ["./src/components/*"],
      "@/lib/*": ["./src/lib/*"]
    }
  }
}

// vitest.config.ts
{
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/lib': path.resolve(__dirname, './src/lib')
    }
  }
}
```

#### Library Package

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "package-name/*": ["./src/*"]
    }
  }
}

// vitest.config.ts (if tests exist)
{
  resolve: {
    alias: {
      'package-name': path.resolve(__dirname, './src')
    }
  }
}
```

### Module Resolution Strategies

#### TypeScript Module Resolution

**Base tsconfig.json:** `moduleResolution: "NodeNext"`
- Used for Node.js scripts at monorepo root
- Follows Node.js ESM resolution rules

**Frontend packages:** `moduleResolution: "bundler"`
- Used for Vite, Next.js bundled packages
- Allows extensionless imports
- Supports path mapping

**Why different?**
- Monorepo has both Node.js scripts and bundled apps
- Each needs appropriate resolution strategy
- Documented in `packages/dev/src/ts/base.json`

#### Vitest Resolution

Vitest uses Vite's resolver which:
- Supports `resolve.alias` configuration
- Respects `tsconfig.json` paths (with limitations)
- May need explicit aliases for workspace packages

### Path Alias Troubleshooting

#### Issue: "Cannot find module '@/foo'"

**TypeScript error:**
1. Check `tsconfig.json` has correct `paths` mapping
2. Verify `baseUrl` is set correctly
3. Restart TypeScript server in IDE

**Vitest error:**
1. Check `vitest.config.ts` has matching `resolve.alias`
2. Ensure path is resolved correctly with `path.resolve()`
3. Verify file exists at resolved path

#### Issue: Alias works in TypeScript but not in Vitest

**Solution:** Add explicit alias to `vitest.config.ts`

```typescript
// vitest.config.ts
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Add any missing aliases from tsconfig.json
    }
  }
})
```

#### Issue: Circular dependencies with aliases

**Symptoms:**
- Build succeeds but runtime errors
- Tests pass individually but fail together

**Solution:**
- Review import graph
- Break circular dependencies at source level
- Don't rely on aliases to "fix" circular imports

### Examples by Package

#### `packages/core`

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "baseUrl": "."
    // No custom paths - uses workspace protocol
  }
}
```

**vitest.config.ts:**
```typescript
{
  resolve: {
    alias: {
      // Test-only alias to reference contracts source
      '@revealui/contracts': path.resolve(__dirname, '../contracts/src')
    }
  }
}
```

#### `packages/services`

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "paths": {
      "services/*": ["./dist/*", "./src/*"]
    }
  }
}
```

**vitest.config.ts:**
```typescript
{
  resolve: {
    alias: {
      'services': path.resolve(__dirname, './src'),
      // Test utilities alias
      'services/stripeTestUtils': path.resolve(
        __dirname,
        './src/core/stripe/stripeClient.test-utils.ts'
      )
    }
  }
}
```

#### `apps/cms`

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

**vitest.config.ts:**
```typescript
{
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
}
```

### Path Alias Best Practices

#### DO ✅

1. **Keep aliases simple** - `@/foo` is better than `@components/ui/Button`
2. **Match TypeScript and Vitest** - Aliases should be identical
3. **Use absolute paths** - `path.resolve(__dirname, './src')` not `'./src'`
4. **Document package-specific aliases** - Comment why non-standard aliases exist
5. **Prefer workspace protocol** - For inter-package imports

#### DON'T ❌

1. **Create too many aliases** - Diminishing returns on maintainability
2. **Use aliases for external packages** - Let package manager handle it
3. **Forget to sync configs** - TypeScript and Vitest must match
4. **Mix resolution strategies** - Stick to one pattern per package type

#### Maintenance

**When Adding New Aliases:**

1. **Consider necessity** - Does the alias solve a real problem?
2. **Update both configs** - TypeScript and Vitest
3. **Test thoroughly** - Build, typecheck, and test
4. **Document** - Add to this guide if pattern is new

**Regular Reviews:**

**Frequency:** Quarterly

**Checklist:**
- [ ] Are all aliases still used?
- [ ] Can any be simplified?
- [ ] Are configs in sync?
- [ ] Any new patterns to document?

#### Migration Guide

**From Relative Imports to Aliases:**

**Before:**
```typescript
// src/app/dashboard/components/Widget.tsx
import { getUser } from '../../../lib/auth'
import { Button } from '../../../components/ui/Button'
```

**After:**
```typescript
// src/app/dashboard/components/Widget.tsx
import { getUser } from '@/lib/auth'
import { Button } from '@/components/ui/Button'
```

**Steps:**
1. Add alias configuration (TypeScript + Vitest)
2. Run find/replace with caution (test imports first)
3. Verify typecheck passes
4. Run full test suite

**From Aliases to Workspace Protocol:**

**Before:**
```typescript
// In a package, using alias
import { Contract } from '@revealui/contracts/src/types'
```

**After:**
```typescript
// Using proper package export
import { Contract } from '@revealui/contracts'
```

**Steps:**
1. Ensure target package has proper `exports` in package.json
2. Update imports to use package name
3. Remove unnecessary aliases
4. Rebuild and test

---

## TypeScript Strict Mode

This section documents the TypeScript strict mode configuration and migration strategy for the RevealUI monorepo.

### Current State

#### Packages with Strict Mode Disabled

**`packages/ai`**
```json
{
  "compilerOptions": {
    "strict": false,
    "noImplicitAny": false
  }
}
```

**Reason:** Complex AI and vector memory types make strict mode migration challenging.

#### All Other Packages

All other packages in the monorepo have strict mode enabled.

### Why Strict Mode Matters

#### Benefits

1. **Type Safety** - Catch potential bugs at compile time
2. **Better IDE Support** - Improved autocomplete and refactoring
3. **Maintainability** - Clearer code contracts and interfaces
4. **Onboarding** - Easier for new developers to understand code

#### Current Issues in packages/ai

- **Implicit Any Types** - Many AI/vector functions have `any` parameters
- **Null/Undefined Handling** - Optional chaining and null checks missing
- **Function Return Types** - Some functions lack explicit return type annotations
- **Type Assertions** - Overuse of type assertions (`as Type`) to bypass checks

### Migration Strategy

**Status:** Planned
**Priority:** Medium
**Estimated Effort:** 8-12 hours
**Target:** Q2 2026

#### Phase 1: Audit and Categorize (2 hours)

Run TypeScript with strict mode enabled and categorize errors:

```bash
cd packages/ai
npx tsc --noEmit --strict --listFiles > /tmp/ai-strict-errors.txt 2>&1
```

**Expected error categories:**
1. Implicit any parameters
2. Null/undefined issues
3. Missing return types
4. Unsafe type assertions
5. Indexing issues (`element implicitly has 'any' type`)

**Deliverable:** Document categorizing all errors by file and type.

#### Phase 2: Fix Low-Hanging Fruit (2-3 hours)

**Priority order:**
1. Add explicit return types to all exported functions
2. Replace `any` with proper types for simple cases
3. Add null checks where TypeScript identifies potential null access
4. Fix indexing issues with proper type guards

**Example fixes:**
```typescript
// Before
function embedText(text) {
  return vectorService.embed(text)
}

// After
function embedText(text: string): Promise<number[]> {
  return vectorService.embed(text)
}
```

#### Phase 3: Define Complex Types (3-4 hours)

**Focus areas:**

1. **Vector Memory Types**
   - `EmbeddingVector`, `VectorSearchResult`, `MemoryChunk`
   - Create proper interfaces instead of `any`

2. **LLM Response Types**
   - OpenAI/Anthropic response shapes
   - Streaming response handlers

3. **Observability Types**
   - Span contexts, trace metadata
   - Instrumentation data structures

**Strategy:**
- Create `src/types/` directory for shared types
- Use branded types for IDs (`type MemoryId = string & { __brand: 'MemoryId' }`)
- Leverage utility types (`Partial`, `Pick`, `Omit`)

#### Phase 4: Enable Strict Null Checks (2-3 hours)

Enable incrementally:
```json
{
  "compilerOptions": {
    "strict": false,
    "strictNullChecks": true,
    "noImplicitAny": false
  }
}
```

**Common patterns to fix:**
```typescript
// Before
const memory = await getMemory(id)
return memory.content  // Error: memory might be null

// After
const memory = await getMemory(id)
if (!memory) throw new Error('Memory not found')
return memory.content
```

#### Phase 5: Enable Full Strict Mode (1 hour)

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true
  }
}
```

Run tests, fix any remaining issues, verify all checks pass.

### Implementation Checklist

#### Before Starting
- [ ] Ensure AI package has comprehensive test coverage (currently approximately 60%)
- [ ] Create a separate branch for migration
- [ ] Run baseline tests to ensure all pass

#### During Migration
- [ ] Phase 1: Audit complete, errors categorized
- [ ] Phase 2: Low-hanging fruit fixed
- [ ] Phase 3: Complex types defined
- [ ] Phase 4: Strict null checks enabled
- [ ] Phase 5: Full strict mode enabled
- [ ] All tests passing
- [ ] No TypeScript errors
- [ ] Code review completed

#### After Migration
- [ ] Update documentation with new type patterns
- [ ] Add contributing guidelines about strict mode
- [ ] Monitor for any runtime issues in production
- [ ] Remove technical debt issue from backlog

### Testing Strategy

#### Test Coverage Requirements
- Maintain or improve current coverage (approximately 60% to 70%+)
- Add tests for newly typed functions
- Focus on edge cases revealed by strict mode

#### Verification Steps
```bash
# 1. Type check passes
pnpm --filter @revealui/ai typecheck

# 2. Unit tests pass
pnpm --filter @revealui/ai test

# 3. Integration tests pass
pnpm test

# 4. Build succeeds
pnpm --filter @revealui/ai build
```

### Risk Mitigation

#### Potential Issues

1. **Breaking changes** in type signatures
   - Mitigation: Semantic versioning, changelog updates
2. **Performance overhead** from runtime type guards
   - Mitigation: Benchmark critical paths, optimize guards
3. **Development velocity slowdown** during migration
   - Mitigation: Time-box each phase, allow for flexibility

#### Rollback Plan
- Keep pre-migration branch available
- If issues arise, temporarily disable strict mode
- Complete migration in smaller increments

### Success Metrics

#### Quantitative
- [ ] 0 TypeScript errors with `--strict` flag
- [ ] Test coverage greater than or equal to 70%
- [ ] Build time unchanged (within 5%)
- [ ] No production incidents related to type changes

#### Qualitative
- [ ] Developers report better IDE experience
- [ ] Fewer runtime type errors in production
- [ ] Easier onboarding for new team members

### Timeline

| Phase | Duration | Target Completion |
|-------|----------|-------------------|
| Phase 1: Audit | 2 hours | Week 1 |
| Phase 2: Low-hanging fruit | 2-3 hours | Week 1-2 |
| Phase 3: Complex types | 3-4 hours | Week 2-3 |
| Phase 4: Strict null checks | 2-3 hours | Week 3 |
| Phase 5: Full strict mode | 1 hour | Week 4 |
| Testing and Review | 2 hours | Week 4 |
| **Total** | **12-15 hours** | **Q2 2026** |

### Best Practices

#### DO

1. Consider migrating during a low-velocity sprint
2. Use pair programming for complex type definitions
3. Document patterns in a "Type Patterns" guide for the team
4. Test incrementally after each phase

#### DON'T

1. Rush the migration - type safety requires careful consideration
2. Over-use type assertions to bypass errors
3. Ignore test coverage - maintain or improve it during migration

### Resources

- [TypeScript Strict Mode Guide](https://www.typescriptlang.org/tsconfig#strict)
- [Type Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
- [Utility Types](https://www.typescriptlang.org/docs/handbook/utility-types.html)

**Last Updated:** 2026-01-30

---

## Related Documentation

- [DATABASE_SETUP.md](./DATABASE_SETUP.md) - Comprehensive database configuration guide
- [AUTHENTICATION.md](../features/AUTHENTICATION.md) - Authentication system documentation
- [ENVIRONMENT_COMPARISON.md](../guides/ENVIRONMENT_COMPARISON.md) - Development environment comparison
- [NIX_SETUP.md](../guides/NIX_SETUP.md) - Nix environment setup guide

---

## Summary

**Key Takeaways:**

1. **CI/CD:** Uses vanilla GitHub Actions for speed and simplicity
2. **Database:** Unified pnpm scripts work across all environments
3. **Path Aliases:** Keep TypeScript and Vitest configs synchronized
4. **TypeScript Strict Mode:** Planned migration for packages/ai in Q2 2026
5. **Development:** Write environment-agnostic, CI-friendly code
6. **Best Practices:** Test early, back up often, document thoroughly

**Questions?** Open a GitHub issue or consult the related documentation above.
