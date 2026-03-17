/**
 * API Performance Benchmarking
 *
 * Benchmarks API optimization techniques including:
 * - Response compression (gzip, brotli)
 * - HTTP caching
 * - Payload optimization
 * - Rate limiting
 */

import { performance } from 'node:perf_hooks';
import { ErrorCode } from '@revealui/scripts/errors.js';
import type { NextRequest } from 'next/server';
import { compressBody, getCompressionRatio } from '../../packages/core/src/api/compression';
import {
  formatPayloadSize,
  getPayloadSize,
  optimizePayload,
  paginateArray,
  selectFields,
} from '../../packages/core/src/api/payload-optimization';
import {
  checkRateLimit,
  checkSlidingWindowRateLimit,
  checkTokenBucketRateLimit,
  cleanupRateLimits,
  RATE_LIMIT_PRESETS,
} from '../../packages/core/src/api/rate-limit';
import {
  cacheAPIResponse,
  clearCache,
  getCacheStats,
} from '../../packages/core/src/api/response-cache';

interface BenchmarkResult {
  name: string;
  operations: number;
  duration: number;
  opsPerSecond: number;
  avgTime: number;
  metadata?: Record<string, unknown>;
}

/**
 * Run benchmark function
 */
async function benchmark(
  name: string,
  fn: () => Promise<void> | void,
  iterations: number = 1000,
): Promise<BenchmarkResult> {
  // Warmup
  for (let i = 0; i < Math.min(100, iterations); i++) {
    await fn();
  }

  // Actual benchmark
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    await fn();
  }

  const duration = performance.now() - start;
  const opsPerSecond = (iterations / duration) * 1000;
  const avgTime = duration / iterations;

  return {
    name,
    operations: iterations,
    duration,
    opsPerSecond,
    avgTime,
  };
}

/**
 * Generate sample data
 */
function generateSampleUser(id: number) {
  return {
    id,
    name: `User ${id}`,
    email: `user${id}@example.com`,
    password: 'hashed_password_here',
    bio: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: new Date(),
    preferences: {
      theme: 'dark',
      notifications: true,
      language: 'en',
    },
    stats: {
      posts: Math.floor(Math.random() * 100),
      followers: Math.floor(Math.random() * 1000),
      following: Math.floor(Math.random() * 500),
    },
  };
}

function generateSampleUsers(count: number) {
  return Array.from({ length: count }, (_, i) => generateSampleUser(i + 1));
}

/**
 * Benchmark 1: Compression Performance
 */
async function benchmarkCompression() {
  console.log('\n=== Compression Benchmark ===\n');

  const users = generateSampleUsers(100);
  const json = JSON.stringify(users);
  const originalSize = new Blob([json]).size;

  console.log(`Original size: ${formatPayloadSize(originalSize)}`);

  // Gzip compression levels
  for (const level of [1, 6, 9]) {
    const start = performance.now();
    const compressed = await compressBody(json, 'gzip', level);
    const duration = performance.now() - start;

    const ratio = getCompressionRatio(originalSize, compressed.length);

    console.log(`Gzip level ${level}:`);
    console.log(`  Size: ${formatPayloadSize(compressed.length)}`);
    console.log(`  Ratio: ${ratio.toFixed(1)}%`);
    console.log(`  Time: ${duration.toFixed(2)}ms`);
  }

  // Brotli compression
  const start = performance.now();
  const compressed = await compressBody(json, 'br', 6);
  const duration = performance.now() - start;
  const ratio = getCompressionRatio(originalSize, compressed.length);

  console.log(`Brotli level 6:`);
  console.log(`  Size: ${formatPayloadSize(compressed.length)}`);
  console.log(`  Ratio: ${ratio.toFixed(1)}%`);
  console.log(`  Time: ${duration.toFixed(2)}ms`);

  // Benchmark compression speed
  const gzipResult = await benchmark(
    'Gzip compression (level 6)',
    async () => {
      await compressBody(json, 'gzip', 6);
    },
    100,
  );

  const brotliResult = await benchmark(
    'Brotli compression (level 6)',
    async () => {
      await compressBody(json, 'br', 6);
    },
    100,
  );

  console.log(`\nGzip:   ${gzipResult.avgTime.toFixed(2)}ms avg`);
  console.log(`Brotli: ${brotliResult.avgTime.toFixed(2)}ms avg`);
}

/**
 * Benchmark 2: Caching Performance
 */
