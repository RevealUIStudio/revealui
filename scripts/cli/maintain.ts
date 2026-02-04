#!/usr/bin/env tsx

/**
 * Maintenance CLI (DEPRECATED)
 *
 * @deprecated This CLI has been consolidated into the `ops` CLI.
 * Please use `pnpm ops <command>` instead of `pnpm maintain <command>`.
 *
 * Migration examples:
 *   pnpm maintain fix-imports  →  pnpm ops fix-imports
 *   pnpm maintain fix-lint     →  pnpm ops fix-lint
 *   pnpm maintain clean        →  pnpm ops clean
 *
 * This wrapper will be removed in a future release.
 *
 * @dependencies
 * - scripts/cli/ops.ts - Operations CLI (replacement)
 */

import { OpsCLI } from './ops.js'

// Show deprecation warning
console.warn('⚠️  WARNING: The `maintain` CLI is deprecated.')
console.warn('   Please use `ops` instead:')
console.warn('   Example: pnpm ops fix-imports\n')

// Forward to OpsCLI
const cli = new OpsCLI({ argv: process.argv.slice(2) })
await cli.run()
