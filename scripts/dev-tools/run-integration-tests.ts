/**
 * Run Integration Tests
 *
 * Runs integration tests with proper database configuration.
 * Automatically provisions test database if POSTGRES_URL is not set.
 */

import { execSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import { ErrorCode } from '../lib/errors.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
config({ path: resolve(__dirname, '../../apps/cms/.env.local') })
config({ path: resolve(__dirname, '../../apps/cms/.env.development.local') })
config({ path: resolve(__dirname, '../../apps/cms/.env') })
config({ path: resolve(__dirname, '../../.env.local') })
config({ path: resolve(__dirname, '../../.env') })

const logger = {
  info: (msg: string) => console.log(`ℹ️  ${msg}`),
  success: (msg: string) => console.log(`✅ ${msg}`),
  error: (msg: string) => console.error(`❌ ${msg}`),
  warn: (msg: string) => console.warn(`⚠️  ${msg}`),
}

async function runIntegrationTests() {
  let databaseUrl: string | undefined = process.env.DATABASE_URL || process.env.POSTGRES_URL

  try {
    // Check if database URL is set
    if (!databaseUrl) {
      logger.error('No database URL found!')
      logger.info('Set DATABASE_URL or POSTGRES_URL environment variable,')
      logger.info('or run: pnpm db:setup-test')
      process.exit(ErrorCode.CONFIG_ERROR)
    } else {
      logger.info(`Using existing database: ${databaseUrl.replace(/:[^:@]+@/, ':****@')}`)
    }

    // Set environment variables for tests
    process.env.DATABASE_URL = databaseUrl
    process.env.POSTGRES_URL = databaseUrl

    logger.info('Running integration tests...\n')

    // Run tests for all packages with integration tests
    const testPackages = ['@revealui/auth', '@revealui/ai']

    for (const packageName of testPackages) {
      logger.info(`Running tests for ${packageName}...`)
      try {
        execSync(`pnpm --filter ${packageName} test`, {
          stdio: 'inherit',
          cwd: resolve(__dirname, '../..'),
          env: {
            ...process.env,
            // biome-ignore lint/style/useNamingConvention: env var name.
            DATABASE_URL: databaseUrl,
            // biome-ignore lint/style/useNamingConvention: env var name.
            POSTGRES_URL: databaseUrl,
          },
        })
        logger.success(`Tests passed for ${packageName}`)
      } catch (error) {
        logger.error(`Tests failed for ${packageName}`)
        throw error
      }
    }

    logger.success('\n✅ All integration tests completed')
  } catch (error) {
    logger.error(
      `\n❌ Integration tests failed: ${error instanceof Error ? error.message : String(error)}`,
    )
    throw error
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runIntegrationTests()
    .then(() => {
      process.exit(0)
    })
    .catch(() => {
      process.exit(ErrorCode.CONFIG_ERROR)
    })
}

export { runIntegrationTests }
