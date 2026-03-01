#!/usr/bin/env node
/**
 * Memory Integration Tests Runner
 *
 * Runs memory integration tests with proper setup and cleanup.
 * Supports running individual test suites or all tests.
 *
 * Usage:
 *   pnpm tsx packages/test/scripts/run-memory-tests.ts [suite]
 *   or
 *   pnpm test:memory:all
 *   pnpm test:memory:vector
 *   pnpm test:memory:dual
 *   pnpm test:memory:episodic
 *
 * @dependencies
 * - scripts/lib/errors.ts - ErrorCode enum for exit codes
 * - node:child_process - Command execution (execSync)
 * - node:path - Path manipulation utilities (dirname, join)
 * - node:url - URL utilities (fileURLToPath)
 *
 * @requires
 * - Environment: DATABASE_URL (Supabase/Vector database connection)
 * - Environment: POSTGRES_URL (NeonDB/REST database connection)
 * - Environment: OPENAI_API_KEY (OpenAI API for embeddings)
 */

import { execSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ErrorCode } from '../lib/errors.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const testSuites = {
  vector: 'Vector Memory Integration Tests',
  dual: 'Dual Database Integration Tests',
  episodic: 'EpisodicMemory Integration Tests',
  all: 'All Memory Integration Tests',
} as const

type TestSuite = keyof typeof testSuites

function runTests(suite: TestSuite) {
  // Determine workspace root (go up from packages/test/scripts)
  // __dirname is packages/test/scripts, so go up 2 levels to workspace root
  const workspaceRoot = join(__dirname, '../../..')
  const baseCommand = 'pnpm --filter test test:integration'
  // Test path relative to test package
  const testPath = 'src/integration/memory'

  const commands: Record<TestSuite, string> = {
    vector: `${baseCommand} ${testPath}/vector-memory.integration.test.ts`,
    dual: `${baseCommand} ${testPath}/dual-database.integration.test.ts`,
    episodic: `${baseCommand} ${testPath}/episodic-memory.integration.test.ts`,
    all: `${baseCommand} ${testPath}`,
  }

  const command = commands[suite]

  console.log(`\n🧪 Running: ${String(testSuites[suite])}\n`)
  console.log(`${'='.repeat(50)}\n`)

  try {
    execSync(command, {
      stdio: 'inherit',
      cwd: workspaceRoot, // Run from workspace root for package resolution
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
    })
    console.log(`\n✅ ${testSuites[suite]} completed successfully!\n`)
  } catch {
    console.error(`\n❌ ${testSuites[suite]} failed!\n`)
    process.exit(ErrorCode.EXECUTION_ERROR)
  }
}

function main() {
  const args = process.argv.slice(2)
  const suite = (args[0] || 'all') as TestSuite

  if (!(suite in testSuites)) {
    console.error(`Invalid test suite: ${suite}`)
    console.error(`Available suites: ${Object.keys(testSuites).join(', ')}`)
    process.exit(ErrorCode.EXECUTION_ERROR)
  }

  console.log('🚀 Memory Integration Test Runner\n')
  console.log('='.repeat(50))

  // Check environment variables
  const requiredVars = ['DATABASE_URL', 'POSTGRES_URL', 'OPENAI_API_KEY']
  const missingVars = requiredVars.filter((v) => !process.env[v])

  if (missingVars.length > 0) {
    console.error('\n❌ Missing required environment variables:')
    missingVars.forEach((v) => {
      console.error(`   - ${v}`)
    })
    console.error('\nPlease set these variables before running tests.')
    console.error('See packages/test/.env.test.example for reference.\n')
    process.exit(ErrorCode.EXECUTION_ERROR)
  }

  runTests(suite)
}

main()
