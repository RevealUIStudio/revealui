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
 */

import { execSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

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

  let command: string

  switch (suite) {
    case 'vector':
      command = `${baseCommand} ${testPath}/vector-memory.integration.test.ts`
      break
    case 'dual':
      command = `${baseCommand} ${testPath}/dual-database.integration.test.ts`
      break
    case 'episodic':
      command = `${baseCommand} ${testPath}/episodic-memory.integration.test.ts`
      break
    case 'all':
      command = `${baseCommand} ${testPath}`
      break
    default:
      console.error(`Unknown test suite: ${suite}`)
      process.exit(1)
  }

  console.log(`\n🧪 Running: ${testSuites[suite]}\n`)
  console.log('='.repeat(50) + '\n')

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
  } catch (error) {
    console.error(`\n❌ ${testSuites[suite]} failed!\n`)
    process.exit(1)
  }
}

function main() {
  const args = process.argv.slice(2)
  const suite = (args[0] || 'all') as TestSuite

  if (!(suite in testSuites)) {
    console.error(`Invalid test suite: ${suite}`)
    console.error(`Available suites: ${Object.keys(testSuites).join(', ')}`)
    process.exit(1)
  }

  console.log('🚀 Memory Integration Test Runner\n')
  console.log('='.repeat(50))

  // Check environment variables
  const requiredVars = ['DATABASE_URL', 'POSTGRES_URL', 'OPENAI_API_KEY']
  const missingVars = requiredVars.filter((v) => !process.env[v])

  if (missingVars.length > 0) {
    console.error('\n❌ Missing required environment variables:')
    missingVars.forEach((v) => console.error(`   - ${v}`))
    console.error('\nPlease set these variables before running tests.')
    console.error('See packages/test/.env.test.example for reference.\n')
    process.exit(1)
  }

  runTests(suite)
}

main()
