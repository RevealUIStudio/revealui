#!/usr/bin/env tsx
/**
 * Deps CLI (DEPRECATED)
 * @deprecated Use `pnpm info deps` instead
 */
import { InfoCLI } from './info.js'
console.warn('⚠️  WARNING: The `deps` CLI is deprecated.')
console.warn('   Please use `info` instead: pnpm info deps\n')
const cli = new InfoCLI({ argv: process.argv.slice(2) })
await cli.run()
