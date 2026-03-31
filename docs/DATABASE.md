---
title: "Database Management"
description: "Drizzle ORM schema, migrations, dual-database setup (NeonDB + Supabase), and seeding"
category: guide
audience: developer
---

# Database Management Guide

This guide describes the RevealUI database workflow and the underlying database scripts it orchestrates across different development environments.

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

RevealUI now exposes a unified developer-facing database interface through the `revealui` CLI.

Use these commands first:

| Command                          | Purpose                                              |
| -------------------------------- | ---------------------------------------------------- |
| `pnpm revealui doctor`           | Check whether your local environment is ready        |
| `pnpm revealui dev up --dry-run` | Preview the local startup plan                       |
| `pnpm revealui dev up`           | Bootstrap the local environment                      |
| `pnpm revealui db status`        | Check local database readiness                       |
| `pnpm revealui db start`         | Start the local database                             |
| `pnpm revealui db migrate`       | Run Drizzle migrations through the RevealUI workflow |

The older `pnpm db:*` scripts still exist and remain useful as lower-level building blocks, but the supported day-to-day workflow is now `revealui dev ...` and `revealui db ...`.

## Available Commands

### Core Database Commands

### Preferred RevealUI Commands

| Command                    | Description                                              |
| -------------------------- | -------------------------------------------------------- |
| `pnpm revealui db init`    | Initialize the local database data directory when needed |
| `pnpm revealui db start`   | Start local Postgres using the current local environment |
| `pnpm revealui db stop`    | Stop the local database                                  |
| `pnpm revealui db status`  | Report local database health                             |
| `pnpm revealui db migrate` | Run Drizzle migrations                                   |
| `pnpm revealui dev up`     | End-to-end local bootstrap, including database checks    |

### Underlying pnpm Scripts

| Command              | Description                                     | File                                   | Environment Variables Required                             |
| -------------------- | ----------------------------------------------- | -------------------------------------- | ---------------------------------------------------------- |
| `pnpm db:init`       | Initialize database connection and verify setup | `scripts/setup/database.ts`            | `POSTGRES_URL`, `DATABASE_URL`, or `SUPABASE_DATABASE_URI` |
| `pnpm db:migrate`    | Run Drizzle migrations                          | `scripts/setup/migrations.ts`          | `POSTGRES_URL` or `DATABASE_URL`                           |
| `pnpm db:reset`      | Drop all tables and recreate schema             | `scripts/setup/reset-database.ts`      | Same as init                                               |
| `pnpm db:seed`       | Seed database with sample data                  | `scripts/setup/seed-sample-content.ts` | Same as init                                               |
| `pnpm db:backup`     | Create JSON backup of all tables                | `scripts/commands/database/backup.ts`  | Same as init                                               |
| `pnpm db:restore`    | Restore from backup file                        | `scripts/commands/database/restore.ts` | Same as init                                               |
| `pnpm db:status`     | Check database connection and table count       | `scripts/commands/database/status.ts`  | Same as init                                               |
| `pnpm db:setup-test` | Setup test database                             | `scripts/dev-tools/test-database.ts`   | Test-specific vars                                         |

## Command Details

### `pnpm revealui db init`

**Purpose:** Initialize the local database data directory for the supported local Postgres workflow.

**Usage:**

```bash
pnpm revealui db init
```

### `pnpm revealui db start`

**Purpose:** Start the local Postgres instance used by RevealUI local development.

**Usage:**

```bash
pnpm revealui db start
pnpm revealui db status
```

### `pnpm revealui db migrate`

**Purpose:** Apply the current Drizzle migration set to the configured local database target.

**Usage:**

```bash
pnpm revealui db migrate
pnpm revealui dev up
```

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
# Low-level verification
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
# Low-level migration flow
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

**Server control** (preferred RevealUI CLI):

```bash
revealui db init     # Initialize PostgreSQL data directory
revealui db start    # Start PostgreSQL server
revealui db stop     # Stop PostgreSQL server
revealui db status   # Check if server running
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
# 1. Inspect the local bootstrap plan
revealui dev up --dry-run

# 2. Start PostgreSQL if needed
revealui db start

# 3. Initialize database (pnpm script)
pnpm db:init

# 4. Run migrations (pnpm script)
pnpm db:migrate

# 5. Seed data (pnpm script)
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

| Environment        | PostgreSQL Data Directory | Gitignored?           |
| ------------------ | ------------------------- | --------------------- |
| **Nix**            | `.pgdata/`                | ✅ Yes                |
| **Dev Containers** | Docker volume (unnamed)   | N/A (container)       |
| **Manual**         | System-dependent          | N/A (outside project) |

**Backups** (all environments):

- Directory: `.revealui/backups/`
- Format: `db-backup-<timestamp>.json`
- Retention: Last 5 backups kept
- Gitignored: ✅ Yes (via `.revealui/`)

## Common Workflows

### First-Time Setup

```bash
# 1. Inspect the local bootstrap plan
revealui dev up --dry-run

