#!/usr/bin/env tsx
/**
 * DB CLI (DEPRECATED)
 * @deprecated Use `pnpm ops db:<command>` instead
 *
 * @dependencies
 * - scripts/cli/ops.ts - Operations CLI (replacement)
 */
import { OpsCLI } from './ops.js'

console.warn('⚠️  WARNING: The `db` CLI is deprecated.')
console.warn('   Please use `ops` instead: pnpm ops db:seed\n')
const cli = new OpsCLI({ argv: process.argv.slice(2) })
await cli.run()
