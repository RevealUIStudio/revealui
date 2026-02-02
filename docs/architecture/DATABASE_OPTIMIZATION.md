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
- **Caching** - Redis caching layer for query results
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
import { monitorQuery, logSlowQuery } from '@revealui/core/monitoring/query-monitor'

// Wrap queries with monitoring
const users = await monitorQuery('getUsersWithPosts', async () => {
  return db.query('SELECT * FROM users')
})

// Log slow query manually
logSlowQuery(
  'SELECT * FROM posts WHERE author_id = $1',
  150, // 150ms duration
  ['user-123']
)
```

### View Query Statistics

```typescript
import { getQueryStats, getQueryReport } from '@revealui/core/monitoring/query-monitor'

// Get summary stats
const stats = getQueryStats()
console.log({
  totalQueries: stats.totalQueries,
  avgDuration: stats.avgDuration,
  p95: stats.p95,
  slowQueries: stats.slowQueries,
})

// Get full report
const report = getQueryReport()
console.log(report)
```

### Query Percentiles

```typescript
import { getQueryPercentiles } from '@revealui/core/monitoring/query-monitor'

const percentiles = getQueryPercentiles()
console.log({
  p50: percentiles.p50, // Median
  p95: percentiles.p95, // 95th percentile
  p99: percentiles.p99, // 99th percentile
})
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
const posts = await db.query('SELECT * FROM posts')

for (const post of posts.rows) {
  // Additional query for each post
  const author = await db.query('SELECT * FROM users WHERE id = $1', [post.author_id])
  post.author = author.rows[0]
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
`)
```

### Solution 2: Batch Loading

```typescript
// ✅ GOOD: Batch load in single query
async function getUsersByIds(ids: string[]) {
  return db.query('SELECT * FROM users WHERE id = ANY($1)', [ids])
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
`
```

## Query Caching

### Basic Caching

```typescript
import { cacheQuery } from '@revealui/core/cache/query-cache'

// Cache for 5 minutes
const users = await cacheQuery(
  'users:all',
  () => db.query('SELECT * FROM users'),
  { ttl: 300 }
)
```

### List Caching

```typescript
import { cacheList } from '@revealui/core/cache/query-cache'

const posts = await cacheList(
  'posts',
  { status: 'published', limit: 20 },
  () => getPublishedPosts(),
  300
)
```

### Item Caching

```typescript
import { cacheItem } from '@revealui/core/cache/query-cache'

const user = await cacheItem(
  'users',
  userId,
  () => getUserById(userId),
  300
)
```

### Cache Invalidation

```typescript
import {
  invalidateCache,
  invalidateCachePattern,
  invalidateResource,
} from '@revealui/core/cache/query-cache'

// Invalidate specific key
await invalidateCache('users:all')

// Invalidate by pattern
await invalidateCachePattern('posts:*')

// Invalidate entire resource
await invalidateResource('users')
```

### Stale-While-Revalidate

```typescript
import { cacheSWR } from '@revealui/core/cache/query-cache'

// Return stale data immediately, revalidate in background
const data = await cacheSWR(
  'expensive-query',
  () => runExpensiveQuery(),
  {
    ttl: 300,      // Fresh for 5 minutes
    staleTime: 60, // Stale data valid for 1 minute
  }
)
```

## Connection Pooling

### Pool Configuration

```typescript
import { Pool } from 'pg'

const pool = new Pool({
  max: 20,                      // Maximum pool size
  min: 5,                       // Minimum pool size
  idleTimeoutMillis: 30000,     // 30 seconds
  connectionTimeoutMillis: 5000, // 5 seconds
  statement_timeout: 10000,     // 10 seconds
  query_timeout: 10000,         // 10 seconds
})
```

### Monitor Pool Health

```typescript
import { getPoolStats, checkDatabaseHealth } from '@revealui/db/pool'

// Get pool statistics
const stats = getPoolStats()
console.log({
  totalCount: stats.totalCount,
  idleCount: stats.idleCount,
  utilization: stats.utilization,
})

// Check health
const health = await checkDatabaseHealth()
console.log(health)
```

### Warmup Pool

```typescript
import { warmupPool } from '@revealui/db/pool'

// Pre-warm connections on startup
await warmupPool()
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
import { benchmarkQuery } from '@/scripts/performance/benchmark-queries'

const result = await benchmarkQuery(
  'My Custom Query',
  () => db.query('SELECT * FROM posts LIMIT 100'),
  100 // iterations
)

console.log({
  avgDuration: result.avgDuration,
  p95: result.p95,
  qps: result.queriesPerSecond,
})
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

### 2. Avoid SELECT *

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
  await db.query('INSERT INTO users (name, email) VALUES ($1, $2)', [user.name, user.email])
}

// ✅ GOOD: Batch insert
const values = users.map((u, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(',')
const params = users.flatMap(u => [u.name, u.email])
await db.query(`INSERT INTO users (name, email) VALUES ${values}`, params)
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
const client = await pool.connect()
try {
  await client.query('BEGIN')

  await client.query('INSERT INTO users (name) VALUES ($1)', ['Alice'])
  await client.query('INSERT INTO posts (title, author_id) VALUES ($1, $2)', ['Post', 1])

  await client.query('COMMIT')
} catch (error) {
  await client.query('ROLLBACK')
  throw error
} finally {
  client.release()
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
import { getPoolStats } from '@revealui/db/pool'

setInterval(() => {
  const stats = getPoolStats()
  if (stats.utilization > 80) {
    console.warn('High pool utilization:', stats)
  }
  if (stats.waitingCount > 5) {
    console.warn('Many waiting requests:', stats.waitingCount)
  }
}, 60000)
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
