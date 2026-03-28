/**
 * AI Load Tests
 *
 * Load tests for AI endpoints using k6
 * Run with: k6 run packages/test/load-tests/ai-load.js
 */

import { check, sleep } from 'k6';
import http from 'k6/http';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const memoryOperationRate = new Rate('memory_operation_success_rate');
const nodeIdLookupRate = new Rate('node_id_lookup_success_rate');
const memoryOperationTime = new Trend('memory_operation_time');
const nodeIdLookupTime = new Trend('node_id_lookup_time');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 50 }, // Ramp up to 50 users
    { duration: '1m', target: 200 }, // Ramp up to 200 users
    { duration: '2m', target: 500 }, // Stay at 500 users
    { duration: '30s', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<100'], // 95% of requests should be below 100ms
    http_req_failed: ['rate<0.01'], // Less than 1% of requests should fail
    memory_operation_success_rate: ['rate>0.99'], // 99% success rate
    node_id_lookup_success_rate: ['rate>0.99'], // 99% success rate
    node_id_lookup_time: ['p(95)<10'], // 95% of lookups should be below 10ms
  },
};

// biome-ignore lint/correctness/noUndeclaredVariables: k6 global
const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';
// biome-ignore lint/correctness/noUndeclaredVariables: k6 global
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';

export default function () {
  // Test node ID lookup
  const lookupStart = Date.now();
  const lookupRes = http.get(
    `${BASE_URL}/api/agent-contexts?agentId=test-agent&sessionId=test-session`,
    {
      headers: {
        Authorization: AUTH_TOKEN ? `Bearer ${AUTH_TOKEN}` : '',
      },
    },
  );

  const lookupSuccess = check(lookupRes, {
    'lookup status is 200': (r) => r.status === 200,
  });

  nodeIdLookupRate.add(lookupSuccess);
  nodeIdLookupTime.add(Date.now() - lookupStart);

  sleep(0.2);

  // Test memory operation
  if (AUTH_TOKEN) {
    const memoryStart = Date.now();
    const memoryRes = http.post(
      `${BASE_URL}/api/agent-memories`,
      JSON.stringify({
        agentId: 'test-agent',
        content: `Test memory ${Date.now()}`,
        type: 'fact',
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${AUTH_TOKEN}`,
        },
      },
    );

    const memorySuccess = check(memoryRes, {
      'memory operation status is 200 or 201': (r) => r.status === 200 || r.status === 201,
    });

    memoryOperationRate.add(memorySuccess);
    memoryOperationTime.add(Date.now() - memoryStart);
  }

  sleep(0.5);
}
