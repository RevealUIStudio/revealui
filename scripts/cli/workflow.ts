#!/usr/bin/env tsx
/**
 * Workflow CLI (DEPRECATED)
 * @deprecated Use `pnpm state workflow:<command>` instead
 *
 * @dependencies
 * - scripts/cli/state.ts - State CLI (replacement)
 */
import { StateCLI } from './state.js'

console.warn('⚠️  WARNING: The `workflow` CLI is deprecated.')
console.warn('   Please use `state` instead: pnpm state workflow:start\n')
const cli = new StateCLI({ argv: process.argv.slice(2) })
await cli.run()
