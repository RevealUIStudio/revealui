#!/usr/bin/env tsx

/**
 * Runtime Verification Script for Services Package
 *
 * Verifies that services package exports work correctly in actual runtime context.
 * Uses dynamic imports to work around ESM directory import limitations.
 *
 * FIXED: Handles workspace protocol resolution failures with fallback to explicit paths.
 *
 * Usage:
 *   pnpm verify:services
 */

import {dirname,join,resolve} from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {createLogger,getProjectRoot} from '../../../../packages/core/src/.scripts/utils.ts'

const logger = createLogger()

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')
const servicesPath = resolve(rootDir, 'packages/services/src/index.ts')

async function importWithFallback(
  workspaceName: string,
  fallbackPath: string,
  description: string,
) {
  try {
    // Try workspace protocol first (works in pnpm monorepo)
    return await import(workspaceName)
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error)

    // If workspace protocol fails, try explicit path
    // Check for various error patterns that indicate module not found
    if (
      errorMsg.includes('Cannot find package') ||
      errorMsg.includes('Cannot find module') ||
      errorMsg.includes('ERR_MODULE_NOT_FOUND') ||
      errorMsg.includes('Did you mean to import')
    ) {
      logger.warning(`   Workspace protocol failed, trying explicit path...`)
      try {
        // FIXED: Use pathToFileURL to properly convert file path to file:// URL for ESM imports
        // This ensures .ts files are properly handled by tsx/node when using dynamic import
        const fileUrl = pathToFileURL(fallbackPath).href
        return await import(fileUrl)
      } catch (fallbackError: unknown) {
        const fallbackMsg =
          fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
        throw new Error(
          `Failed to import ${description}: workspace protocol (${errorMsg}) and explicit path (${fallbackMsg}) both failed. Make sure tsx is being used to run this script.`,
        )
      }
    }
    throw error
  }
}

async function verifyRuntime() {
  try {
    await getProjectRoot(import.meta.url)
    logger.header('Services Package Runtime Verification')
    logger.info('Verifying services package runtime imports...\n')

    const errors: string[] = []

    try {
      // Test 1: Verify main export (using workspace protocol with fallback)
      logger.info('1. Testing main export via workspace protocol...')
      try {
        const main = await importWithFallback('services', servicesPath, 'services main export')

        if (!main.protectedStripe) {
          errors.push('❌ protectedStripe not exported from main')
        } else {
          logger.success('   protectedStripe exported')
          // Verify it has expected structure
          if (typeof main.protectedStripe !== 'object') {
            errors.push('❌ protectedStripe is not an object')
          }
        }

        if (!main.createServerClient) {
          errors.push('❌ createServerClient not exported from main')
        } else {
          logger.success('   createServerClient exported')
        }

        if (!main.createPaymentIntent) {
          errors.push('❌ createPaymentIntent not exported from main')
        } else {
          logger.success('   createPaymentIntent exported')
        }
      } catch (error: unknown) {
        errors.push(
          `❌ Failed to import main export: ${error instanceof Error ? error.message : String(error)}`,
        )
      }

      // Test 2: Verify core export
      logger.info('\n2. Testing core export...')
      try {
        const corePath = resolve(rootDir, 'packages/services/src/index.ts')
        const core = await importWithFallback('services/core', corePath, 'services/core export')

        if (!core.protectedStripe) {
          errors.push('❌ protectedStripe not exported from core')
        } else {
          logger.success('   protectedStripe exported from core')
        }

        if (!core.createPaymentIntent) {
          errors.push('❌ createPaymentIntent not exported from core')
        } else {
          logger.success('   createPaymentIntent exported from core')
        }
      } catch (error: unknown) {
        errors.push(
          `❌ Failed to import core export: ${error instanceof Error ? error.message : String(error)}`,
        )
      }

      // Test 3: Verify API export includes createPaymentIntent
      logger.info('\n3. Testing API exports...')
      try {
        const apiPath = resolve(rootDir, 'packages/services/src/api/index.ts')
        const api = await importWithFallback(
          'services/core/api',
          apiPath,
          'services/core/api export',
        )

        if (!api.createPaymentIntent) {
          errors.push('❌ createPaymentIntent not exported from api')
        } else {
          logger.success('   createPaymentIntent exported from api')
          // Verify it's a function
          if (typeof api.createPaymentIntent !== 'function') {
            errors.push('❌ createPaymentIntent is not a function')
          }
        }
      } catch (error: unknown) {
        errors.push(
          `❌ Failed to import api export: ${error instanceof Error ? error.message : String(error)}`,
        )
      }

      // Test 4: Verify exports are consistent
      logger.info('\n4. Testing export consistency...')
      try {
        // FIXED: Use importWithFallback() instead of direct import to ensure fallback works
        const main = await importWithFallback('services', servicesPath, 'services main export')
        const corePath = resolve(rootDir, 'packages/services/src/index.ts')
        const core = await importWithFallback('services/core', corePath, 'services/core export')

        if (main.protectedStripe !== core.protectedStripe) {
          errors.push('❌ protectedStripe not consistent between main and core')
        } else {
          logger.success('   protectedStripe consistent between exports')
        }

        if (main.createPaymentIntent !== core.createPaymentIntent) {
          errors.push('❌ createPaymentIntent not consistent between main and core')
        } else {
          logger.success('   createPaymentIntent consistent between exports')
        }
      } catch (error: unknown) {
        errors.push(
          `❌ Failed to verify consistency: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    } catch (error: unknown) {
      errors.push(
        `❌ Runtime verification failed: ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    if (errors.length > 0) {
      logger.error('\n❌ Verification failed:\n')
      for (const error of errors) {
        logger.error(`  ${error}`)
      }
      process.exit(1)
    } else {
      logger.success('\n✅ All runtime verifications passed!')
      process.exit(0)
    }
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`)
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`)
    }
    process.exit(1)
  }
}

/**
 * Main function
 */
async function main() {
  try {
    await verifyRuntime()
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}

main()
