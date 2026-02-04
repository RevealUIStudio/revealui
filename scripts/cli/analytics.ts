#!/usr/bin/env tsx
/**
 * Analytics CLI (DEPRECATED)
 * @deprecated Use `pnpm info analytics` instead
 */
import { InfoCLI } from './info.js'
console.warn('⚠️  WARNING: The `analytics` CLI is deprecated.')
console.warn('   Please use `info` instead: pnpm info analytics\n')
const cli = new InfoCLI({ argv: process.argv.slice(2) })
await cli.run()
