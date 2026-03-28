/**
 * CMS Load Tests
 *
 * Load tests for CMS endpoints using k6
 * Run with: k6 run packages/test/load-tests/cms-load.js
 */

import { check, sleep } from 'k6';
import http from 'k6/http';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const contentRetrievalRate = new Rate('content_retrieval_success_rate');
const contentCreationRate = new Rate('content_creation_success_rate');
const contentRetrievalTime = new Trend('content_retrieval_time');
const contentCreationTime = new Trend('content_creation_time');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 100 }, // Ramp up to 100 users
    { duration: '1m', target: 500 }, // Ramp up to 500 users
    { duration: '2m', target: 1000 }, // Stay at 1000 users
    { duration: '30s', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'], // 95% of requests should be below 200ms
    http_req_failed: ['rate<0.01'], // Less than 1% of requests should fail
    content_retrieval_success_rate: ['rate>0.99'], // 99% success rate
  },
};

// biome-ignore lint/correctness/noUndeclaredVariables: k6 global
const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';
// biome-ignore lint/correctness/noUndeclaredVariables: k6 global
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';

export default function () {
  // Test content retrieval
  const retrievalStart = Date.now();
  const retrievalRes = http.get(`${BASE_URL}/api/pages`, {
    headers: {
      Authorization: AUTH_TOKEN ? `Bearer ${AUTH_TOKEN}` : '',
    },
  });

  const retrievalSuccess = check(retrievalRes, {
    'retrieval status is 200': (r) => r.status === 200,
  });

  contentRetrievalRate.add(retrievalSuccess);
  contentRetrievalTime.add(Date.now() - retrievalStart);

  sleep(0.5);

  // Test content creation (if authenticated)
  if (AUTH_TOKEN) {
    const creationStart = Date.now();
    const creationRes = http.post(
      `${BASE_URL}/api/pages`,
      JSON.stringify({
        title: `Test Page ${Date.now()}`,
        slug: `test-page-${Date.now()}`,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${AUTH_TOKEN}`,
        },
      },
    );

    const creationSuccess = check(creationRes, {
      'creation status is 200 or 201': (r) => r.status === 200 || r.status === 201,
    });

    contentCreationRate.add(creationSuccess);
    contentCreationTime.add(Date.now() - creationStart);
  }

  sleep(1);
}
