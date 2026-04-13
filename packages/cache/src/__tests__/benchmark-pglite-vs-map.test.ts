/**
 * Benchmark: PGliteCacheStore vs InMemoryCacheStore (Map-backed)
 *
 * Measures relative performance for hot-path cache operations.
 * Results inform which adapter to use for different cache layers:
 * - Map: sub-millisecond, best for hot-path (rate limiter, circuit breaker)
 * - PGlite: SQL-powered, best for durable/queryable caches (offline, distributed)
 */

import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { InMemoryCacheStore } from '../adapters/memory.js';
import { PGliteCacheStore } from '../adapters/pglite.js';

const ITERATIONS = 1000;

let pglite: PGlite;
let pgliteStore: PGliteCacheStore;
let memoryStore: InMemoryCacheStore;

beforeAll(async () => {
  pglite = new PGlite();
  await pglite.waitReady;
  pgliteStore = new PGliteCacheStore({ db: pglite as never, closeOnDestroy: false });
  memoryStore = new InMemoryCacheStore();
  // Warm up PGlite (first query creates the table)
  await pgliteStore.set('warmup', 'value', 60);
  await pgliteStore.delete('warmup');
});

afterAll(async () => {
  await pgliteStore.close();
  await memoryStore.close();
  await pglite.close();
});

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

async function benchmarkSet(
  store: { set: (key: string, value: unknown, ttl: number, tags?: string[]) => Promise<void> },
  label: string,
): Promise<number> {
  const times: number[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const start = performance.now();
    await store.set(`bench:${i}`, { data: `value-${i}` }, 3600, ['benchmark']);
    times.push(performance.now() - start);
  }
  const med = median(times);
  console.log(
    `  ${label} set: median=${med.toFixed(3)}ms, p99=${times.sort((a, b) => a - b)[Math.floor(ITERATIONS * 0.99)].toFixed(3)}ms`,
  );
  return med;
}

async function benchmarkGet(
  store: { get: (key: string) => Promise<unknown> },
  label: string,
): Promise<number> {
  const times: number[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const start = performance.now();
    await store.get(`bench:${i}`);
    times.push(performance.now() - start);
  }
  const med = median(times);
  console.log(
    `  ${label} get: median=${med.toFixed(3)}ms, p99=${times.sort((a, b) => a - b)[Math.floor(ITERATIONS * 0.99)].toFixed(3)}ms`,
  );
  return med;
}

async function benchmarkDelete(
  store: { delete: (...keys: string[]) => Promise<number> },
  label: string,
): Promise<number> {
  const times: number[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const start = performance.now();
    await store.delete(`bench:${i}`);
    times.push(performance.now() - start);
  }
  const med = median(times);
  console.log(
    `  ${label} delete: median=${med.toFixed(3)}ms, p99=${times.sort((a, b) => a - b)[Math.floor(ITERATIONS * 0.99)].toFixed(3)}ms`,
  );
  return med;
}

describe('PGlite vs Map benchmark', () => {
  it('should benchmark set operations', async () => {
    console.log('\n--- SET benchmark (1000 iterations) ---');
    const mapTime = await benchmarkSet(memoryStore, 'Map');
    const pgliteTime = await benchmarkSet(pgliteStore, 'PGlite');
    const ratio = pgliteTime / mapTime;
    console.log(`  Ratio: PGlite is ${ratio.toFixed(1)}x slower than Map for set\n`);

    // Both should complete without error
    expect(mapTime).toBeGreaterThan(0);
    expect(pgliteTime).toBeGreaterThan(0);
  }, 30_000);

  it('should benchmark get operations', async () => {
    // Pre-populate
    for (let i = 0; i < ITERATIONS; i++) {
      await memoryStore.set(`bench:${i}`, { data: `value-${i}` }, 3600);
      await pgliteStore.set(`bench:${i}`, { data: `value-${i}` }, 3600);
    }

    console.log('\n--- GET benchmark (1000 iterations) ---');
    const mapTime = await benchmarkGet(memoryStore, 'Map');
    const pgliteTime = await benchmarkGet(pgliteStore, 'PGlite');
    const ratio = pgliteTime / mapTime;
    console.log(`  Ratio: PGlite is ${ratio.toFixed(1)}x slower than Map for get\n`);

    expect(mapTime).toBeGreaterThan(0);
    expect(pgliteTime).toBeGreaterThan(0);
  }, 30_000);

  it('should benchmark delete operations', async () => {
    console.log('\n--- DELETE benchmark (1000 iterations) ---');
    const mapTime = await benchmarkDelete(memoryStore, 'Map');
    const pgliteTime = await benchmarkDelete(pgliteStore, 'PGlite');
    const ratio = pgliteTime / mapTime;
    console.log(`  Ratio: PGlite is ${ratio.toFixed(1)}x slower than Map for delete\n`);

    expect(mapTime).toBeGreaterThan(0);
    expect(pgliteTime).toBeGreaterThan(0);
  }, 30_000);

  it('should confirm Map is faster for hot-path operations', async () => {
    // Re-populate for a clean comparison
    for (let i = 0; i < 100; i++) {
      await memoryStore.set(`final:${i}`, { data: i }, 3600);
      await pgliteStore.set(`final:${i}`, { data: i }, 3600);
    }

    const mapTimes: number[] = [];
    const pgliteTimes: number[] = [];

    for (let i = 0; i < 100; i++) {
      const start1 = performance.now();
      await memoryStore.get(`final:${i}`);
      mapTimes.push(performance.now() - start1);

      const start2 = performance.now();
      await pgliteStore.get(`final:${i}`);
      pgliteTimes.push(performance.now() - start2);
    }

    const mapMedian = median(mapTimes);
    const pgliteMedian = median(pgliteTimes);

    console.log(`\n--- Summary ---`);
    console.log(`  Map get median: ${mapMedian.toFixed(4)}ms`);
    console.log(`  PGlite get median: ${pgliteMedian.toFixed(4)}ms`);
    console.log(`  Recommendation: Use Map for hot-path caches (rate limiter, circuit breaker)`);
    console.log(
      `  Recommendation: Use PGlite for durable caches (offline, distributed invalidation)\n`,
    );

    // Map should be faster than PGlite for simple get operations
    expect(mapMedian).toBeLessThan(pgliteMedian);
  }, 30_000);
});