# 2. Ensure PostgreSQL is running
# (RevealUI CLI for Nix/local, Docker automatic, Manual: OS-specific otherwise)
revealui db start

# 3. Initialize database
pnpm db:init

# 4. Run migrations
pnpm db:migrate

# 5. (Optional) Seed sample data
pnpm db:seed

# 6. Start development
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
revealui db status

# Start if not running
revealui db start

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
# ❌ Bad (environment-specific)
revealui db start && pnpm dev

# ✅ Good (environment-agnostic)
revealui dev up
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
const db = postgres("postgresql://postgres@localhost:5432/revealui");

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
revealui db start
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

- [CI/CD Guide](./CI_CD_GUIDE.md) - CI/CD pipeline and deployment
- [Architecture](./ARCHITECTURE.md) - System architecture overview

---

**Last Updated:** 2026-01-31
**Part of:** Development Guide consolidation

---

# Database Query Optimization Guide

Comprehensive guide to database performance optimization for RevealUI.

## Table of Contents

- [Overview](#overview)
- [Query Monitoring](#query-monitoring)
- [Indexing Strategy](#indexing-strategy)
- [N+1 Query Elimination](#n1-query-elimination)
- [Query Caching](#query-caching)
- [Connection Pooling](#connection-pooling)
- [Performance Benchmarks](#performance-benchmarks)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

Database performance is critical for application speed. This guide covers:

- **Query Monitoring** - Track slow queries and performance metrics
- **Indexes** - Strategic indexing for fast lookups
- **N+1 Elimination** - Optimize relationship queries
- **Caching** - In-memory Map-based caching for query results
- **Connection Pool** - Optimized pool configuration

### Performance Targets

- Query time: < 20ms (p95)
- Connection pool utilization: < 80%
- Cache hit rate: > 80%
- No N+1 queries
- All foreign keys indexed

## Query Monitoring

### Enable Slow Query Logging

```typescript
import {
  monitorQuery,
  logSlowQuery,
} from "@revealui/core/monitoring/query-monitor";

// Wrap queries with monitoring
const users = await monitorQuery("getUsersWithPosts", async () => {
  return db.query("SELECT * FROM users");
});

// Log slow query manually
logSlowQuery(
  "SELECT * FROM posts WHERE author_id = $1",
  150, // 150ms duration
  ["user-123"],
);
```

### View Query Statistics

```typescript
import {
  getQueryStats,
  getQueryReport,
} from "@revealui/core/monitoring/query-monitor";

// Get summary stats
const stats = getQueryStats();
console.log({
  totalQueries: stats.totalQueries,
  avgDuration: stats.avgDuration,
  p95: stats.p95,
  slowQueries: stats.slowQueries,
});

// Get full report
const report = getQueryReport();
console.log(report);
```

### Query Percentiles

```typescript
import { getQueryPercentiles } from "@revealui/core/monitoring/query-monitor";

const percentiles = getQueryPercentiles();
console.log({
  p50: percentiles.p50, // Median
  p95: percentiles.p95, // 95th percentile
  p99: percentiles.p99, // 99th percentile
});
```

## Indexing Strategy

### Analyze Missing Indexes

```sql
-- Find foreign keys without indexes
SELECT
  tc.table_name,
  kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = tc.table_name
      AND indexdef LIKE '%' || kcu.column_name || '%'
  );
```

### Create Strategic Indexes

```sql
-- User email lookup (authentication)
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);

-- Post slug lookup (public URLs)
CREATE INDEX CONCURRENTLY idx_posts_slug ON posts(slug);

-- Published posts sorted by date
CREATE INDEX CONCURRENTLY idx_posts_published_at
ON posts(published_at DESC)
WHERE published_at IS NOT NULL;

-- Composite index for common query
CREATE INDEX CONCURRENTLY idx_posts_author_status
ON posts(author_id, status);
```

### Partial Indexes

```sql
-- Index only published posts
CREATE INDEX CONCURRENTLY idx_posts_published
ON posts(published_at DESC)
WHERE status = 'published';

-- Index only verified users
CREATE INDEX CONCURRENTLY idx_users_verified
ON users(email_verified_at)
WHERE email_verified_at IS NOT NULL;
```

### Full-Text Search Index

```sql
-- GIN index for full-text search
CREATE INDEX CONCURRENTLY idx_posts_search
ON posts USING gin(
  to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, ''))
);

-- Query using full-text search
SELECT * FROM posts
WHERE to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, ''))
  @@ plainto_tsquery('english', 'optimization')
ORDER BY ts_rank(
  to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, '')),
  plainto_tsquery('english', 'optimization')
) DESC;
```

### Monitor Index Usage

```sql
-- Check index usage statistics
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Find unused indexes
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexname NOT LIKE 'pg_toast%'
ORDER BY tablename;
```

## N+1 Query Elimination

### Problem: N+1 Queries

```typescript
// ❌ BAD: N+1 query pattern
const posts = await db.query("SELECT * FROM posts");

for (const post of posts.rows) {
  // Additional query for each post
  const author = await db.query("SELECT * FROM users WHERE id = $1", [
    post.author_id,
  ]);
  post.author = author.rows[0];
}
```

### Solution 1: JOIN

```typescript
// ✅ GOOD: Single query with JOIN
const posts = await db.query(`
  SELECT
    p.*,
    json_build_object(
      'id', u.id,
      'name', u.name,
      'email', u.email
    ) as author
  FROM posts p
  LEFT JOIN users u ON u.id = p.author_id
`);
```

### Solution 2: Batch Loading

```typescript
// ✅ GOOD: Batch load in single query
async function getUsersByIds(ids: string[]) {
  return db.query("SELECT * FROM users WHERE id = ANY($1)", [ids]);
}
```

### Solution 3: JSON Aggregation

```typescript
// ✅ GOOD: Aggregate related data
const query = `
  SELECT
    u.id,
    u.name,
    COALESCE(
      json_agg(
        json_build_object(
          'id', p.id,
          'title', p.title
        )
        ORDER BY p.published_at DESC
      ) FILTER (WHERE p.id IS NOT NULL),
      '[]'
    ) as posts
  FROM users u
  LEFT JOIN posts p ON p.author_id = u.id
  GROUP BY u.id
`;
```

## Query Caching

### Basic Caching

```typescript
import { cacheQuery } from "@revealui/core/cache/query-cache";

// Cache for 5 minutes
const users = await cacheQuery(
  "users:all",
  () => db.query("SELECT * FROM users"),
  { ttl: 300 },
);
```

### List Caching

```typescript
import { cacheList } from "@revealui/core/cache/query-cache";

const posts = await cacheList(
  "posts",
  { status: "published", limit: 20 },
  () => getPublishedPosts(),
  300,
);
```

### Item Caching

```typescript
import { cacheItem } from "@revealui/core/cache/query-cache";

const user = await cacheItem("users", userId, () => getUserById(userId), 300);
```

### Cache Invalidation

```typescript
import {
  invalidateCache,
  invalidateCachePattern,
  invalidateResource,
} from "@revealui/core/cache/query-cache";

// Invalidate specific key
await invalidateCache("users:all");

// Invalidate by pattern
await invalidateCachePattern("posts:*");

// Invalidate entire resource
await invalidateResource("users");
```

### Stale-While-Revalidate

```typescript
import { cacheSWR } from "@revealui/core/cache/query-cache";

// Return stale data immediately, revalidate in background
const data = await cacheSWR("expensive-query", () => runExpensiveQuery(), {
  ttl: 300, // Fresh for 5 minutes
  staleTime: 60, // Stale data valid for 1 minute
});
```

## Connection Pooling

### Pool Configuration

```typescript
import { Pool } from "pg";

const pool = new Pool({
  max: 20, // Maximum pool size
  min: 5, // Minimum pool size
  idleTimeoutMillis: 30000, // 30 seconds
  connectionTimeoutMillis: 5000, // 5 seconds
  statement_timeout: 10000, // 10 seconds
  query_timeout: 10000, // 10 seconds
});
```

### Monitor Pool Health

```typescript
import { getPoolStats, checkDatabaseHealth } from "@revealui/db/pool";

// Get pool statistics
const stats = getPoolStats();
console.log({
  totalCount: stats.totalCount,
  idleCount: stats.idleCount,
  utilization: stats.utilization,
});

// Check health
const health = await checkDatabaseHealth();
console.log(health);
```

### Warmup Pool

```typescript
import { warmupPool } from "@revealui/db/pool";

// Pre-warm connections on startup
await warmupPool();
```

## Performance Benchmarks

### Run Benchmarks

```bash
# Run all query benchmarks
pnpm benchmark:queries

# View results
cat benchmark-results.json
```

### Benchmark Custom Query

```typescript
import { benchmarkQuery } from "@/scripts/performance/benchmark-queries";

const result = await benchmarkQuery(
  "My Custom Query",
  () => db.query("SELECT * FROM posts LIMIT 100"),
  100, // iterations
);

console.log({
  avgDuration: result.avgDuration,
  p95: result.p95,
  qps: result.queriesPerSecond,
});
```

## Best Practices

### 1. Always Use Indexes

```sql
-- ✅ Index foreign keys
CREATE INDEX idx_posts_author_id ON posts(author_id);

-- ✅ Index frequently filtered columns
CREATE INDEX idx_posts_status ON posts(status);

-- ✅ Index sort columns
CREATE INDEX idx_posts_published_at ON posts(published_at DESC);
```

### 2. Avoid SELECT \*

```sql
-- ❌ BAD: Fetches unnecessary data
SELECT * FROM users

-- ✅ GOOD: Fetch only needed columns
SELECT id, name, email FROM users
```

### 3. Use EXPLAIN ANALYZE

```sql
-- Analyze query performance
EXPLAIN ANALYZE
SELECT * FROM posts
WHERE status = 'published'
ORDER BY published_at DESC
LIMIT 20;
```

### 4. Batch Operations

```typescript
// ❌ BAD: Individual inserts
for (const user of users) {
  await db.query("INSERT INTO users (name, email) VALUES ($1, $2)", [
    user.name,
    user.email,
  ]);
}

// ✅ GOOD: Batch insert
const values = users.map((u, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(",");
const params = users.flatMap((u) => [u.name, u.email]);
await db.query(`INSERT INTO users (name, email) VALUES ${values}`, params);
```

### 5. Limit Result Sets

```sql
-- Always use LIMIT for large result sets
SELECT * FROM posts
WHERE status = 'published'
ORDER BY published_at DESC
LIMIT 20;
```

### 6. Use Transactions

```typescript
const client = await pool.connect();
try {
  await client.query("BEGIN");

  await client.query("INSERT INTO users (name) VALUES ($1)", ["Alice"]);
  await client.query("INSERT INTO posts (title, author_id) VALUES ($1, $2)", [
    "Post",
    1,
  ]);

  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
}
```

## Troubleshooting

### Slow Queries

```sql
-- Enable slow query log
ALTER SYSTEM SET log_min_duration_statement = 100; -- Log queries > 100ms
SELECT pg_reload_conf();

-- View slow queries
SELECT * FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### Missing Indexes

```sql
-- Find tables with sequential scans
SELECT
  schemaname,
  tablename,
  seq_scan,
  seq_tup_read,
  idx_scan
FROM pg_stat_user_tables
WHERE seq_scan > 1000
ORDER BY seq_scan DESC;
```

### Lock Contention

```sql
-- View blocking queries
SELECT
  blocked.pid AS blocked_pid,
  blocking.pid AS blocking_pid,
  blocked.query AS blocked_query,
  blocking.query AS blocking_query
FROM pg_stat_activity blocked
JOIN pg_stat_activity blocking
  ON blocking.pid = ANY(pg_blocking_pids(blocked.pid))
WHERE blocked.wait_event_type = 'Lock';
```

### Connection Pool Exhaustion

```typescript
// Monitor pool stats
import { getPoolStats } from "@revealui/db/pool";

setInterval(() => {
  const stats = getPoolStats();
  if (stats.utilization > 80) {
    console.warn("High pool utilization:", stats);
  }
  if (stats.waitingCount > 5) {
    console.warn("Many waiting requests:", stats.waitingCount);
  }
}, 60000);
```

## Tools

- **pg_stat_statements** - Query performance statistics
- **EXPLAIN ANALYZE** - Query execution plan
- **pgAdmin** - Database administration
- **PgHero** - Performance dashboard
- **Grafana** - Metrics visualization

## Resources

- [PostgreSQL Performance](https://www.postgresql.org/docs/current/performance-tips.html)
- [Indexing Best Practices](https://www.postgresql.org/docs/current/indexes.html)
- [Connection Pooling Guide](https://node-postgres.com/features/pooling)
- [Query Optimization](https://www.postgresql.org/docs/current/sql-explain.html)

---

**Last Updated**: February 2026
**Version**: 1.0.0
