import { check, sleep } from 'k6'
import http from 'k6/http'

/**
 * API Endpoint Load Test
 * Tests high traffic on public API endpoints
 */

export const options = {
  stages: [
    { duration: '1m', target: 20 }, // Ramp up to 20 users
    { duration: '3m', target: 50 }, // Ramp up to 50 users
    { duration: '2m', target: 50 }, // Stay at 50 users
    { duration: '1m', target: 0 }, // Ramp down
  ],
  thresholds: {
    // biome-ignore lint/style/useNamingConvention: k6 metric name
    http_req_duration: ['p(95)<1000'], // 95% of requests under 1s
    // biome-ignore lint/style/useNamingConvention: k6 metric name
    http_req_failed: ['rate<0.01'], // Less than 1% failures
  },
}

// biome-ignore lint/correctness/noUndeclaredVariables: k6 global
const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000'

// List of endpoints to test
const endpoints = ['/api/health', '/api/pages', '/api/posts', '/api/products']

export default function () {
  // Randomly select an endpoint
  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)]

  const res = http.get(`${BASE_URL}${endpoint}`)

  check(res, {
    'status is 200 or 404': (r) => [200, 404].includes(r.status),
    'response time < 1s': (r) => r.timings.duration < 1000,
  })

  sleep(1)
}
