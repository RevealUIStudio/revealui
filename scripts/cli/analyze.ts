#!/usr/bin/env tsx

/**
 * Analyze CLI (DEPRECATED)
 *
 * @deprecated This CLI has been consolidated into the `check` CLI.
 * Please use `pnpm check <command>` instead of `pnpm analyze <command>`.
 *
 * Migration examples:
 *   pnpm analyze              →  pnpm check analyze
 *   pnpm analyze console      →  pnpm check analyze:console
 *   pnpm analyze imports      →  pnpm check analyze:imports
 *
 * This wrapper will be removed in a future release.
 */

import { CheckCLI } from './check.js'

// Show deprecation warning
console.warn('⚠️  WARNING: The `analyze` CLI is deprecated.')
console.warn('   Please use `check` instead:')
console.warn('   Example: pnpm check analyze\n')

// Forward to CheckCLI
const cli = new CheckCLI({ argv: process.argv.slice(2) })
await cli.run()