async function benchmarkCaching() {
  console.log('\n=== Caching Benchmark ===\n');

  clearCache();

  let cacheHits = 0;
  let cacheMisses = 0;

  // Simulate API calls
  const apiCall = async (id: number) => {
    const result = await cacheAPIResponse(
      `user:${id}`,
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 10)); // Simulate DB query
        return generateSampleUser(id);
      },
      { ttl: 60 },
    );

    if (result.cached) {
      cacheHits++;
    } else {
      cacheMisses++;
    }

    return result.data;
  };

  // Benchmark cache miss (first call)
  const missResult = await benchmark(
    'Cache MISS',
    async () => {
      clearCache();
      await apiCall(1);
    },
    100,
  );

  // Benchmark cache hit
  clearCache();
  await apiCall(1); // Prime cache

  const hitResult = await benchmark(
    'Cache HIT',
    async () => {
      await apiCall(1);
    },
    1000,
  );

  console.log(`Cache MISS: ${missResult.avgTime.toFixed(2)}ms avg`);
  console.log(`Cache HIT:  ${hitResult.avgTime.toFixed(2)}ms avg`);
  console.log(`Speedup:    ${(missResult.avgTime / hitResult.avgTime).toFixed(1)}x`);

  // Simulate realistic usage pattern
  clearCache();
  cacheHits = 0;
  cacheMisses = 0;

  for (let i = 0; i < 1000; i++) {
    // 80% of requests are for top 20% of users (Pareto distribution)
    const id =
      Math.random() < 0.8
        ? Math.floor(Math.random() * 20) + 1
        : Math.floor(Math.random() * 100) + 1;
    await apiCall(id);
  }

  const hitRate = (cacheHits / (cacheHits + cacheMisses)) * 100;
  const stats = getCacheStats();

  console.log(`\nRealistic Usage (1000 requests):`);
  console.log(`  Cache hits: ${cacheHits}`);
  console.log(`  Cache misses: ${cacheMisses}`);
  console.log(`  Hit rate: ${hitRate.toFixed(1)}%`);
  console.log(`  Unique entries: ${stats.totalEntries}`);
}

/**
 * Benchmark 3: Payload Optimization
 */
async function benchmarkPayloadOptimization() {
  console.log('\n=== Payload Optimization Benchmark ===\n');

  const users = generateSampleUsers(100);

  // Original payload
  const originalSize = getPayloadSize(users);
  console.log(`Original payload: ${formatPayloadSize(originalSize)}`);

  // Field selection
  const selectedFields = users.map((user) =>
    selectFields(user, {
      include: ['id', 'name', 'email'],
    }),
  );
  const selectedSize = getPayloadSize(selectedFields);
  const selectedSavings = ((originalSize - selectedSize) / originalSize) * 100;

  console.log(`\nField selection (id, name, email):`);
  console.log(`  Size: ${formatPayloadSize(selectedSize)}`);
  console.log(`  Savings: ${selectedSavings.toFixed(1)}%`);

  // Optimized payload
  const optimized = optimizePayload(users, {
    include: ['id', 'name', 'email', 'stats'],
    removeEmpty: true,
    transformDates: true,
    sanitize: true,
  });

  console.log(`\nFull optimization:`);
  console.log(`  Original: ${formatPayloadSize(optimized.originalSize)}`);
  console.log(`  Optimized: ${formatPayloadSize(optimized.optimizedSize)}`);
  console.log(`  Savings: ${optimized.savingsPercent.toFixed(1)}%`);

  // Benchmark field selection speed
  const selectionResult = await benchmark(
    'Field selection',
    () => {
      selectFields(users[0], { include: ['id', 'name', 'email'] });
    },
    10000,
  );

  console.log(`\nField selection: ${selectionResult.avgTime.toFixed(3)}ms avg`);

  // Pagination benchmark
  const paginationResult = await benchmark(
    'Pagination',
    () => {
      paginateArray(users, { page: 1, limit: 20 });
    },
    10000,
  );

  console.log(`Pagination: ${paginationResult.avgTime.toFixed(3)}ms avg`);
}

/**
 * Benchmark 4: Rate Limiting
 */
async function benchmarkRateLimiting() {
  console.log('\n=== Rate Limiting Benchmark ===\n');

  cleanupRateLimits();

  // Mock request
  const createMockRequest = (ip: string) => {
    return {
      method: 'GET',
      url: 'http://localhost:3000/api/test',
      headers: new Map([['x-forwarded-for', ip]]),
      ip,
    } as unknown as NextRequest;
  };

  // Benchmark fixed window rate limiting
  const fixedWindowResult = await benchmark(
    'Fixed window rate limit',
    () => {
      const request = createMockRequest('192.168.1.1');
      checkRateLimit(request, RATE_LIMIT_PRESETS.standard);
    },
    10000,
  );

  console.log(`Fixed window: ${fixedWindowResult.avgTime.toFixed(3)}ms avg`);

  // Benchmark sliding window rate limiting
  cleanupRateLimits();

  const slidingWindowResult = await benchmark(
    'Sliding window rate limit',
    () => {
      const request = createMockRequest('192.168.1.2');
      checkSlidingWindowRateLimit(request, RATE_LIMIT_PRESETS.standard);
    },
    10000,
  );

  console.log(`Sliding window: ${slidingWindowResult.avgTime.toFixed(3)}ms avg`);

  // Benchmark token bucket rate limiting
  cleanupRateLimits();

  const tokenBucketResult = await benchmark(
    'Token bucket rate limit',
    () => {
      const request = createMockRequest('192.168.1.3');
      checkTokenBucketRateLimit(request, {
        ...RATE_LIMIT_PRESETS.standard,
        refillRate: 10,
      });
    },
    10000,
  );

  console.log(`Token bucket: ${tokenBucketResult.avgTime.toFixed(3)}ms avg`);

  // Test rate limit accuracy
  cleanupRateLimits();
  const limit = 10;
  let allowed = 0;
  let denied = 0;

  for (let i = 0; i < 20; i++) {
    const request = createMockRequest('192.168.1.4');
    const result = checkRateLimit(request, {
      windowMs: 60000,
      maxRequests: limit,
    });

    if (result.allowed) {
      allowed++;
    } else {
      denied++;
    }
  }

  console.log(`\nRate limit accuracy (limit: ${limit}, requests: 20):`);
  console.log(`  Allowed: ${allowed}`);
  console.log(`  Denied: ${denied}`);
  console.log(`  Accuracy: ${allowed === limit ? 'PASS' : 'FAIL'}`);
}

