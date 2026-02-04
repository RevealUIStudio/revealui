#!/usr/bin/env tsx
/**
 * Rollback CLI (DEPRECATED)
 * @deprecated Use `pnpm ops rollback` instead
 *
 * @dependencies
 * - scripts/cli/ops.ts - Operations CLI (replacement)
 */
import { OpsCLI } from './ops.js'

console.warn('⚠️  WARNING: The `rollback` CLI is deprecated.')
console.warn('   Please use `ops` instead: pnpm ops rollback\n')
const cli = new OpsCLI({ argv: process.argv.slice(2) })
await cli.run()
