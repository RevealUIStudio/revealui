#!/usr/bin/env tsx
/**
 * Types CLI (DEPRECATED)
 * @deprecated Use `pnpm assets types:<command>` instead
 *
 * @dependencies
 * - scripts/cli/assets.ts - Assets CLI (replacement)
 */
import { AssetsCLI } from './assets.js'

console.warn('⚠️  WARNING: The `types` CLI is deprecated.')
console.warn('   Please use `assets` instead: pnpm assets types:generate\n')
const cli = new AssetsCLI({ argv: process.argv.slice(2) })
await cli.run()
