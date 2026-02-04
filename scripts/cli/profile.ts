#!/usr/bin/env tsx
/**
 * Profile CLI (DEPRECATED)
 * @deprecated Use `pnpm state profile` instead
 *
 * @dependencies
 * - scripts/cli/state.ts - State CLI (replacement)
 */
import { StateCLI } from './state.js'

console.warn('⚠️  WARNING: The `profile` CLI is deprecated.')
console.warn('   Please use `state` instead: pnpm state profile\n')
const cli = new StateCLI({ argv: process.argv.slice(2) })
await cli.run()
