#!/usr/bin/env tsx
/**
 * List Rollback Checkpoints
 *
 * @dependencies
 * - scripts/lib/rollback/manager.ts - RollbackManager
 * - scripts/lib/index.js - Logger utilities
 */

import { join } from 'node:path';
import { ErrorCode } from '@revealui/scripts/errors.js';
import { getRollbackManager } from '@revealui/scripts/rollback/index.js';

const rootDir = join(import.meta.dirname, '../../..');
const manager = getRollbackManager(rootDir);

// Get checkpoints
const checkpoints = await manager.listCheckpoints();

if (checkpoints.length === 0) {
  console.log('No checkpoints found');
  process.exit(ErrorCode.SUCCESS);
}

console.log(`\n📦 Available Checkpoints (${checkpoints.length})\n`);
console.log('='.repeat(70));

for (const checkpoint of checkpoints) {
  const age = Math.floor((Date.now() - checkpoint.createdAt.getTime()) / 1000 / 60);
  const ageStr = age < 60 ? `${age}m ago` : `${Math.floor(age / 60)}h ago`;

  console.log(`\n🔖 ID: ${checkpoint.id}`);
  console.log(`   Type: ${checkpoint.type}`);
  console.log(`   Description: ${checkpoint.description}`);
  console.log(`   Created: ${checkpoint.createdAt.toLocaleString()} (${ageStr})`);
}

console.log(`\n${'='.repeat(70)}`);
console.log(`\nUse 'pnpm ops rollback:restore <id>' to restore a checkpoint`);
