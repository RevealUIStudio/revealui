/**
 * Run Integration Tests
 *
 * Runs integration tests with proper database configuration.
 * Automatically provisions test database if POSTGRES_URL is not set.
 *
 * @dependencies
 * - scripts/lib/errors.ts - ErrorCode enum for exit codes
 * - dotenv - Environment variable loading (config)
 * - node:child_process - Command execution (execSync)
 * - node:path - Path manipulation utilities (dirname, resolve)
 * - node:url - URL utilities (fileURLToPath)
 *
 * @requires
 * - Environment: DATABASE_URL or POSTGRES_URL (test database connection)
 */

import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ErrorCode } from '@revealui/scripts/errors.js';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: resolve(__dirname, '../../apps/admin/.env.local') });
config({ path: resolve(__dirname, '../../apps/admin/.env.development.local') });
config({ path: resolve(__dirname, '../../apps/admin/.env') });
config({ path: resolve(__dirname, '../../.env.local') });
config({ path: resolve(__dirname, '../../.env') });

const logger = {
  info: (msg: string) => console.log(`ℹ️  ${msg}`),
  success: (msg: string) => console.log(`✅ ${msg}`),
  error: (msg: string) => console.error(`❌ ${msg}`),
  warn: (msg: string) => console.warn(`⚠️  ${msg}`),
};

async function runIntegrationTests() {
  const databaseUrl: string | undefined = process.env.DATABASE_URL || process.env.POSTGRES_URL;

  try {
    // Check if database URL is set
    if (!databaseUrl) {
      logger.error('No database URL found!');
      logger.info('Set DATABASE_URL or POSTGRES_URL environment variable,');
      logger.info('or run: pnpm db:setup-test');
      process.exit(ErrorCode.CONFIG_ERROR);
    } else {
      logger.info(`Using existing database: ${databaseUrl.replace(/:[^:@]+@/, ':****@')}`);
    }

    // Set environment variables for tests
    process.env.DATABASE_URL = databaseUrl;
    process.env.POSTGRES_URL = databaseUrl;

    logger.info('Running integration tests...\n');

    // Public repo defaults to OSS packages only. Opt into Pro package tests explicitly.
    const testPackages = ['@revealui/auth'];
    if (process.env.REVEALUI_INCLUDE_PRO_TESTS === '1') {
      testPackages.push('@revealui/ai');
    }

    for (const packageName of testPackages) {
      logger.info(`Running tests for ${packageName}...`);
      try {
        execFileSync('pnpm', ['--filter', packageName, 'test'], {
          stdio: 'inherit',
          cwd: resolve(__dirname, '../..'),
          env: {
            ...process.env,
            DATABASE_URL: databaseUrl,
            POSTGRES_URL: databaseUrl,
          },
        });
        logger.success(`Tests passed for ${packageName}`);
      } catch (error) {
        logger.error(`Tests failed for ${packageName}`);
        throw error;
      }
    }

    logger.success('\n✅ All integration tests completed');
  } catch (error) {
    logger.error(
      `\n❌ Integration tests failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runIntegrationTests()
    .then(() => {
      process.exit(ErrorCode.SUCCESS);
    })
    .catch(() => {
      process.exit(ErrorCode.CONFIG_ERROR);
    });
}

export { runIntegrationTests };
