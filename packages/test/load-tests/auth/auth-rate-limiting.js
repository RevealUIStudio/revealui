/**
 * Rate Limiting Performance Test
 *
 * Tests rate limiting behavior under load.
 * Verifies rate limiting doesn't degrade performance for legitimate users.
 */

import { check, sleep } from 'k6'
import http from 'k6/http'
import { Rate } from 'k6/metrics'

// Custom metrics
const rateLimitHits = new Rate('rate_limit_hits')
const legitimateRequests = new Rate('legitimate_requests')

export const options = {
  stages: [
    { duration: '10s', target: 1 }, // Start with 1 user
    { duration: '30s', target: 10 }, // Ramp up to 10 users
    { duration: '1m', target: 10 }, // Stay at 10 users
    { duration: '30s', target: 0 }, // Ramp down
  ],
  thresholds: {
    // biome-ignore lint/style/useNamingConvention: k6 performance testing API uses snake_case
    http_req_duration: ['p(95)<2000'], // 95% of requests under 2s
    // biome-ignore lint/style/useNamingConvention: k6 performance testing API uses snake_case
    rate_limit_hits: ['rate<0.1'], // Less than 10% should hit rate limit
    // biome-ignore lint/style/useNamingConvention: k6 performance testing API uses snake_case
    legitimate_requests: ['rate>0.9'], // At least 90% should succeed
  },
}

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'

export default function () {
  // Each virtual user makes requests at a reasonable rate
  const payload = JSON.stringify({
    email: `ratelimit-test-${__VU}@example.com`,
    password: 'WrongPassword123', // Intentionally wrong to test rate limiting
  })

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
    tags: {
      name: 'RateLimitTest',
    },
  }

  // Make multiple requests to test rate limiting
  for (let i = 0; i < 3; i++) {
    const res = http.post(`${BASE_URL}/api/auth/sign-in`, payload, params)

    const isRateLimited = res.status === 429
    const isSuccess = res.status === 200
    const isAuthError = res.status === 400 || res.status === 401

    if (isRateLimited) {
      rateLimitHits.add(1)
      check(res, {
        'rate limit response has retry-after': (r) => {
          const retryAfter = r.headers['Retry-After']
          return retryAfter !== undefined && Number.parseInt(retryAfter, 10) > 0
        },
        'rate limit response has headers': (r) => {
          return r.headers['X-RateLimit-Limit'] !== undefined
        },
      })
    } else if (isSuccess || isAuthError) {
      legitimateRequests.add(1)
    }

    sleep(1) // Wait 1 second between requests
  }

  sleep(2) // Wait before next iteration
}
