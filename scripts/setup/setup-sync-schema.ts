#!/usr/bin/env tsx

/**
 * Setup sync schema for Supabase + ElectricSQL
 *
 * This script creates the messages table and sets up RLS policies
 * for multi-device conversation sync.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getClient } from '@revealui/db/client'
import { ErrorCode } from '../lib/errors.js'

async function setupSyncSchema() {
  console.log('🚀 Setting up sync schema for ElectricSQL...')

  try {
    // Read the SQL file
    const sqlPath = join(process.cwd(), 'scripts/setup-sync-schema.sql')
    const sql = readFileSync(sqlPath, 'utf-8')

    // Get database client
    const db = getClient('rest')

    // Split SQL into individual statements and execute
    const statements = sql
      .split(';')
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0 && !stmt.startsWith('--'))

    console.log(`📄 Executing ${statements.length} SQL statements...`)

    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`🔄 Executing: ${statement.substring(0, 60)}...`)
        await db.execute(statement)
      }
    }

    console.log('✅ Sync schema setup completed successfully!')
    console.log('📋 Next steps:')
    console.log('  1. Start ElectricSQL server: docker run -p 3001:5133 electricsql/electric')
    console.log('  2. Configure ElectricSQL with your database URL')
    console.log('  3. Test sync between browser tabs')
  } catch (error) {
    console.error('❌ Failed to setup sync schema:', error)
    process.exit(ErrorCode.EXECUTION_ERROR)
  }
}

// Run the setup
setupSyncSchema().catch(console.error)
