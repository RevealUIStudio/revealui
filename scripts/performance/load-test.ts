/**
 * HTTP Load Test  -  OV-4
 *
 * Baseline load test for RevealUI API endpoints.
 * Uses autocannon for HTTP load generation.
 *
 * Usage:
 *   npx tsx scripts/performance/load-test.ts [target]
 *
 * Targets:
 *   health     -  API health endpoint (1000 req/s sanity check)
 *   pricing    -  Public pricing endpoint (cached)
 *   all        -  Run all targets sequentially
 *
 * Environment:
 *   API_URL    -  API base URL (default: http://localhost:3004)
 *   DURATION   -  Test duration in seconds (default: 10)
 */

import autocannon from 'autocannon';

const API_URL = process.env.API_URL || 'http://localhost:3004';
const DURATION = Number.parseInt(process.env.DURATION || '10', 10);

interface LoadTestResult {
  target: string;
  url: string;
  duration: number;
  connections: number;
  pipelining: number;
  requests: {
    total: number;
    average: number;
    p99: number;
    max: number;
  };
  latency: {
    average: number;
    p50: number;
    p99: number;
    max: number;
  };
  throughput: {
    average: number;
    total: number;
  };
  errors: number;
  timeouts: number;
  nonSuccessful: number;
  status: 'PASS' | 'WARN' | 'FAIL';
}

async function runLoadTest(
  name: string,
  url: string,
  options: {
    connections?: number;
    pipelining?: number;
    duration?: number;
    method?: 'GET' | 'POST';
    headers?: Record<string, string>;
    body?: string;
    expectRps?: number;
    expectP99?: number;
  } = {},
): Promise<LoadTestResult> {
  const connections = options.connections ?? 10;
  const pipelining = options.pipelining ?? 1;
  const duration = options.duration ?? DURATION;

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${name}`);
  console.log(`  ${url}`);
  console.log(`  ${connections} connections, ${pipelining} pipelining, ${duration}s`);
  console.log(`${'─'.repeat(60)}`);

  const result = await autocannon({
    url,
    connections,
    pipelining,
    duration,
    method: options.method ?? 'GET',
    headers: options.headers,
    body: options.body,
  });

  const nonSuccessful = Object.entries(result.statusCodeStats || {})
    .filter(([code]) => !code.startsWith('2'))
    .reduce((sum, [, stats]) => sum + (stats as { count: number }).count, 0);

  let status: 'PASS' | 'WARN' | 'FAIL' = 'PASS';

  if (result.errors > 0 || result.timeouts > 0) {
    status = 'FAIL';
  } else if (options.expectRps && result.requests.average < options.expectRps) {
    status = 'WARN';
  } else if (options.expectP99 && result.latency.p99 > options.expectP99) {
    status = 'WARN';
  }

  const testResult: LoadTestResult = {
    target: name,
    url,
    duration,
    connections,
    pipelining,
    requests: {
      total: result.requests.total,
      average: result.requests.average,
      p99: result.requests.p99,
      max: result.requests.max,
    },
    latency: {
      average: result.latency.average,
      p50: result.latency.p50,
      p99: result.latency.p99,
      max: result.latency.max,
    },
    throughput: {
      average: result.throughput.average,
      total: result.throughput.total,
    },
    errors: result.errors,
    timeouts: result.timeouts,
    nonSuccessful,
    status,
  };

  // Print results
  console.log(
    `\n  Requests:    ${result.requests.total} total, ${result.requests.average.toFixed(0)}/s avg`,
  );
  console.log(
    `  Latency:     p50=${result.latency.p50}ms, p99=${result.latency.p99}ms, max=${result.latency.max}ms`,
  );
  console.log(`  Throughput:  ${(result.throughput.average / 1024).toFixed(1)} KB/s`);
  console.log(
    `  Errors:      ${result.errors} errors, ${result.timeouts} timeouts, ${nonSuccessful} non-2xx`,
  );
  console.log(
    `  Status:      ${status === 'PASS' ? '✓ PASS' : status === 'WARN' ? '⚠ WARN' : '✗ FAIL'}`,
  );

  return testResult;
}

// ─── Test Targets ───────────────────────────────────────────────────────────

async function testHealth(): Promise<LoadTestResult> {
  return runLoadTest('OV-4.1: API Health (sanity check)', `${API_URL}/health`, {
    connections: 50,
    pipelining: 10,
    expectRps: 1000,
    expectP99: 100,
  });
}

async function testPricing(): Promise<LoadTestResult> {
  return runLoadTest('OV-4.2: Public Pricing (cached)', `${API_URL}/api/pricing`, {
    connections: 20,
    pipelining: 1,
    expectRps: 100,
    expectP99: 500,
  });
}

async function testWebhookRejection(): Promise<LoadTestResult> {
  return runLoadTest(
    'OV-4.4: Webhook Burst (unsigned, should reject)',
    `${API_URL}/api/webhooks/stripe`,
    {
      connections: 50,
      pipelining: 1,
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'test.event', data: {} }),
      expectRps: 50,
    },
  );
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const target = process.argv[2] || 'all';

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  RevealUI API Load Test  -  OV-4 Baseline                 ║');
  console.log(`║  Target: ${API_URL.padEnd(48)}║`);
  console.log(`║  Duration: ${DURATION}s per test${' '.repeat(39 - String(DURATION).length)}║`);
  console.log('╚══════════════════════════════════════════════════════════╝');

  const results: LoadTestResult[] = [];

  switch (target) {
    case 'health':
      results.push(await testHealth());
      break;
    case 'pricing':
      results.push(await testPricing());
      break;
    case 'webhook':
      results.push(await testWebhookRejection());
      break;
    case 'all':
      results.push(await testHealth());
      results.push(await testPricing());
      results.push(await testWebhookRejection());
      break;
    default:
      console.error(`Unknown target: ${target}`);
      console.log('Available: health, pricing, webhook, all');
      process.exit(1);
  }

  // Summary
  console.log(`\n${'═'.repeat(60)}`);
  console.log('  SUMMARY');
  console.log(`${'═'.repeat(60)}`);

  for (const r of results) {
    const icon = r.status === 'PASS' ? '✓' : r.status === 'WARN' ? '⚠' : '✗';
    console.log(
      `  ${icon} ${r.target}: ${r.requests.average.toFixed(0)} req/s, p99=${r.latency.p99}ms`,
    );
  }

  const failed = results.filter((r) => r.status === 'FAIL');
  if (failed.length > 0) {
    console.log(`\n  ${failed.length} test(s) FAILED`);
    process.exit(1);
  }

  console.log('\n  All tests passed.');
}

main().catch((err) => {
  console.error('Load test failed:', err);
  process.exit(1);
});
