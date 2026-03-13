#!/usr/bin/env tsx

/**
 * Real Performance Measurement
 * Measures actual node ID lookup performance against real database
 *
 * Usage:
 *   export POSTGRES_URL="postgresql://user:pass@host:port/db"
 *   pnpm test:performance
 *
 * In the public repo, this script only runs when the published Pro AI package is installed.
 */

import { access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ErrorCode } from '../lib/errors.js';
import { createLogger } from '../lib/logger.js';
import { getProjectRoot } from '../lib/paths.js';

const logger = createLogger();

const ITERATIONS = 100;
const CONCURRENT = 10;

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function measurePerformance() {
  try {
    const projectRoot = await getProjectRoot(import.meta.url);
    logger.header('Real Performance Measurement');

    const scriptsDir = dirname(new URL(import.meta.url).pathname);
    const dbClientPath = resolve(scriptsDir, '../../packages/db/dist/client/index.ts');

    if (!(await fileExists(dbClientPath))) {
      logger.error('Database client build output not found');
      logger.error(`Run \`pnpm --filter @revealui/db build\` from ${projectRoot} first.`);
      process.exit(ErrorCode.CONFIG_ERROR);
    }

    const [{ createClient }, nodeIdServiceModule] = await Promise.all([
      import(pathToFileURL(dbClientPath).href),
      import('@revealui/ai/memory/services').catch(() => null),
    ]);

    if (!nodeIdServiceModule) {
      logger.error('Performance measurement requires @revealui/ai (Pro)');
      logger.error('Install the published Pro AI package, then re-run this script.');
      process.exit(ErrorCode.CONFIG_ERROR);
    }

    const { NodeIdService } = nodeIdServiceModule;

    // Get database connection
    const PostgresUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    if (!PostgresUrl) {
      logger.error('POSTGRES_URL or DATABASE_URL must be set');
      logger.error('');
      logger.error('Usage:');
      logger.error('  export POSTGRES_URL="postgresql://user:pass@host:port/db"');
      logger.error('  pnpm exec tsx scripts/analysis/measure-performance.ts');
      process.exit(ErrorCode.CONFIG_ERROR);
    }

    logger.info('Connecting to database...');
    const db = createClient({ connectionString: PostgresUrl });
    const service = new NodeIdService(db);

    logger.info('Warming up...');
    await service.getNodeId('session', 'warmup-1');

    // Test 1: Sequential lookups (existing)
    logger.info(`\nTest 1: Sequential lookups (${ITERATIONS} iterations)`);
    const start1 = performance.now();

    for (let i = 0; i < ITERATIONS; i++) {
      await service.getNodeId('session', `session-${i}`);
    }

    const duration1 = performance.now() - start1;
    const avg1 = duration1 / ITERATIONS;

    logger.info(`  Total: ${duration1.toFixed(2)}ms`);
    logger.info(`  Average: ${avg1.toFixed(2)}ms per lookup`);
    const status1 = avg1 < 10 ? '✅ PASS' : '❌ FAIL';
    logger.info(`  Status: ${status1} (< 10ms required)`);

    // Test 2: Concurrent lookups
    logger.info(`\nTest 2: Concurrent lookups (${CONCURRENT} concurrent, ${ITERATIONS} total)`);
    const start2 = performance.now();

    const promises: Promise<unknown>[] = [];
    for (let i = 0; i < ITERATIONS; i++) {
      promises.push(service.getNodeId('session', `session-concurrent-${i}`));
      if (promises.length >= CONCURRENT) {
        await Promise.all(promises);
        promises.length = 0;
      }
    }
    await Promise.all(promises);

    const duration2 = performance.now() - start2;
    const avg2 = duration2 / ITERATIONS;

    logger.info(`  Total: ${duration2.toFixed(2)}ms`);
    logger.info(`  Average: ${avg2.toFixed(2)}ms per lookup`);
    const status2 = avg2 < 10 ? '✅ PASS' : '❌ FAIL';
    logger.info(`  Status: ${status2} (< 10ms required)`);

    // Test 3: Repeated lookups (same entity)
    logger.info(`\nTest 3: Repeated lookups (same entity, ${ITERATIONS} iterations)`);
    const entityId = 'session-repeated';
    const start3 = performance.now();

    for (let i = 0; i < ITERATIONS; i++) {
      await service.getNodeId('session', entityId);
    }

    const duration3 = performance.now() - start3;
    const avg3 = duration3 / ITERATIONS;

    logger.info(`  Total: ${duration3.toFixed(2)}ms`);
    logger.info(`  Average: ${avg3.toFixed(2)}ms per lookup`);
    const status3 = avg3 < 5 ? '✅ PASS' : '⚠️  SLOW';
    logger.info(`  Status: ${status3} (< 5ms expected for cached)`);

    // Summary
    logger.header('Summary');
    logger.info(`Sequential (new): ${avg1.toFixed(2)}ms avg`);
    logger.info(`Concurrent: ${avg2.toFixed(2)}ms avg`);
    logger.info(`Repeated (cached): ${avg3.toFixed(2)}ms avg`);
    logger.info('');

    if (avg1 < 10 && avg2 < 10 && avg3 < 5) {
      logger.success('All performance targets met!');
      process.exit(ErrorCode.SUCCESS);
    } else {
      logger.error('Some performance targets not met');
      process.exit(ErrorCode.CONFIG_ERROR);
    }
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`);
    }
    process.exit(ErrorCode.EXECUTION_ERROR);
  }
}

/**
 * Main function
 */
async function main() {
  try {
    await measurePerformance();
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(ErrorCode.EXECUTION_ERROR);
  }
}

main();
