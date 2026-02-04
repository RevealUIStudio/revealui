#!/usr/bin/env tsx
/**
 * Build Cache CLI (DEPRECATED)
 * @deprecated Use `pnpm assets build:<command>` instead
 */
import { AssetsCLI } from './assets.js'
console.warn('⚠️  WARNING: The `build-cache` CLI is deprecated.')
console.warn('   Please use `assets` instead: pnpm assets build:cache\n')
const cli = new AssetsCLI({ argv: process.argv.slice(2) })
await cli.run()
