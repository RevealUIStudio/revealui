#!/usr/bin/env tsx
/**
 * Clear Old Rollback Checkpoints
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
const confirmFlag = process.argv.includes('--confirm')
const cleanOld = process.argv.includes('--old-only')

if (cleanOld) {
  // Clean only old checkpoints (> 7 days)
  const deleted = await manager.cleanupOldCheckpoints()
  console.log(`\n✅ Cleaned up ${deleted} old checkpoints`)
  process.exit(ErrorCode.SUCCESS)
}

// Clear all checkpoints
if (!confirmFlag) {
  console.log('⚠️  This will delete ALL rollback checkpoints!')
  console.log('\nUse --confirm flag to proceed:')
  console.log('  pnpm ops rollback:clear --confirm')
  console.log('\nOr use --old-only to clean only old checkpoints:')
  console.log('  pnpm ops rollback:clear --old-only')
  process.exit(ErrorCode.SUCCESS)
}

const deleted = await manager.clearAllCheckpoints(true)
console.log(`\n✅ Cleared ${deleted} checkpoints`)
process.exit(ErrorCode.SUCCESS)
