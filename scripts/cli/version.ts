#!/usr/bin/env tsx
/**
 * Version CLI (DEPRECATED)
 * @deprecated Use `pnpm info version` instead

 * @dependencies
 * - scripts/cli/info.ts - Info CLI (replacement)
 */
import { InfoCLI } from './info.js'

console.warn('⚠️  WARNING: The `version` CLI is deprecated.')
console.warn('   Please use `info` instead: pnpm info version\n')
const cli = new InfoCLI({ argv: process.argv.slice(2) })
await cli.run()
