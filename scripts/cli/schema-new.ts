#!/usr/bin/env tsx
/**
 * Schema CLI (DEPRECATED)
 * @deprecated Use `pnpm assets schema:<command>` instead
 */
import { AssetsCLI } from './assets.js'
console.warn('⚠️  WARNING: The `schema-new` CLI is deprecated.')
console.warn('   Please use `assets` instead: pnpm assets schema:create\n')
const cli = new AssetsCLI({ argv: process.argv.slice(2) })
await cli.run()
