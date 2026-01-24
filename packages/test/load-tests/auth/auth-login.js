import { check, sleep } from 'k6'
import http from 'k6/http'

/**
 * Authentication Load Test
 * Tests concurrent user logins to verify system can handle authentication load
 */

export const options = {
  stages: [
    { duration: '30s', target: 10 }, // Ramp up to 10 users
    { duration: '1m', target: 50 }, // Ramp up to 50 users
    { duration: '2m', target: 50 }, // Stay at 50 users
    { duration: '30s', target: 0 }, // Ramp down
  ],
  thresholds: {
    // biome-ignore lint/style/useNamingConvention: k6 metric name
    http_req_duration: ['p(95)<2000'], // 95% of requests under 2s
    // biome-ignore lint/style/useNamingConvention: k6 metric name
    http_req_failed: ['rate<0.01'], // Less than 1% failures
    // biome-ignore lint/style/useNamingConvention: k6 metric name
    http_req_waiting: ['p(95)<1500'], // 95% waiting time under 1.5s
  },
}

// biome-ignore lint/correctness/noUndeclaredVariables: k6 global
const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000'

export default function () {
  const payload = JSON.stringify({
    email: 'test-user@example.com',
    password: 'Test1234!',
  })

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  }

  const res = http.post(`${BASE_URL}/api/users/login`, payload, params)

  check(res, {
    'status is 200': (r) => r.status === 200,
    'has JWT token': (r) => {
      try {
        const body = JSON.parse(r.body)
        return body.token !== undefined
      } catch {
        return false
      }
    },
    'response time < 2s': (r) => r.timings.duration < 2000,
  })

  sleep(1)
}
