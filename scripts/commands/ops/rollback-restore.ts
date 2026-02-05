#!/usr/bin/env tsx
/**
 * Restore from Rollback Checkpoint
 *
 * @dependencies
 * - scripts/lib/rollback/manager.ts - RollbackManager
 * - scripts/lib/errors.ts - ErrorCode
 * - scripts/lib/index.js - Logger utilities
 */

import { join } from 'node:path'
import { ErrorCode } from '../../lib/errors.js'
import { createLogger } from '../../lib/index.js'
import { getRollbackManager } from '../../lib/rollback/index.js'

const _logger = createLogger({ prefix: 'Rollback' })

const rootDir = join(import.meta.dirname, '../../..')
const manager = getRollbackManager(rootDir)

// Parse arguments
const checkpointId = process.argv[2]
const dryRun = process.argv.includes('--dry-run')

if (!checkpointId || checkpointId === '--dry-run') {
  console.error('Usage: pnpm ops rollback:restore <checkpoint-id> [--dry-run]')
  console.error('\nExample:')
  console.error('  pnpm ops rollback:restore abc123-def456')
  console.error('  pnpm ops rollback:restore abc123-def456 --dry-run')
  process.exit(ErrorCode.VALIDATION_ERROR)
}

// Execute rollback
const result = await manager.rollback(checkpointId, { dryRun, verbose: true })

if (!result.success) {
  console.error(`\n❌ Rollback failed: ${result.error}`)
  process.exit(ErrorCode.EXECUTION_ERROR)
}

if (dryRun) {
  console.log('\n✅ Dry run successful - no changes made')
} else {
  console.log('\n✅ Rollback completed successfully')
}

process.exit(ErrorCode.SUCCESS)
