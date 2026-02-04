#!/usr/bin/env tsx
/**
 * Registry CLI (DEPRECATED)
 * @deprecated Use `pnpm state registry:<command>` instead
 */
import { StateCLI } from './state.js'
console.warn('⚠️  WARNING: The `registry` CLI is deprecated.')
console.warn('   Please use `state` instead: pnpm state registry:list\n')
const cli = new StateCLI({ argv: process.argv.slice(2) })
await cli.run()
