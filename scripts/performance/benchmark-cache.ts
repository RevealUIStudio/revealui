/**
 * Caching Performance Benchmarking
 *
 * Benchmarks CDN caching, browser caching, service workers, and application-level caching
 */

import { performance } from 'node:perf_hooks'
import {
  CacheKeyGenerator,
  CacheStatsTracker,
  OptimisticUpdater,
  QueryDeduplicator,
} from '../../packages/core/src/caching/app-cache'
import { CDN_CACHE_PRESETS, generateCacheControl } from '../../packages/core/src/caching/cdn-config'
import { ErrorCode } from '../lib/errors.js'

interface BenchmarkResult {
  name: string
  duration: number
  opsPerSecond: number
  metadata?: Record<string, unknown>
}

/**
 * Run benchmark
 */
async function benchmark(
  name: string,
  fn: () => Promise<void> | void,
  iterations: number = 1000,
): Promise<BenchmarkResult> {
  // Warmup
  for (let i = 0; i < Math.min(100, iterations); i++) {
    await fn()
  }

  // Actual benchmark
  const start = performance.now()

  for (let i = 0; i < iterations; i++) {
    await fn()
  }

  const duration = performance.now() - start
  const opsPerSecond = (iterations / duration) * 1000

  return {
    name,
    duration,
    opsPerSecond,
  }
}

/**
 * Benchmark 1: CDN Cache Headers
 */
async function benchmarkCDNHeaders() {
  console.log('\n=== CDN Cache Headers Benchmark ===\n')

  console.log('Cache-Control Generation:')

  // Test different presets
  for (const [name, config] of Object.entries(CDN_CACHE_PRESETS)) {
    const header = generateCacheControl(config)
    console.log(`  ${name}: ${header}`)
  }

  console.log()

  // Benchmark header generation
  const result = await benchmark(
    'Generate Cache-Control header',
    () => {
      generateCacheControl(CDN_CACHE_PRESETS.static)
    },
    10000,
  )

  console.log(`Header Generation Performance:`)
  console.log(`  ${result.opsPerSecond.toFixed(0)} ops/sec`)
  console.log(`  ${(result.duration / 10000).toFixed(3)}ms per operation`)
}

/**
 * Benchmark 2: Cache Key Generation
 */
async function benchmarkCacheKeys() {
  console.log('\n=== Cache Key Generation Benchmark ===\n')

  const keyGen = new CacheKeyGenerator('app')

  // Test different key types
  console.log('Generated Cache Keys:')
  console.log(`  List: ${JSON.stringify(keyGen.list('users', { page: 1 }))}`)
  console.log(`  Detail: ${JSON.stringify(keyGen.detail('users', 123))}`)
  console.log(`  Infinite: ${JSON.stringify(keyGen.infinite('users', { page: 1 }))}`)
  console.log()

  // Benchmark key generation
  const listResult = await benchmark(
    'List key generation',
    () => {
      keyGen.list('users', { page: 1, limit: 20 })
    },
    10000,
  )

  const detailResult = await benchmark(
    'Detail key generation',
    () => {
      keyGen.detail('users', 123)
    },
    10000,
  )

  console.log('Key Generation Performance:')
  console.log(`  List: ${listResult.opsPerSecond.toFixed(0)} ops/sec`)
  console.log(`  Detail: ${detailResult.opsPerSecond.toFixed(0)} ops/sec`)
}

/**
 * Benchmark 3: Optimistic Updates
 */
