/**
 * Authentication Sign-Up Performance Test
 *
 * Tests sign-up endpoint performance under load.
 */

import { randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js'
import { check, sleep } from 'k6'
import http from 'k6/http'
import { Rate } from 'k6/metrics'

// Custom metrics
const signUpErrorRate = new Rate('sign_up_errors')

export const options = {
  stages: [
    { duration: '30s', target: 5 }, // Ramp up to 5 users
    { duration: '1m', target: 20 }, // Ramp up to 20 users
    { duration: '2m', target: 20 }, // Stay at 20 users
    { duration: '30s', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests under 2s
    http_req_failed: ['rate<0.01'], // Less than 1% failures
    sign_up_errors: ['rate<0.01'], // Less than 1% sign-up errors
  },
}

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'

export default function () {
  // Generate unique email for each virtual user
  const uniqueId = `${__VU}-${__ITER}-${randomString(8)}`
  const payload = JSON.stringify({
    email: `perf-test-${uniqueId}@example.com`,
    password: 'Password123',
    name: `Performance Test User ${uniqueId}`,
  })

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
    tags: {
      name: 'SignUp',
    },
  }

  const res = http.post(`${BASE_URL}/api/auth/sign-up`, payload, params)

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
    'response time < 3s': (r) => r.timings.duration < 3000,
  })

  if (!success) {
    signUpErrorRate.add(1)
  } else {
    signUpErrorRate.add(0)
  }

  sleep(2) // Sign-up is slower, wait longer
}
