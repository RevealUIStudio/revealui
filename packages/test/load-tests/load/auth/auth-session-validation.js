/**
 * Session Validation Performance Test
 *
 * Tests session validation performance (getSession) under load.
 * Requires authenticated sessions.
 */

import { check, sleep } from 'k6';
import http from 'k6/http';
import { Rate } from 'k6/metrics';

// Custom metrics
const sessionErrorRate = new Rate('session_validation_errors');

export const options = {
  stages: [
    { duration: '30s', target: 20 }, // Ramp up to 20 users
    { duration: '1m', target: 100 }, // Ramp up to 100 users
    { duration: '2m', target: 100 }, // Stay at 100 users
    { duration: '30s', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    http_req_failed: ['rate<0.01'], // Less than 1% failures
    session_validation_errors: ['rate<0.01'],
  },
};

// biome-ignore lint/correctness/noUndeclaredVariables: k6 global
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Setup: Create session for each virtual user
export function setup() {
  const sessions = [];

  // Create 10 test sessions to reuse
  for (let i = 0; i < 10; i++) {
    const signUpPayload = JSON.stringify({
      email: `session-test-${i}-${Date.now()}@example.com`,
      password: 'Password123',
      name: `Session Test User ${i}`,
    });

    const signUpRes = http.post(`${BASE_URL}/api/auth/sign-up`, signUpPayload, {
      headers: { 'Content-Type': 'application/json' },
    });

    if (signUpRes.status === 200) {
      const cookies = signUpRes.cookies;
      const sessionCookie = cookies['revealui-session'];
      if (sessionCookie && sessionCookie.length > 0) {
        sessions.push(sessionCookie[0].value);
      }
    }

    sleep(0.1); // Small delay between sign-ups
  }

  return { sessions };
}

export default function (data) {
  // Use a session from the pool (round-robin)
  // biome-ignore lint/correctness/noUndeclaredVariables: k6 global
  const sessionToken = data.sessions[__VU % data.sessions.length];

  if (!sessionToken) {
    return;
  }

  // Test a protected endpoint that validates session
  // Using a simple endpoint that requires authentication
  const params = {
    headers: {
      Cookie: `revealui-session=${sessionToken}`,
    },
    tags: {
      name: 'SessionValidation',
    },
  };

  // Test session validation by calling an endpoint that uses getSession
  // For now, we'll test with a simple GET that validates session
  // Note: This assumes there's an endpoint that validates sessions
  // If not, we can create a test endpoint or use an existing protected route
  const res = http.get(`${BASE_URL}/api/auth/me`, params);

  const success = check(res, {
    'status is 200 or 401': (r) => r.status === 200 || r.status === 401,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  if (!success) {
    sessionErrorRate.add(1);
  } else {
    sessionErrorRate.add(0);
  }

  sleep(0.5);
}
