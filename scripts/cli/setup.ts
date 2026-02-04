#!/usr/bin/env tsx
/**
 * Setup CLI (DEPRECATED)
 * @deprecated Use `pnpm ops setup:<command>` instead
 *
 * @dependencies
 * - scripts/cli/ops.ts - Operations CLI (replacement)
 */
import { OpsCLI } from './ops.js'

console.warn('⚠️  WARNING: The `setup` CLI is deprecated.')
console.warn('   Please use `ops` instead: pnpm ops setup:env\n')
const cli = new OpsCLI({ argv: process.argv.slice(2) })
await cli.run()
