#!/usr/bin/env tsx
/**
 * Validate CLI (DEPRECATED)
 * @deprecated Use `pnpm check validate` instead
 *
 * @dependencies
 * - scripts/cli/check.ts - Check CLI (replacement)
 */
import { CheckCLI } from './check.js'

console.warn('⚠️  WARNING: The `validate` CLI is deprecated.')
console.warn('   Please use `check` instead: pnpm check validate\n')
const cli = new CheckCLI({ argv: process.argv.slice(2) })
await cli.run()
