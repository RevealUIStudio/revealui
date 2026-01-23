#!/usr/bin/env node

/**
 * Setup sync schema for Supabase + ElectricSQL
 *
 * Simple script that runs SQL directly using postgres client
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import postgres from 'postgres'

async function setupSyncSchema() {
  console.log('🚀 Setting up sync schema for ElectricSQL...')

  // Database connection
  const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres.erzpwtonzoyvvpplzxxd:cHKjtxgsg8zFPF8Y@aws-0-us-west-2.pooler.supabase.com:6543/postgres'

  const sql = postgres(databaseUrl, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
  })

  try {
    // Read the SQL file
    const sqlPath = join(process.cwd(), 'scripts/setup-sync-schema.sql')
    const sqlContent = readFileSync(sqlPath, 'utf-8')

    // Split SQL into individual statements
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))

    console.log(`📄 Executing ${statements.length} SQL statements...`)

    // Execute each statement
    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`🔄 Executing: ${statement.substring(0, 60)}...`)
        await sql.unsafe(statement)
      }
    }

    console.log('✅ Sync schema setup completed successfully!')
    console.log('📋 Next steps:')
    console.log('  1. Start ElectricSQL server with proper database URL')
    console.log('  2. Test sync between browser tabs')

  } catch (error) {
    console.error('❌ Failed to setup sync schema:', error)
    process.exit(1)
  } finally {
    await sql.end()
  }
}

// Run the setup
setupSyncSchema().catch(console.error)