async function benchmarkOptimisticUpdates() {
  console.log('\n=== Optimistic Updates Benchmark ===\n')

  // Generate test data
  const items = Array.from({ length: 100 }, (_, i) => ({
    id: i + 1,
    name: `Item ${i + 1}`,
    value: Math.random() * 100,
  }))

  // Benchmark add to list
  const addResult = await benchmark(
    'Add to list',
    () => {
      OptimisticUpdater.addToList(items, {
        id: 101,
        name: 'New Item',
        value: 50,
      })
    },
    1000,
  )

  // Benchmark update in list
  const updateResult = await benchmark(
    'Update in list',
    () => {
      OptimisticUpdater.updateInList(items, 50, { value: 75 })
    },
    1000,
  )

  // Benchmark remove from list
  const removeResult = await benchmark(
    'Remove from list',
    () => {
      OptimisticUpdater.removeFromList(items, 50)
    },
    1000,
  )

  console.log('Optimistic Update Performance:')
  console.log(`  Add: ${addResult.opsPerSecond.toFixed(0)} ops/sec`)
  console.log(`  Update: ${updateResult.opsPerSecond.toFixed(0)} ops/sec`)
  console.log(`  Remove: ${removeResult.opsPerSecond.toFixed(0)} ops/sec`)
}

/**
 * Benchmark 4: Cache Hit Rate Simulation
 */
async function benchmarkCacheHitRate() {
  console.log('\n=== Cache Hit Rate Simulation ===\n')

  const _cache = new Map<string, unknown>()
  const tracker = new CacheStatsTracker()

  // Simulate cache access pattern (80/20 rule)
  const accessPattern = Array.from({ length: 1000 }, () => {
    // 80% of requests go to top 20% of keys
    return Math.random() < 0.8 ? Math.floor(Math.random() * 20) : Math.floor(Math.random() * 100)
  })

  // Simulate cache with TTL
  const cacheTTL = 60000 // 1 minute
  const cacheEntries = new Map<number, { data: unknown; expiry: number }>()

  for (const key of accessPattern) {
    const now = Date.now()
    const entry = cacheEntries.get(key)

    if (entry && entry.expiry > now) {
      // Cache hit
      tracker.recordHit()
    } else {
      // Cache miss
      tracker.recordMiss()

      // Simulate fetch and cache
      cacheEntries.set(key, {
        data: { id: key, value: Math.random() },
        expiry: now + cacheTTL,
      })
    }
  }

  const stats = tracker.getStats()

  console.log('Cache Statistics:')
  console.log(`  Total Queries: ${stats.totalQueries}`)
  console.log(`  Cache Hits: ${stats.hits}`)
  console.log(`  Cache Misses: ${stats.misses}`)
  console.log(`  Hit Rate: ${stats.hitRate.toFixed(1)}%`)
  console.log()

  // Performance impact
  const avgCacheHitTime = 2 // ms
  const avgCacheMissTime = 150 // ms

  const totalTimeWithCache = stats.hits * avgCacheHitTime + stats.misses * avgCacheMissTime
  const totalTimeWithoutCache = stats.totalQueries * avgCacheMissTime

  const timeSavings = totalTimeWithoutCache - totalTimeWithCache
  const percentSavings = (timeSavings / totalTimeWithoutCache) * 100

  console.log('Performance Impact:')
  console.log(`  With cache: ${totalTimeWithCache.toFixed(0)}ms`)
  console.log(`  Without cache: ${totalTimeWithoutCache.toFixed(0)}ms`)
  console.log(`  Time savings: ${timeSavings.toFixed(0)}ms (${percentSavings.toFixed(1)}%)`)
}

/**
 * Benchmark 5: Query Deduplication
 */
async function benchmarkQueryDeduplication() {
  console.log('\n=== Query Deduplication Benchmark ===\n')

  const deduplicator = new QueryDeduplicator()

  // Simulate slow query
  const slowQuery = () =>
    new Promise((resolve) => setTimeout(() => resolve({ data: Math.random() }), 50))

  // Without deduplication
  const withoutDedupeStart = performance.now()
  await Promise.all(Array.from({ length: 10 }, () => slowQuery()))
  const withoutDedupeDuration = performance.now() - withoutDedupeStart

  // With deduplication
  const withDedupeStart = performance.now()
  await Promise.all(Array.from({ length: 10 }, () => deduplicator.dedupe('query-1', slowQuery)))
  const withDedupeDuration = performance.now() - withDedupeStart

  console.log('Query Deduplication Results:')
  console.log(`  Without dedupe (10 queries): ${withoutDedupeDuration.toFixed(0)}ms`)
  console.log(`  With dedupe (10 queries): ${withDedupeDuration.toFixed(0)}ms`)
  console.log(`  Time savings: ${(withoutDedupeDuration - withDedupeDuration).toFixed(0)}ms`)
  console.log(`  Speedup: ${(withoutDedupeDuration / withDedupeDuration).toFixed(1)}x`)
}

