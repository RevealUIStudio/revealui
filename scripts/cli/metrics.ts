#!/usr/bin/env tsx
/**
 * Metrics CLI (DEPRECATED)
 * @deprecated Use `pnpm check metrics` instead
 */
import { CheckCLI } from './check.js'
console.warn('⚠️  WARNING: The `metrics` CLI is deprecated.')
console.warn('   Please use `check` instead: pnpm check metrics\n')
const cli = new CheckCLI({ argv: process.argv.slice(2) })
await cli.run()
