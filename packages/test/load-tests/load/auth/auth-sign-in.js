/**
 * Authentication Sign-In Performance Test
 *
 * Tests sign-in endpoint performance under load.
 */

import { check, sleep } from 'k6'
import http from 'k6/http'
import { Rate } from 'k6/metrics'

// Custom metrics
const signInErrorRate = new Rate('sign_in_errors')

export const options = {
  stages: [
    { duration: '30s', target: 10 }, // Ramp up to 10 users
    { duration: '1m', target: 50 }, // Ramp up to 50 users
    { duration: '2m', target: 50 }, // Stay at 50 users
    { duration: '30s', target: 0 }, // Ramp down
  ],
  thresholds: {
    // biome-ignore lint/style/useNamingConvention: k6 metric name
    http_req_duration: ['p(95)<1500'], // 95% of requests under 1.5s
    // biome-ignore lint/style/useNamingConvention: k6 metric name
    http_req_failed: ['rate<0.01'], // Less than 1% failures
    // biome-ignore lint/style/useNamingConvention: k6 metric name
    sign_in_errors: ['rate<0.01'], // Less than 1% sign-in errors
  },
}

// biome-ignore lint/correctness/noUndeclaredVariables: k6 global
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'

export default function () {
  const payload = JSON.stringify({
    // biome-ignore lint/correctness/noUndeclaredVariables: k6 global
    email: `test-user-${__VU}@example.com`,
    password: 'Password123',
  })

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
    tags: {
      name: 'SignIn',
    },
  }

  const res = http.post(`${BASE_URL}/api/auth/sign-in`, payload, params)

  const success = check(res, {
    'status is 200': (r) => r.status === 200,
    'has user data': (r) => {
      try {
        const body = JSON.parse(r.body)
        return body.user !== undefined && body.user.id !== undefined
      } catch {
        return false
      }
    },
    'has session cookie': (r) => {
      const cookies = r.cookies
      return cookies['revealui-session'] !== undefined
    },
    'response time < 2s': (r) => r.timings.duration < 2000,
  })

  if (!success) {
    signInErrorRate.add(1)
  } else {
    signInErrorRate.add(0)
  }

  sleep(1)
}