/**
 * Benchmark 6: CDN vs Origin Performance
 */
async function benchmarkCDNPerformance() {
  console.log('\n=== CDN vs Origin Performance ===\n')

  // Simulated latencies
  const latencies = {
    origin: {
      ttfb: 200, // Time to first byte
      download: 100, // Download time for 100KB
    },
    cdn: {
      ttfb: 20, // Much faster TTFB
      download: 30, // Faster download (closer to user)
    },
  }

  const requests = 1000

  // Calculate total time
  const originTime = requests * (latencies.origin.ttfb + latencies.origin.download)
  const cdnTime = requests * (latencies.cdn.ttfb + latencies.cdn.download)

  const timeSavings = originTime - cdnTime
  const percentSavings = (timeSavings / originTime) * 100

  console.log('Latency Comparison (per request):')
  console.log(`  Origin: ${latencies.origin.ttfb + latencies.origin.download}ms`)
  console.log(`    TTFB: ${latencies.origin.ttfb}ms`)
  console.log(`    Download: ${latencies.origin.download}ms`)
  console.log()
  console.log(`  CDN: ${latencies.cdn.ttfb + latencies.cdn.download}ms`)
  console.log(`    TTFB: ${latencies.cdn.ttfb}ms`)
  console.log(`    Download: ${latencies.cdn.download}ms`)
  console.log()

  console.log(`Performance Impact (${requests} requests):`)
  console.log(`  Origin: ${(originTime / 1000).toFixed(1)}s`)
  console.log(`  CDN: ${(cdnTime / 1000).toFixed(1)}s`)
  console.log(`  Time savings: ${(timeSavings / 1000).toFixed(1)}s (${percentSavings.toFixed(1)}%)`)
  console.log(`  Speedup: ${(originTime / cdnTime).toFixed(1)}x`)
}

/**
 * Benchmark 7: ISR vs SSR Performance
 */
async function benchmarkISRPerformance() {
  console.log('\n=== ISR vs SSR Performance ===\n')

  const pageViews = 10000
  const revalidateInterval = 60 // 1 minute

  // SSR: Generate on every request
  const ssrGenerations = pageViews
  const ssrGenerationTime = 150 // ms per generation
  const ssrTotalTime = ssrGenerations * ssrGenerationTime

  // ISR: Generate once per revalidate interval
  const isrGenerations = Math.ceil(pageViews / (revalidateInterval / 0.1)) // Assume 10 requests/sec
  const isrGenerationTime = 150 // ms per generation
  const isrServeTime = 20 // ms to serve cached page
  const isrTotalTime =
    isrGenerations * isrGenerationTime + (pageViews - isrGenerations) * isrServeTime

  const timeSavings = ssrTotalTime - isrTotalTime
  const percentSavings = (timeSavings / ssrTotalTime) * 100

  console.log(`Rendering Strategy Comparison (${pageViews} page views):`)
  console.log()

  console.log('SSR (Server-Side Rendering):')
  console.log(`  Generations: ${ssrGenerations}`)
  console.log(`  Time per generation: ${ssrGenerationTime}ms`)
  console.log(`  Total time: ${(ssrTotalTime / 1000).toFixed(1)}s`)
  console.log()

  console.log('ISR (Incremental Static Regeneration):')
  console.log(`  Generations: ${isrGenerations}`)
  console.log(`  Cached serves: ${pageViews - isrGenerations}`)
  console.log(`  Time per generation: ${isrGenerationTime}ms`)
  console.log(`  Time per cached serve: ${isrServeTime}ms`)
  console.log(`  Total time: ${(isrTotalTime / 1000).toFixed(1)}s`)
  console.log()

  console.log('Performance Impact:')
  console.log(`  Time savings: ${(timeSavings / 1000).toFixed(1)}s (${percentSavings.toFixed(1)}%)`)
  console.log(`  Speedup: ${(ssrTotalTime / isrTotalTime).toFixed(1)}x`)
  console.log(
    `  Server load reduction: ${((1 - isrGenerations / ssrGenerations) * 100).toFixed(1)}%`,
  )
}

