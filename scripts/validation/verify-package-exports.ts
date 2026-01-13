#!/usr/bin/env tsx
/**
 * Package Export Verification Script
 *
 * Verifies that all package exports are accessible and resolve correctly.
 * This script can be run as part of CI/CD to catch export issues early.
 *
 * Usage:
 *   pnpm tsx scripts/validation/verify-package-exports.ts
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createLogger, getProjectRoot } from '../shared/utils.js'

const logger = createLogger()

const __filename = fileURLToPath(import.meta.url)
const __dirname = join(__filename, '..')
const rootDir = join(__dirname, '..')

interface PackageInfo {
  name: string
  path: string
  exports: Record<string, string>
}

const packages: PackageInfo[] = [
  {
    name: '@revealui/db',
    path: 'packages/db',
    exports: {
      '.': './src/index.ts',
      './core': './src/core/index.ts',
      './client': './src/client/index.ts',
    },
  },
  {
    name: '@revealui/ai',
    path: 'packages/ai',
    exports: {
      '.': './src/index.ts',
      './memory': './src/memory/index.ts',
      './client': './src/client/index.ts',
    },
  },
  {
    name: 'services',
    path: 'packages/services',
    exports: {
      '.': './src/index.ts',
      './core': './src/core/index.ts',
      './client': './src/client/index.ts',
    },
  },
]

function verifyPackage(pkg: PackageInfo): { success: boolean; errors: string[] } {
  const errors: string[] = []
  const packagePath = join(rootDir, pkg.path)

  // Check package.json exists
  const packageJsonPath = join(packagePath, 'package.json')
  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))

    // Verify exports match expected
    if (!packageJson.exports) {
      errors.push(`${pkg.name}: Missing exports field in package.json`)
      return { success: false, errors }
    }

    for (const [exportPath, _expectedFile] of Object.entries(pkg.exports)) {
      // Check if export is defined
      if (!packageJson.exports[exportPath]) {
        errors.push(`${pkg.name}: Missing export "${exportPath}"`)
        continue
      }

      // Check if file exists
      const exportConfig = packageJson.exports[exportPath]
      const filePath =
        typeof exportConfig === 'string'
          ? exportConfig
          : exportConfig.import || exportConfig.default

      if (!filePath) {
        errors.push(`${pkg.name}: Export "${exportPath}" has no file path`)
        continue
      }

      const fullPath = join(packagePath, filePath)
      try {
        readFileSync(fullPath, 'utf-8')
      } catch (_err) {
        errors.push(`${pkg.name}: Export "${exportPath}" points to non-existent file: ${filePath}`)
      }
    }
  } catch (err) {
    errors.push(`${pkg.name}: Failed to read package.json: ${err}`)
  }

  return {
    success: errors.length === 0,
    errors,
  }
}

async function runVerification() {
  try {
    await getProjectRoot(import.meta.url)
    logger.header('Package Export Verification')

    let allSuccess = true
    const allErrors: string[] = []

    for (const pkg of packages) {
      logger.info(`Checking ${pkg.name}...`)
      const result = verifyPackage(pkg)

      if (result.success) {
        logger.success(`  ${pkg.name} - All exports valid\n`)
      } else {
        logger.error(`  ${pkg.name} - Found ${result.errors.length} error(s):\n`)
        result.errors.forEach((error) => {
          logger.error(`    - ${error}`)
        })
        logger.info('')
        allSuccess = false
        allErrors.push(...result.errors)
      }
    }

    if (allSuccess) {
      logger.success('All package exports verified successfully!')
      process.exit(0)
    } else {
      logger.error(`Verification failed with ${allErrors.length} error(s)`)
      process.exit(1)
    }
  } catch (error) {
    logger.error(`Verification failed: ${error instanceof Error ? error.message : String(error)}`)
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
    await runVerification()
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}

main()
