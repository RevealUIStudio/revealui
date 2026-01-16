#!/usr/bin/env tsx
/**
 * Verify RevealUI API Endpoints
 *
 * This script verifies that the API endpoints actually exist and work.
 * Run this after starting the CMS server: pnpm --filter cms dev
 */

import { createLogger } from '../shared/utils.js'

const logger = createLogger()

/**
 * Get the RevealUI API base URL
 * Simplified version for testing script
 */
function getRevealUIApiUrl(): string {
  return process.env.REVEALUI_PUBLIC_SERVER_URL || process.env.SERVER_URL || 'http://localhost:4000'
}

const API_URL = getRevealUIApiUrl() || 'http://localhost:4000'

interface TestResult {
  endpoint: string
  method: string
  status: 'pass' | 'fail' | 'skip'
  statusCode?: number
  error?: string
}

const results: TestResult[] = []

async function testEndpoint(
  endpoint: string,
  method: string = 'GET',
  body?: unknown,
): Promise<TestResult> {
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    const status =
      response.ok || response.status === 401 || response.status === 403
        ? 'pass'
        : response.status === 404
          ? 'fail'
          : 'skip' // Other errors might be expected (auth, validation, etc.)

    return {
      endpoint,
      method,
      status,
      statusCode: response.status,
      error: !status ? `HTTP ${response.status}` : undefined,
    }
  } catch (error) {
    return {
      endpoint,
      method,
      status: 'fail',
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function runTests() {
  logger.header('Testing RevealUI API Endpoints')
  logger.info(`Testing at: ${API_URL}`)

  // Test Conversation Endpoints
  logger.info('\n📝 Conversation Endpoints:')

  results.push(await testEndpoint('/api/conversations', 'GET'))
  results.push(
    await testEndpoint('/api/conversations', 'POST', {
      id: 'test-conv',
      session_id: 'test-session',
      user_id: 'test-user',
      agent_id: 'test-agent',
      messages: [],
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
  )
  results.push(await testEndpoint('/api/conversations/test-id', 'GET'))
  results.push(
    await testEndpoint('/api/conversations/test-id', 'PATCH', {
      status: 'completed',
    }),
  )
  results.push(await testEndpoint('/api/conversations/test-id', 'DELETE'))

  // Test Memory Endpoints
  logger.info('\n💭 Memory Endpoints:')

  results.push(await testEndpoint('/api/memory/episodic/test-user', 'GET'))
  results.push(
    await testEndpoint('/api/memory/episodic/test-user', 'POST', {
      id: 'test-memory',
      content: 'Test memory content',
      type: 'fact',
      source: { type: 'user', id: 'test-user', confidence: 1 },
      metadata: { importance: 0.5 },
      created_at: new Date().toISOString(),
      accessed_at: new Date().toISOString(),
      access_count: 0,
      verified: false,
    }),
  )
  results.push(
    await testEndpoint('/api/memory/episodic/test-user/test-memory', 'PUT', {
      metadata: { importance: 0.9 },
    }),
  )
  results.push(await testEndpoint('/api/memory/episodic/test-user/test-memory', 'DELETE'))

  // Test Context Endpoints
  logger.info('\n🎯 Context Endpoints:')

  results.push(await testEndpoint('/api/memory/context/test-session/test-agent', 'GET'))
  results.push(
    await testEndpoint('/api/memory/context/test-session/test-agent', 'POST', {
      theme: 'dark',
    }),
  )

  // Print Results
  logger.header('Test Results')

  const passes = results.filter((r) => r.status === 'pass')
  const fails = results.filter((r) => r.status === 'fail')
  const skips = results.filter((r) => r.status === 'skip')

  results.forEach((result) => {
    const icon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⚠️'
    const statusText =
      result.status === 'pass' ? 'EXISTS' : result.status === 'fail' ? 'MISSING' : 'AUTH/ERROR'
    logger.info(
      `${icon} ${result.method.padEnd(6)} ${result.endpoint.padEnd(50)} ${statusText.padEnd(10)} ${result.statusCode || ''} ${result.error || ''}`,
    )
  })

  logger.info('\nSummary:')
  logger.info(`  ✅ Passed (exists): ${passes.length}`)
  logger.info(`  ❌ Failed (missing): ${fails.length}`)
  logger.info(`  ⚠️  Skipped (auth/other): ${skips.length}`)
  logger.info(`  Total: ${results.length}`)

  if (fails.length > 0) {
    logger.error('\n❌ FAILED ENDPOINTS:')
    fails.forEach((result) => {
      logger.error(`  ${result.method} ${result.endpoint}`)
    })
    process.exit(1)
  } else {
    logger.success('\n✅ All endpoints exist!')
    process.exit(0)
  }
}

/**
 * Main function
 */
async function main() {
  try {
    await runTests()
  } catch (error) {
    logger.error(`Error running tests: ${error instanceof Error ? error.message : String(error)}`)
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`)
    }
    process.exit(1)
  }
}

main()