/**
 * Benchmark 5: Combined Optimizations
 */
async function benchmarkCombined() {
  console.log('\n=== Combined Optimizations Benchmark ===\n');

  const users = generateSampleUsers(100);

  // Unoptimized
  const unoptimizedStart = performance.now();
  const unoptimizedJson = JSON.stringify(users);
  const unoptimizedSize = new Blob([unoptimizedJson]).size;
  const unoptimizedDuration = performance.now() - unoptimizedStart;

  console.log('Unoptimized:');
  console.log(`  Size: ${formatPayloadSize(unoptimizedSize)}`);
  console.log(`  Time: ${unoptimizedDuration.toFixed(2)}ms`);

  // Optimized (field selection + compression)
  const optimizedStart = performance.now();

  const optimized = users.map((user) =>
    selectFields(user, {
      include: ['id', 'name', 'email', 'stats'],
    }),
  );

  const optimizedJson = JSON.stringify(optimized);
  const compressed = await compressBody(optimizedJson, 'gzip', 6);

  const optimizedDuration = performance.now() - optimizedStart;
  const finalSize = compressed.length;
  const totalSavings = ((unoptimizedSize - finalSize) / unoptimizedSize) * 100;

  console.log('\nOptimized (field selection + gzip):');
  console.log(`  Size: ${formatPayloadSize(finalSize)}`);
  console.log(`  Time: ${optimizedDuration.toFixed(2)}ms`);
  console.log(`  Savings: ${totalSavings.toFixed(1)}%`);

  // Calculate transfer time savings (assuming 10 Mbps connection)
  const bytesPerMs = (10 * 1024 * 1024) / 8 / 1000; // 10 Mbps in bytes/ms
  const unoptimizedTransfer = unoptimizedSize / bytesPerMs;
  const optimizedTransfer = finalSize / bytesPerMs;

  console.log(`\nTransfer time (10 Mbps):`);
  console.log(`  Unoptimized: ${unoptimizedTransfer.toFixed(2)}ms`);
  console.log(`  Optimized: ${optimizedTransfer.toFixed(2)}ms`);
  console.log(`  Savings: ${(unoptimizedTransfer - optimizedTransfer).toFixed(2)}ms`);

  // Total latency (processing + transfer)
  const totalUnoptimized = unoptimizedDuration + unoptimizedTransfer;
  const totalOptimized = optimizedDuration + optimizedTransfer;

  console.log(`\nTotal latency (processing + transfer):`);
  console.log(`  Unoptimized: ${totalUnoptimized.toFixed(2)}ms`);
  console.log(`  Optimized: ${totalOptimized.toFixed(2)}ms`);
  console.log(
    `  Improvement: ${(((totalUnoptimized - totalOptimized) / totalUnoptimized) * 100).toFixed(1)}%`,
  );
}

/**
 * Run all benchmarks
 */
async function runAllBenchmarks() {
  console.log('API Performance Benchmarks');
  console.log('='.repeat(50));

  await benchmarkCompression();
  await benchmarkCaching();
  await benchmarkPayloadOptimization();
  await benchmarkRateLimiting();
  await benchmarkCombined();

  console.log(`\n${'='.repeat(50)}`);
  console.log('All benchmarks complete!');
}

/**
 * CLI
 */
const args = process.argv.slice(2);
const benchmarkName = args[0];

async function main() {
  try {
    if (!benchmarkName) {
      await runAllBenchmarks();
    } else {
      switch (benchmarkName) {
        case 'compression':
          await benchmarkCompression();
          break;
        case 'caching':
          await benchmarkCaching();
          break;
        case 'payload':
          await benchmarkPayloadOptimization();
          break;
        case 'rate-limit':
          await benchmarkRateLimiting();
          break;
        case 'combined':
          await benchmarkCombined();
          break;
        default:
          console.error(`Unknown benchmark: ${benchmarkName}`);
          console.log('Available benchmarks: compression, caching, payload, rate-limit, combined');
          process.exit(ErrorCode.INVALID_INPUT);
      }
    }
  } catch (error) {
    console.error('Benchmark failed:', error);
    process.exit(ErrorCode.EXECUTION_ERROR);
  }
}

main();