/**
 * Benchmark 8: Cache Storage Performance
 */
async function benchmarkCacheStorage() {
  console.log('\n=== Cache Storage Performance ===\n')

  const testData = {
    id: 1,
    name: 'Test Item',
    value: Math.random(),
    nested: {
      a: 1,
      b: 2,
      c: [1, 2, 3, 4, 5],
    },
  }

  // Benchmark in-memory
  const memoryResult = await benchmark(
    'In-memory cache',
    () => {
      const cache = new Map()
      cache.set('key', testData)
      cache.get('key')
    },
    10000,
  )

  // Benchmark localStorage (simulated)
  const localStorageResult = await benchmark(
    'localStorage (simulated)',
    () => {
      const serialized = JSON.stringify(testData)
      JSON.parse(serialized)
    },
    10000,
  )

  console.log('Storage Performance:')
  console.log(`  In-memory: ${memoryResult.opsPerSecond.toFixed(0)} ops/sec`)
  console.log(`  localStorage: ${localStorageResult.opsPerSecond.toFixed(0)} ops/sec`)
  console.log(
    `  Speedup: ${(memoryResult.opsPerSecond / localStorageResult.opsPerSecond).toFixed(1)}x`,
  )
}

/**
 * Run all benchmarks
 */
async function runAllBenchmarks() {
  console.log('Caching Performance Benchmarks')
  console.log(`=${'='.repeat(49)}`)

  await benchmarkCDNHeaders()
  await benchmarkCacheKeys()
  await benchmarkOptimisticUpdates()
  await benchmarkCacheHitRate()
  await benchmarkQueryDeduplication()
  await benchmarkCDNPerformance()
  await benchmarkISRPerformance()
  await benchmarkCacheStorage()

  console.log(`\n${'='.repeat(50)}`)
  console.log('All benchmarks complete!')
}

/**
 * CLI
 */
const args = process.argv.slice(2)
const benchmarkName = args[0]

async function main() {
  try {
    if (!benchmarkName) {
      await runAllBenchmarks()
    } else {
      switch (benchmarkName) {
        case 'cdn':
          await benchmarkCDNHeaders()
          break
        case 'keys':
          await benchmarkCacheKeys()
          break
        case 'optimistic':
          await benchmarkOptimisticUpdates()
          break
        case 'hit-rate':
          await benchmarkCacheHitRate()
          break
        case 'dedupe':
          await benchmarkQueryDeduplication()
          break
        case 'cdn-perf':
          await benchmarkCDNPerformance()
          break
        case 'isr':
          await benchmarkISRPerformance()
          break
        case 'storage':
          await benchmarkCacheStorage()
          break
        default:
          console.error(`Unknown benchmark: ${benchmarkName}`)
          console.log(
            'Available benchmarks: cdn, keys, optimistic, hit-rate, dedupe, cdn-perf, isr, storage',
          )
          process.exit(ErrorCode.EXECUTION_ERROR)
      }
    }
  } catch (error) {
    console.error('Benchmark failed:', error)
    process.exit(ErrorCode.EXECUTION_ERROR)
  }
}

main()
