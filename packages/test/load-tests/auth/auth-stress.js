/**
 * Authentication Stress Test
 *
 * Stress test to find breaking point of authentication system.
 */

import { randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js'
import { check, sleep } from 'k6'
import http from 'k6/http'
import { Rate } from 'k6/metrics'

// Custom metrics
const errorRate = new Rate('errors')

export const options = {
  stages: [
    { duration: '2m', target: 50 }, // Normal load: 50 users
    { duration: '5m', target: 50 },
    { duration: '2m', target: 100 }, // 2x load: 100 users
    { duration: '5m', target: 100 },
    { duration: '2m', target: 200 }, // 4x load: 200 users
    { duration: '5m', target: 200 },
    { duration: '2m', target: 300 }, // 6x load: 300 users
    { duration: '5m', target: 300 },
    { duration: '10m', target: 0 }, // Recovery
  ],
  thresholds: {
    // biome-ignore lint/style/useNamingConvention: k6 metric name
    http_req_duration: ['p(95)<5000'], // 95% under 5s (relaxed for stress test)
    // biome-ignore lint/style/useNamingConvention: k6 metric name
    http_req_failed: ['rate<0.1'], // Less than 10% failures (relaxed)
    errors: ['rate<0.1'],
  },
}

// biome-ignore lint/correctness/noUndeclaredVariables: k6 global
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'

export default function () {
  // Mix of sign-up and sign-in requests
  const isSignUp = Math.random() > 0.5

  if (isSignUp) {
    // Sign-up request
    // biome-ignore lint/correctness/noUndeclaredVariables: k6 globals
    const uniqueId = `${__VU}-${__ITER}-${randomString(8)}`
    const payload = JSON.stringify({
      email: `stress-test-${uniqueId}@example.com`,
      password: 'Password123',
      name: `Stress Test User ${uniqueId}`,
    })

    const res = http.post(`${BASE_URL}/api/auth/sign-up`, payload, {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'SignUp' },
    })

    const success = check(res, {
      'sign-up status acceptable': (r) => r.status === 200 || r.status === 400 || r.status === 429,
      'response time < 10s': (r) => r.timings.duration < 10000,
    })

    if (!success) {
      errorRate.add(1)
    } else {
      errorRate.add(0)
    }
  } else {
    // Sign-in request (will mostly fail, but tests system)
    const payload = JSON.stringify({
      // biome-ignore lint/correctness/noUndeclaredVariables: k6 global
      email: `stress-test-${__VU}@example.com`,
      password: 'Password123',
    })

    const res = http.post(`${BASE_URL}/api/auth/sign-in`, payload, {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'SignIn' },
    })

    const success = check(res, {
      'sign-in status acceptable': (r) =>
        r.status === 200 || r.status === 400 || r.status === 401 || r.status === 429,
      'response time < 10s': (r) => r.timings.duration < 10000,
    })

    if (!success) {
      errorRate.add(1)
    } else {
      errorRate.add(0)
    }
  }

  sleep(Math.random() * 2) // Random sleep 0-2s
}
