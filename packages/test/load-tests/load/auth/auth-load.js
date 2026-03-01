/**
 * Authentication Load Tests
 *
 * Load tests for authentication endpoints using k6
 * Run with: k6 run packages/test/load-tests/auth-load.js
 */

import { check, sleep } from 'k6'
import http from 'k6/http'
import { Rate, Trend } from 'k6/metrics'

// Custom metrics
const signUpRate = new Rate('signup_success_rate')
const signInRate = new Rate('signin_success_rate')
const signUpTime = new Trend('signup_time')
const signInTime = new Trend('signin_time')

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 50 }, // Ramp up to 50 users
    { duration: '1m', target: 100 }, // Ramp up to 100 users
    { duration: '2m', target: 200 }, // Stay at 200 users
    { duration: '30s', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
    http_req_failed: ['rate<0.01'], // Less than 1% of requests should fail
    signup_success_rate: ['rate>0.95'], // 95% signup success rate
    signin_success_rate: ['rate>0.95'], // 95% signin success rate
  },
}

// biome-ignore lint/correctness/noUndeclaredVariables: k6 global
const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000'

export default function () {
  // Test sign up
  const signUpStart = Date.now()
  const signUpEmail = `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`
  const signUpPassword = 'TestPassword123!'

  const signUpRes = http.post(
    `${BASE_URL}/api/auth/sign-up`,
    JSON.stringify({
      email: signUpEmail,
      password: signUpPassword,
      name: 'Test User',
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    },
  )

  const signUpSuccess = check(signUpRes, {
    'signup status is 200 or 201': (r) => r.status === 200 || r.status === 201,
  })

  signUpRate.add(signUpSuccess)
  signUpTime.add(Date.now() - signUpStart)

  if (!signUpSuccess) {
    return
  }

  sleep(1)

  // Test sign in
  const signInStart = Date.now()
  const signInRes = http.post(
    `${BASE_URL}/api/auth/sign-in`,
    JSON.stringify({
      email: signUpEmail,
      password: signUpPassword,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    },
  )

  const signInSuccess = check(signInRes, {
    'signin status is 200': (r) => r.status === 200,
    'signin returns session token': (r) => {
      try {
        const body = JSON.parse(r.body)
        return body.sessionToken !== undefined
      } catch {
        return false
      }
    },
  })

  signInRate.add(signInSuccess)
  signInTime.add(Date.now() - signInStart)

  sleep(1)
}
