#!/usr/bin/env tsx

/**
 * Documentation Content Generation Tool
 *
 * Consolidated tool for documentation generation and quality analysis.
 * Now uses modularized generators from scripts/lib/generators/content/
 *
 * Commands:
 * - api      - Generate OpenAPI spec from route files
 * - readme   - Generate package READMEs
 * - extract  - Extract JSDoc documentation
 * - workflow - Run documentation quality assessment workflow
 *
 * Usage:
 *   pnpm tsx scripts/generate/generate-content.ts api
 *   pnpm tsx scripts/generate/generate-content.ts readme
 *   pnpm tsx scripts/generate/generate-content.ts extract
 *   pnpm tsx scripts/generate/generate-content.ts workflow
 *
 * @dependencies
 * - scripts/lib/generators/content - Modularized generators
 * - scripts/lib/index.js - Logger and utilities
 */

import { ErrorCode } from '../lib/errors.js'
import {
  extractAPIDocs,
  generateAPIDocs,
  generatePackageReadmes,
  runAssessmentWorkflow,
} from '../lib/generators/content/index.js'
import { createLogger } from '../lib/index.js'

const logger = createLogger({ prefix: 'DocGen' })

// =============================================================================
// Main CLI
// =============================================================================

const command = process.argv[2]

if (!command) {
  showHelp()
  process.exit(ErrorCode.SUCCESS)
}

switch (command) {
  case 'api':
    await generateAPIDocs()
    break

  case 'readme':
    await generatePackageReadmes()
    break

  case 'extract':
    await extractAPIDocs()
    break

  case 'workflow':
    await runAssessmentWorkflow()
    break

  default:
    logger.error(`Unknown command: ${command}`)
    showHelp()
    process.exit(ErrorCode.INVALID_INPUT)
}

// =============================================================================
// Help
// =============================================================================

function showHelp() {
  console.log(`
Documentation Content Generation Tool

Usage:
  pnpm tsx scripts/generate/generate-content.ts <command>

Commands:
  api       Generate OpenAPI specification from route files
  readme    Generate package README files
  extract   Extract JSDoc documentation from source files
  workflow  Run complete documentation assessment workflow

Examples:
  pnpm tsx scripts/generate/generate-content.ts api
  pnpm tsx scripts/generate/generate-content.ts readme
  pnpm tsx scripts/generate/generate-content.ts workflow

All generated files are saved to the docs/ directory.
`)
}
