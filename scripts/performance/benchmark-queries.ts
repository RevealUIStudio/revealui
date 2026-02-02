/**
 * Database Query Performance Benchmark
 *
 * Measures query execution time and provides performance insights
 */

import { db } from '../../packages/db/src/client.js'
import { pool } from '../../packages/db/src/pool.js'

interface BenchmarkResult {
  queryName: string
  iterations: number
  avgDuration: number
  minDuration: number
  maxDuration: number
  p50: number
  p95: number
  p99: number
  totalDuration: number
  queriesPerSecond: number
}

/**
 * Benchmark a single query
 */
async function benchmarkQuery(
  name: string,
  queryFn: () => Promise<unknown>,
  iterations: number = 100,
): Promise<BenchmarkResult> {
  console.log(`\nBenchmarking ${name}...`)

  const durations: number[] = []

  // Warmup
  await queryFn()

  // Run benchmark
  for (let i = 0; i < iterations; i++) {
    const start = Date.now()
    await queryFn()
    const duration = Date.now() - start
    durations.push(duration)

    if ((i + 1) % 10 === 0) {
      process.stdout.write(`\r  Progress: ${i + 1}/${iterations}`)
    }
  }

  console.log() // New line after progress

  // Calculate statistics
  const sorted = durations.sort((a, b) => a - b)
  const total = durations.reduce((a, b) => a + b, 0)
  const avg = total / iterations

  const p50Index = Math.floor(iterations * 0.5)
  const p95Index = Math.floor(iterations * 0.95)
  const p99Index = Math.floor(iterations * 0.99)

  return {
    queryName: name,
    iterations,
    avgDuration: avg,
    minDuration: Math.min(...durations),
    maxDuration: Math.max(...durations),
    p50: sorted[p50Index],
    p95: sorted[p95Index],
    p99: sorted[p99Index],
    totalDuration: total,
    queriesPerSecond: 1000 / avg,
  }
}

/**
 * Format benchmark results
 */
function formatResult(result: BenchmarkResult): void {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`Query: ${result.queryName}`)
  console.log(`${'='.repeat(60)}`)
  console.log(`Iterations:       ${result.iterations}`)
  console.log(`Average:          ${result.avgDuration.toFixed(2)}ms`)
  console.log(`Min:              ${result.minDuration}ms`)
  console.log(`Max:              ${result.maxDuration}ms`)
  console.log(`P50 (median):     ${result.p50}ms`)
  console.log(`P95:              ${result.p95}ms`)
  console.log(`P99:              ${result.p99}ms`)
  console.log(`Queries/second:   ${result.queriesPerSecond.toFixed(2)}`)
  console.log(`${'='.repeat(60)}`)
}

/**
 * Compare two queries
 */
function compareQueries(baseline: BenchmarkResult, optimized: BenchmarkResult): void {
  const improvement = ((baseline.avgDuration - optimized.avgDuration) / baseline.avgDuration) * 100
  const speedup = baseline.avgDuration / optimized.avgDuration

  console.log(`\n${'='.repeat(60)}`)
  console.log('COMPARISON')
  console.log(`${'='.repeat(60)}`)
  console.log(`Baseline:         ${baseline.queryName}`)
  console.log(`Optimized:        ${optimized.queryName}`)
  console.log(`Improvement:      ${improvement.toFixed(2)}%`)
  console.log(`Speedup:          ${speedup.toFixed(2)}x`)
  console.log(`${'='.repeat(60)}`)
}

/**
 * Benchmark N+1 query vs optimized
 */
async function benchmarkN1Optimization() {
  console.log('\n📊 Benchmarking N+1 Query Optimization\n')

  // Baseline: N+1 query
  const baseline = await benchmarkQuery(
    'N+1 Query (Posts with Authors)',
    async () => {
      const posts = await db.query('SELECT * FROM posts LIMIT 10')

      for (const post of posts.rows) {
        await db.query('SELECT * FROM users WHERE id = $1', [post.author_id])
      }
    },
    50, // Fewer iterations due to slowness
  )

  formatResult(baseline)

  // Optimized: JOIN query
  const optimized = await benchmarkQuery(
    'Optimized JOIN Query',
    async () => {
      await db.query(`
        SELECT p.*, u.name as author_name, u.email as author_email
        FROM posts p
        LEFT JOIN users u ON u.id = p.author_id
        LIMIT 10
      `)
    },
    100,
  )

  formatResult(optimized)
  compareQueries(baseline, optimized)
}

