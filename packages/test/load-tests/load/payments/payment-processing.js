import { check, sleep } from 'k6';
import http from 'k6/http';

/**
 * Payment Processing Load Test
 * Tests payment endpoints under load (requires authentication)
 */

export const options = {
  stages: [
    { duration: '30s', target: 5 }, // Ramp up to 5 users
    { duration: '1m', target: 20 }, // Ramp up to 20 users
    { duration: '2m', target: 20 }, // Stay at 20 users
    { duration: '30s', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'], // 95% of requests under 3s
    http_req_failed: ['rate<0.02'], // Less than 2% failures (payments can be more complex)
  },
};

// biome-ignore lint/correctness/noUndeclaredVariables: k6 global
const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';
// biome-ignore lint/correctness/noUndeclaredVariables: k6 global
const TEST_TOKEN = __ENV.TEST_TOKEN || '';

export default function () {
  // First, authenticate to get a token
  const loginPayload = JSON.stringify({
    email: 'test-user@example.com',
    password: 'Test1234!',
  });

  const loginRes = http.post(`${BASE_URL}/api/users/login`, loginPayload, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  let token = TEST_TOKEN;
  if (loginRes.status === 200) {
    try {
      const loginBody = JSON.parse(loginRes.body);
      token = loginBody.token || TEST_TOKEN;
    } catch {
      // Use provided token or skip
    }
  }

  if (!token) {
    console.log('No authentication token available, skipping payment test');
    return;
  }

  // Test payment intent creation
  const paymentPayload = JSON.stringify({
    amount: 1000,
    currency: 'usd',
  });

  const res = http.post(`${BASE_URL}/api/payments/create-intent`, paymentPayload, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `JWT ${token}`,
    },
  });

  check(res, {
    'status is 200 or 400': (r) => [200, 400].includes(r.status), // 400 if test mode not configured
    'response time < 3s': (r) => r.timings.duration < 3000,
  });

  sleep(2);
}
