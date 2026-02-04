#!/usr/bin/env tsx
/**
 * Explore CLI (DEPRECATED)
 * @deprecated Use `pnpm info explore` instead
 */
import { InfoCLI } from './info.js'
console.warn('⚠️  WARNING: The `explore` CLI is deprecated.')
console.warn('   Please use `info` instead: pnpm info explore\n')
const cli = new InfoCLI({ argv: process.argv.slice(2) })
await cli.run()
