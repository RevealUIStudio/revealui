#!/usr/bin/env tsx
/**
 * Migrate CLI (DEPRECATED)
 * @deprecated Use `pnpm ops migrate:<command>` instead
 *
 * @dependencies
 * - scripts/cli/ops.ts - Operations CLI (replacement)
 */
import { OpsCLI } from './ops.js'

console.warn('⚠️  WARNING: The `migrate` CLI is deprecated.')
console.warn('   Please use `ops` instead: pnpm ops migrate:plan\n')
const cli = new OpsCLI({ argv: process.argv.slice(2) })
await cli.run()
