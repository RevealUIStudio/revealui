#!/usr/bin/env tsx

/**
 * Performance Baseline Script
 *
 * Runs all performance tests and records baseline metrics
 *
 * @dependencies
 * - scripts/lib/errors.ts - ErrorCode enum for exit codes
 * - node:child_process - Command execution (execSync)
 * - node:fs - File system operations (existsSync, readFileSync, writeFileSync)
 * - node:path - Path manipulation utilities (dirname, resolve)
 * - node:url - URL utilities (fileURLToPath)
 *
 * @requires
 * - Environment: BASE_URL (optional, defaults to http://localhost:4000)
 */

console.log('🚀 Performance baseline script starting...');

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ErrorCode } from '@revealui/scripts/errors.js';

// Temporarily use console.log instead of shared logger to debug
const logger = {
  info: (msg: string) => console.log(`ℹ️  ${msg}`),
  success: (msg: string) => console.log(`✅ ${msg}`),
  error: (msg: string) => console.error(`❌ ${msg}`),
  warn: (msg: string) => console.warn(`⚠️  ${msg}`),
};

/**
 * Check if the API is healthy and ready for testing
 */
async function checkApiHealth(): Promise<boolean> {
  try {
    const baseUrl = process.env.BASE_URL || 'http://localhost:4000';
    const healthUrl = `${baseUrl}/api/health`;

    logger.info(`Checking API health at ${healthUrl}...`);

    const response = await fetch(healthUrl, {
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      logger.success('API is healthy and ready for testing');
      return true;
    } else {
      logger.error(`API health check failed: ${response.status} ${response.statusText}`);
      return false;
    }
  } catch (error) {
    logger.error(
      `API health check failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return false;
  }
}

interface PerformanceMetrics {
  test: string;
  timestamp: string;
  metrics: {
    p50: number;
    p95: number;
    p99: number;
    avg: number;
    min: number;
    max: number;
    requestsPerSecond: number;
    errorRate: number;
  };
}

interface EndpointConfig {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
  duration?: number;
  connections?: number;
  pipelining?: number;
  bailout?: number;
}

async function runAutocannonTest(
  endpointName: string,
  endpointConfig: EndpointConfig,
): Promise<PerformanceMetrics | null> {
  logger.info(`Running ${endpointName}...`);

  try {
    // Build autocannon command
    const baseUrl = process.env.BASE_URL || 'http://localhost:4000';
    const url = endpointConfig.url.replace('http://localhost:4000', baseUrl);

    // Validate the URL to prevent command injection via endpoint config
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        logger.error(`Invalid URL protocol for ${endpointName}: ${parsed.protocol}`);
        return null;
      }
    } catch {
      logger.error(`Invalid URL for ${endpointName}: ${url}`);
      return null;
    }

    const args = ['dlx', 'autocannon', '--json'];

    // Add method if not GET
    if (endpointConfig.method && endpointConfig.method !== 'GET') {
      args.push('--method', String(endpointConfig.method));
    }

    // Add headers
    if (endpointConfig.headers) {
      Object.entries(endpointConfig.headers).forEach(([key, value]) => {
        const processedValue = value.replace(
          '{TEST_TOKEN}',
          process.env.TEST_TOKEN || 'test-token',
        );
        args.push('--header', `${key}: ${processedValue}`);
      });
    }

    // Add body for POST requests
    if (endpointConfig.body) {
      args.push('--body', JSON.stringify(endpointConfig.body));
    }

    // Add test parameters
    args.push('--duration', String(endpointConfig.duration || 30));
    args.push('--connections', String(endpointConfig.connections || 10));
    args.push('--pipelining', String(endpointConfig.pipelining || 1));
    args.push('--bailout', String(endpointConfig.bailout || 5));

    // Add URL
    args.push(url);

    // Run autocannon
    const output = execFileSync('pnpm', args, {
      encoding: 'utf-8',
      stdio: 'pipe',
    });

    // Parse autocannon JSON output
    const results = JSON.parse(output);

    // Extract metrics from autocannon format
    const result: PerformanceMetrics = {
      test: endpointName,
      timestamp: new Date().toISOString(),
      metrics: {
        p50: results.latency.p50 || 0,
        p95: results.latency.p95 || 0,
        p99: results.latency.p99 || 0,
        avg: results.latency.average || 0,
        min: results.latency.min || 0,
        max: results.latency.max || 0,
        requestsPerSecond: results.requests.average || 0,
        errorRate: (results.errors || 0) / (results.requests.total || 1), // Calculate error rate
      },
    };

    logger.success(
      `Completed ${endpointName} - p95: ${result.metrics.p95.toFixed(0)}ms, RPS: ${result.metrics.requestsPerSecond.toFixed(1)}, errors: ${(result.metrics.errorRate * 100).toFixed(2)}%`,
    );
    return result;
  } catch (error) {
    logger.error(
      `Test failed for ${endpointName}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

async function main() {
  logger.info('🚀 Performance baseline script starting...');

  // Check API health before running tests
  const isHealthy = await checkApiHealth();
  if (!isHealthy) {
    logger.error('API is not healthy. Please start the CMS server and ensure it is accessible.');
    logger.info('Run: pnpm start:cms');
    process.exit(ErrorCode.EXECUTION_ERROR);
  }

  const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const testsDir = resolve(projectRoot, 'packages/test/load-tests');
  const baselineFile = resolve(projectRoot, 'packages/test/load-tests/baseline.json');
  const endpointsFile = resolve(testsDir, 'endpoints.json');

  // Load endpoints configuration
  let endpointsConfig: Record<string, EndpointConfig>;
  try {
    endpointsConfig = JSON.parse(readFileSync(endpointsFile, 'utf-8'));
  } catch {
    logger.error(`Endpoints configuration not found: ${endpointsFile}`);
    logger.info('Please ensure endpoints.json exists in packages/test/load-tests/');
    process.exit(ErrorCode.EXECUTION_ERROR);
  }
  logger.info(`Loaded ${Object.keys(endpointsConfig).length} endpoint configurations`);

  const results: PerformanceMetrics[] = [];

  // Run tests for each endpoint
  for (const [endpointName, config] of Object.entries(endpointsConfig)) {
    const result = await runAutocannonTest(endpointName, config);
    if (result) {
      results.push(result);
    }
  }

  if (results.length === 0) {
    logger.error('No tests completed successfully');
    process.exit(ErrorCode.EXECUTION_ERROR);
  }

  // Save baseline
  const baseline = {
    timestamp: new Date().toISOString(),
    results,
  };

  writeFileSync(baselineFile, JSON.stringify(baseline, null, 2));

  // Also save current results for regression testing
  const currentResultsFile = resolve(projectRoot, 'packages/test/load-tests/current-results.json');
  writeFileSync(currentResultsFile, JSON.stringify(baseline, null, 2));

  logger.success(`Baseline saved to ${baselineFile} with ${results.length} test results`);
  logger.success(`Current results saved to ${currentResultsFile}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    logger.error(`Failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(ErrorCode.EXECUTION_ERROR);
  });
}
