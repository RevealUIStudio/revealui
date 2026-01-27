#!/usr/bin/env tsx

/**
 * API Documentation Generator
 *
 * Generates API documentation from TypeScript source files.
 * Extracts JSDoc comments, types, and generates markdown documentation.
 *
 * Usage:
 *   pnpm docs:generate:api
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import {createLogger,getProjectRoot} from '../../../packages/core/src/.scripts/utils.ts'
import {extractFromPackage,type PackageApi} from './api-doc-extractor.ts'
import {generateIndexMarkdown,generatePackageMarkdown} from './api-doc-template.ts'

const logger = createLogger()

// Packages to document
const PACKAGES_TO_DOCUMENT = [
  { name: '@revealui/core', path: 'packages/core/src' },
  { name: '@revealui/contracts', path: 'packages/contracts/src' },
  { name: '@revealui/db', path: 'packages/db/src' },
]

async function generateApiDocs(): Promise<void> {
  const projectRoot = await getProjectRoot(import.meta.url)
  const apiDocsDir = path.join(projectRoot, 'docs/api')

  logger.header('API Documentation Generation')

  // Create API docs directory
  await fs.mkdir(apiDocsDir, { recursive: true })

  const packages: PackageApi[] = []

  // Generate docs for each package
  for (const pkg of PACKAGES_TO_DOCUMENT) {
    const packagePath = path.join(projectRoot, pkg.path)

    try {
      logger.info(`Extracting API from ${pkg.name}...`)
      const packageApi = await extractFromPackage(packagePath, pkg.name)
      packages.push(packageApi)

      logger.info(`  Found ${packageApi.entities.length} public entities`)

      // Generate package documentation
      const packageDocDir = path.join(apiDocsDir, pkg.name.replace('@', '').replace('/', '-'))
      await fs.mkdir(packageDocDir, { recursive: true })

      const packageMarkdown = generatePackageMarkdown(packageApi)
      const packageDocPath = path.join(packageDocDir, 'README.md')
      await fs.writeFile(packageDocPath, packageMarkdown, 'utf-8')

      logger.success(`  ✅ Generated: ${path.relative(projectRoot, packageDocPath)}`)
    } catch (error) {
      logger.error(
        `  ❌ Failed to process ${pkg.name}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  // Generate index
  logger.info('\nGenerating API index...')
  const indexMarkdown = generateIndexMarkdown(packages)
  const indexPath = path.join(apiDocsDir, 'README.md')
  await fs.writeFile(indexPath, indexMarkdown, 'utf-8')
  logger.success(`✅ Generated: ${path.relative(projectRoot, indexPath)}`)

  logger.info(`\n\nAPI documentation generation complete!`)
  logger.info(`  Packages documented: ${packages.length}`)
  logger.info(`  Total entities: ${packages.reduce((sum, pkg) => sum + pkg.entities.length, 0)}`)
  logger.info(`  Output directory: docs/api/`)
}

async function main() {
  try {
    await generateApiDocs()
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`)
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`)
    }
    process.exit(1)
  }
}

main()