/**
 * Benchmark pagination methods
 */
async function benchmarkPagination() {
  console.log('\n📊 Benchmarking Pagination Methods\n')

  // Baseline: OFFSET-based
  const offset = await benchmarkQuery(
    'OFFSET Pagination (page 100)',
    async () => {
      await db.query(`
        SELECT * FROM posts
        ORDER BY published_at DESC
        LIMIT 20 OFFSET 2000
      `)
    },
    100,
  )

  formatResult(offset)

  // Optimized: Cursor-based
  const cursor = await benchmarkQuery(
    'Cursor-based Pagination',
    async () => {
      const result = await db.query(`
        SELECT * FROM posts
        WHERE published_at < (
          SELECT published_at FROM posts ORDER BY published_at DESC LIMIT 1 OFFSET 2000
        )
        ORDER BY published_at DESC
        LIMIT 20
      `)
    },
    100,
  )

  formatResult(cursor)
  compareQueries(offset, cursor)
}

/**
 * Benchmark aggregation queries
 */
async function benchmarkAggregation() {
  console.log('\n📊 Benchmarking Aggregation Queries\n')

  // Baseline: Multiple queries
  const multiple = await benchmarkQuery(
    'Multiple COUNT Queries',
    async () => {
      await db.query('SELECT COUNT(*) FROM posts')
      await db.query("SELECT COUNT(*) FROM posts WHERE status = 'published'")
      await db.query("SELECT COUNT(*) FROM posts WHERE status = 'draft'")
    },
    100,
  )

  formatResult(multiple)

  // Optimized: Single query with FILTER
  const single = await benchmarkQuery(
    'Single Query with FILTER',
    async () => {
      await db.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'published') as published,
          COUNT(*) FILTER (WHERE status = 'draft') as draft
        FROM posts
      `)
    },
    100,
  )

  formatResult(single)
  compareQueries(multiple, single)
}

/**
 * Benchmark search methods
 */
async function benchmarkSearch() {
  console.log('\n📊 Benchmarking Search Methods\n')

  // Baseline: LIKE query
  const like = await benchmarkQuery(
    'LIKE Search',
    async () => {
      await db.query(`
        SELECT * FROM posts
        WHERE title ILIKE '%optimization%' OR content ILIKE '%optimization%'
        LIMIT 20
      `)
    },
    100,
  )

  formatResult(like)

  // Optimized: Full-text search
  const fulltext = await benchmarkQuery(
    'Full-text Search',
    async () => {
      await db.query(`
        SELECT * FROM posts
        WHERE to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, ''))
          @@ plainto_tsquery('english', 'optimization')
        LIMIT 20
      `)
    },
    100,
  )

  formatResult(fulltext)
  compareQueries(like, fulltext)
}

/**
 * Benchmark index usage
 */
async function benchmarkIndexes() {
  console.log('\n📊 Benchmarking Index Usage\n')

  // Without index hint (should use index if available)
  const withIndex = await benchmarkQuery(
    'Query with Index',
    async () => {
      await db.query("SELECT * FROM posts WHERE status = 'published' LIMIT 100")
    },
    100,
  )

  formatResult(withIndex)

  // Full table scan (using OR to prevent index usage)
  const fullScan = await benchmarkQuery(
    'Query without Index (full scan)',
    async () => {
      await db.query(`
        SELECT * FROM posts
        WHERE status = 'published' OR id IS NOT NULL
        LIMIT 100
      `)
    },
    100,
  )

  formatResult(fullScan)
  compareQueries(fullScan, withIndex)
}

/**
 * Run all benchmarks
 */
async function runAllBenchmarks() {
  console.log('🚀 Starting Database Query Performance Benchmarks')
  console.log('This may take several minutes...\n')

  try {
    await benchmarkN1Optimization()
    await benchmarkPagination()
    await benchmarkAggregation()
    await benchmarkSearch()
    await benchmarkIndexes()

    console.log('\n✅ All benchmarks completed!\n')
  } catch (error) {
    console.error('\n❌ Benchmark failed:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllBenchmarks()
}

export {
  benchmarkQuery,
  benchmarkN1Optimization,
  benchmarkPagination,
  benchmarkAggregation,
  benchmarkSearch,
  benchmarkIndexes,
}
