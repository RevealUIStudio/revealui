#!/usr/bin/env tsx
/**
 * Security Testing Script for RevealUI Framework
 * Cross-platform replacement for security-test.sh
 * Based on PENETRATION-TESTING-GUIDE.md
 */

import { createLogger } from '../../../lib/index.js'

const logger = createLogger()

interface TestResult {
  name: string
  passed: boolean
  message?: string
}

const results: TestResult[] = []
const passed = 0
let failed = 0

function recordTest(name: string, passed: boolean, message?: string) {
  results.push({ name, passed, message })
  if (passed) {
    passed++
  } else {
    failed++
  }
}

async function getFetch() {
  // Use built-in fetch (Node 18+) or fallback to node-fetch
  if (globalThis.fetch) {
    return globalThis.fetch
  }
  const { default: fetch } = await import('node-fetch')
  return fetch as unknown as typeof fetch
}

async function testRateLimiting(baseUrl: string) {
  logger.info('1. Testing Rate Limiting...')
  try {
    const fetch = await getFetch()
    let rateLimitFailed = false

    for (let i = 1; i <= 10; i++) {
      const response = await fetch(`${baseUrl}/api/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'wrong@example.com',
          password: 'wrong',
        }),
      })

      if (i > 5 && response.status !== 429) {
        rateLimitFailed = true
      }
    }

    recordTest(
      'Rate limiting blocks after 5 attempts',
      !rateLimitFailed,
      rateLimitFailed ? 'Rate limiting not working properly' : undefined,
    )
  } catch (error) {
    recordTest('Rate limiting', false, `Error: ${error}`)
  }
}

async function testSecurityHeaders(baseUrl: string) {
  logger.info('2. Testing Security Headers...')
  try {
    const fetch = await getFetch()
    const response = await fetch(`${baseUrl}/api/health`)
    const headers = response.headers

    const hasXFrame = headers.has('x-frame-options')
    const hasXContentType = headers.has('x-content-type-options')
    const _hasCSP = headers.has('content-security-policy')

    const hasRequired = hasXFrame && hasXContentType
    recordTest(
      'Security headers present',
      hasRequired,
      hasRequired ? undefined : 'Missing required security headers',
    )
  } catch (error) {
    recordTest('Security headers', false, `Error: ${error}`)
  }
}

async function testCORS(baseUrl: string) {
  logger.info('3. Testing CORS Configuration...')
  try {
    const fetch = await getFetch()
    const response = await fetch(`${baseUrl}/api/health`, {
      method: 'OPTIONS',
      headers: {
        // biome-ignore lint/style/useNamingConvention: HTTP header keys are case-sensitive.
        Origin: 'https://malicious-site.com',
        'Access-Control-Request-Method': 'GET',
      },
    })

    const corsHeader = response.headers.get('access-control-allow-origin')
    const isRestrictive = !corsHeader || corsHeader !== '*'

    recordTest('CORS properly configured', isRestrictive)
  } catch (error) {
    recordTest('CORS configuration', false, `Error: ${error}`)
  }
}

async function testSQLInjection(baseUrl: string) {
  logger.info('4. Testing SQL Injection Prevention...')
  try {
    const fetch = await getFetch()
    const response = await fetch(`${baseUrl}/api/pages?where[title][equals]=1' OR '1'='1`)

    // Should not return 200 or 500 for SQL injection attempts
    const isSafe = response.status !== 200 && response.status !== 500
    recordTest('SQL injection prevented', isSafe)
  } catch (error) {
    recordTest('SQL injection prevention', false, `Error: ${error}`)
  }
}

async function testXSS(baseUrl: string) {
  logger.info('5. Testing XSS Prevention...')
  try {
    const fetch = await getFetch()
    const xssPayload = encodeURIComponent("<script>alert('XSS')</script>")
    const response = await fetch(`${baseUrl}/api/pages?title=${xssPayload}`)
    const text = await response.text()

    const hasScriptTag = text.toLowerCase().includes('<script>')
    recordTest('XSS prevention working', !hasScriptTag)
  } catch (error) {
    recordTest('XSS prevention', false, `Error: ${error}`)
  }
}

async function testAuthentication(baseUrl: string) {
  logger.info('6. Testing Authentication Requirements...')
  try {
    const fetch = await getFetch()
    const response = await fetch(`${baseUrl}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'test' }),
    })

    const requiresAuth = response.status === 401 || response.status === 403
    recordTest('Protected endpoints require authentication', requiresAuth)
  } catch (error) {
    recordTest('Authentication requirements', false, `Error: ${error}`)
  }
}

async function testJWTValidation(baseUrl: string) {
  logger.info('7. Testing JWT Token Validation...')
  try {
    const fetch = await getFetch()
    const response = await fetch(`${baseUrl}/api/users`, {
      headers: {
        // biome-ignore lint/style/useNamingConvention: HTTP header keys are case-sensitive.
        Authorization: 'JWT invalid-token-here',
      },
    })

    const rejectsInvalid = response.status === 401 || response.status === 403
    recordTest('Invalid JWT tokens rejected', rejectsInvalid)
  } catch (error) {
    recordTest('JWT validation', false, `Error: ${error}`)
  }
}

async function testHealthEndpoint(baseUrl: string) {
  logger.info('8. Testing Health Endpoint...')
  try {
    const fetch = await getFetch()
    const response = await fetch(`${baseUrl}/api/health`)
    const data = await response.json()

    const hasStatus = 'status' in data
    recordTest('Health endpoint accessible', hasStatus)
  } catch (error) {
    recordTest('Health endpoint', false, `Error: ${error}`)
  }
}

async function runSecurityTests() {
  const baseUrl = process.env.BASE_URL || 'http://localhost:4000'
  const _testEmail = process.env.TEST_EMAIL || 'test@example.com'
  const _testPassword = process.env.TEST_PASSWORD || 'TestPassword123'

  logger.header('Security Tests for RevealUI Framework')
  logger.info(`Base URL: ${baseUrl}`)
  logger.info('')

  await testRateLimiting(baseUrl)
  await testSecurityHeaders(baseUrl)
  await testCORS(baseUrl)
  await testSQLInjection(baseUrl)
  await testXSS(baseUrl)
  await testAuthentication(baseUrl)
  await testJWTValidation(baseUrl)
  await testHealthEndpoint(baseUrl)

  // Summary
  logger.header('Security Test Summary')
  logger.success(`Passed: ${passed}`)
  if (failed > 0) {
    logger.error(`Failed: ${failed}`)
  }
  logger.info('')

  // Show failed tests
  const failedTests = results.filter((r) => !r.passed)
  if (failedTests.length > 0) {
    logger.error('Failed Tests:')
    for (const test of failedTests) {
      logger.error(`  - ${test.name}`)
      if (test.message) {
        logger.info(`    ${test.message}`)
      }
    }
    logger.info('')
  }

  if (failed === 0) {
    logger.success('All security tests passed!')
    process.exit(0)
  } else {
    logger.error('Some security tests failed. Review the results above.')
    process.exit(1)
  }
}

/**
 * Main function
 */
async function main() {
  try {
    await runSecurityTests()
  } catch (error) {
    logger.error(`Security test failed: ${error instanceof Error ? error.message : String(error)}`)
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`)
    }
    process.exit(1)
  }
}

main()
