#!/usr/bin/env tsx
/**
 * Type Coverage Report
 *
 * Tracks contract adoption across the codebase.
 * Now uses modularized generators from scripts/lib/generators/reports/
 *
 * Features:
 * - Contract usage in application code
 * - Schema validation coverage
 * - Type-safe vs any usage
 * - Entity contract adoption
 *
 * Usage:
 *   pnpm types:coverage-report           # Display report
 *   pnpm types:coverage-report markdown  # Generate markdown
 *   pnpm types:coverage-report json      # Output JSON
 *
 * @dependencies
 * - scripts/lib/generators/reports - Modularized coverage and formatting
 */

import { join } from 'node:path'
import {
  displayReport,
  generateReport,
  saveMarkdownReport,
  saveReport,
} from '../lib/generators/reports/index.js'

const rootDir = join(import.meta.dirname, '../..')

// =============================================================================
// Main CLI
// =============================================================================

const command = process.argv[2] || 'report'

if (command === 'report' || command === 'analyze') {
  const stats = await generateReport({ rootDir })
  displayReport(stats)
  saveReport(stats, { rootDir })
} else if (command === 'markdown' || command === 'md') {
  const stats = await generateReport({ rootDir })
  saveMarkdownReport(stats, { rootDir })
} else if (command === 'json') {
  const stats = await generateReport({ rootDir, verbose: false })
  console.log(JSON.stringify(stats, null, 2))
} else {
  console.log('Type Coverage Report\n')
  console.log('Usage:')
  console.log('  pnpm types:coverage-report          # Display report')
  console.log('  pnpm types:coverage-report markdown # Generate markdown')
  console.log('  pnpm types:coverage-report json     # Output JSON')
  console.log()
}
