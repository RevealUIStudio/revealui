#!/usr/bin/env tsx
/**
 * Test API Routes
 * Cross-platform replacement for test-api-routes.sh
 * Tests all memory API routes
 */

import {createLogger} from '../../../../packages/core/src/.scripts/utils.ts'

const logger = createLogger()

interface TestResult {
  description: string
  passed: boolean
  expectedStatus: number
  actualStatus: number
  response?: string
}

const results: TestResult[] = []
let passed = 0
let failed = 0

async function getFetch() {
  if (globalThis.fetch) {
    return globalThis.fetch
  }
  const { default: fetch } = await import('node-fetch')
  return fetch as unknown as typeof fetch
}

async function testRoute(
  method: string,
  path: string,
  data?: string,
  expectedStatus: number = 200,
  description: string,
): Promise<void> {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000'
  const fullUrl = `${baseUrl}${path}`

  try {
    const fetch = await getFetch()
    const options: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
    }

    if (data && method !== 'GET') {
      options.body = data
    }

    const response = await fetch(fullUrl, options)
    const body = await response.text()

    const testResult: TestResult = {
      description,
      passed: response.status === expectedStatus,
      expectedStatus,
      actualStatus: response.status,
      response: body.substring(0, 200), // Limit response length
    }

    results.push(testResult)

    if (testResult.passed) {
      logger.success(`${description} - PASS (${response.status})`)
      passed++
    } else {
      logger.error(`${description} - FAIL (expected ${expectedStatus}, got ${response.status})`)
      if (body) {
        logger.info(`  Response: ${body.substring(0, 100)}`)
      }
      failed++
    }
  } catch (error) {
    logger.error(
      `${description} - ERROR: ${error instanceof Error ? error.message : String(error)}`,
    )
    results.push({
      description,
      passed: false,
      expectedStatus,
      actualStatus: 0,
      response: error instanceof Error ? error.message : String(error),
    })
    failed++
  }
}

async function runApiTests() {
  logger.header('API Route Testing')
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000'
  logger.info(`Base URL: ${baseUrl}`)
  logger.info('')

  // Generate test IDs
  const timestamp = Date.now()
  const sessionId = `test-session-${timestamp}`
  const userId = `test-user-${timestamp}`

  logger.info('Using test IDs:')
  logger.info(`  SESSION_ID: ${sessionId}`)
  logger.info(`  USER_ID: ${userId}`)
  logger.info('')

  // Test 1: GET /api/memory/working/:sessionId
  await testRoute('GET', `/api/memory/working/${sessionId}`, undefined, 200, 'GET working memory')

  // Test 2: POST /api/memory/working/:sessionId
  await testRoute(
    'POST',
    `/api/memory/working/${sessionId}`,
    JSON.stringify({
      context: { test: 'value' },
      sessionState: {},
      activeAgents: [],
    }),
    200,
    'POST working memory',
  )

  // Test 3: GET /api/memory/episodic/:userId
  await testRoute('GET', `/api/memory/episodic/${userId}`, undefined, 200, 'GET episodic memory')

  // Test 4: POST /api/memory/episodic/:userId (valid)
  await testRoute(
    'POST',
    `/api/memory/episodic/${userId}`,
    JSON.stringify({
      id: 'mem-1',
      content: 'Test',
      type: 'fact',
      source: {
        type: 'user',
        id: userId,
        confidence: 1,
      },
      embedding: {
        model: 'openai-text-embedding-3-small',
        vector: [0.1, 0.2, 0.3],
        dimension: 3,
        generatedAt: '2025-01-01T00:00:00.000Z',
      },
      createdAt: '2025-01-01T00:00:00.000Z',
    }),
    200,
    'POST episodic memory (valid)',
  )

  // Test 5: POST /api/memory/episodic/:userId (invalid embedding)
  await testRoute(
    'POST',
    `/api/memory/episodic/${userId}`,
    JSON.stringify({
      id: 'mem-2',
      content: 'Test',
      type: 'fact',
      source: {
        type: 'user',
        id: userId,
        confidence: 1,
      },
      embedding: {
        model: 'invalid',
        vector: [1, 2, 3],
        dimension: 1536,
        generatedAt: '2025-01-01T00:00:00.000Z',
      },
      createdAt: '2025-01-01T00:00:00.000Z',
    }),
    422,
    'POST episodic memory (invalid embedding)',
  )

  // Test 6: DELETE /api/memory/episodic/:userId/:memoryId
  await testRoute(
    'DELETE',
    `/api/memory/episodic/${userId}/mem-1`,
    undefined,
    200,
    'DELETE episodic memory',
  )

  // Test 7: Invalid sessionId
  await testRoute('GET', '/api/memory/working/', undefined, 404, 'GET working memory (invalid)')

  // Test 8: Invalid userId
  await testRoute('GET', '/api/memory/episodic/', undefined, 404, 'GET episodic memory (invalid)')

  // Summary
  logger.header('Results')
  logger.success(`Passed: ${passed}`)
  if (failed > 0) {
    logger.error(`Failed: ${failed}`)
  }
  logger.info('')

  if (failed === 0) {
    logger.success('All tests passed!')
    process.exit(0)
  } else {
    logger.error('Some tests failed!')
    process.exit(1)
  }
}

/**
 * Main function
 */
async function main() {
  try {
    await runApiTests()
  } catch (error) {
    logger.error(
      `API route testing failed: ${error instanceof Error ? error.message : String(error)}`,
    )
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`)
    }
    process.exit(1)
  }
}

main()
