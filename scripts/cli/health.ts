#!/usr/bin/env tsx
/**
 * Health CLI (DEPRECATED)
 * @deprecated Use `pnpm check health` instead
 *
 * @dependencies
 * - scripts/cli/check.ts - Check CLI (replacement)
 */
import { CheckCLI } from './check.js'

console.warn('⚠️  WARNING: The `health` CLI is deprecated.')
console.warn('   Please use `check` instead: pnpm check health\n')
const cli = new CheckCLI({ argv: process.argv.slice(2) })
await cli.run()
