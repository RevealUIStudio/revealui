#!/usr/bin/env node

/**
 * Vector Database Fresh Setup Script
 *
 * Sets up a fresh Supabase vector database with pgvector extension and
 * agent_memories table. This is a fresh schema setup (not a migration).
 *
 * For pre-production: Run this to set up a fresh database.
 * For post-production: Migrations will be added when features are added.
 *
 * Usage:
 *   pnpm tsx packages/test/scripts/setup-vector-database.ts
 *   or
 *   pnpm test:memory:setup
 *
 * Note: This script is idempotent - safe to run multiple times.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getVectorClient, resetClient } from '@revealui/db'
import { sql } from 'drizzle-orm'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function checkExtension() {
  try {
    resetClient()
    const db = getVectorClient()

    const result = await db.execute(
      sql`SELECT EXISTS (
        SELECT FROM pg_extension 
        WHERE extname = 'vector'
      ) as exists`,
    )

    const exists = Array.isArray(result)
      ? (result[0] as any)?.exists
      : (result as any).rows?.[0]?.exists

    return exists === true
  } catch (error) {
    console.error('Error checking extension:', error)
    return false
  }
}

async function checkTable() {
  try {
    resetClient()
    const db = getVectorClient()

    const result = await db.execute(
      sql`SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'agent_memories'
      ) as exists`,
    )

    const exists = Array.isArray(result)
      ? (result[0] as any)?.exists
      : (result as any).rows?.[0]?.exists

    return exists === true
  } catch (error) {
    console.error('Error checking table:', error)
    return false
  }
}

async function setupSchema() {
  console.log('📦 Setting up fresh database schema...\n')

  try {
    resetClient()
    const db = getVectorClient()

    // Read schema setup file (from workspace root)
    // __dirname is packages/test/scripts, so go up 2 levels to workspace root
    const workspaceRoot = join(__dirname, '../../..')
    const schemaPath = join(workspaceRoot, 'packages/db/migrations/supabase-vector-setup.sql')

    let schemaSQL: string
    try {
      schemaSQL = readFileSync(schemaPath, 'utf-8')
    } catch (error) {
      console.error(`❌ Failed to read schema file: ${schemaPath}`)
      console.error('Error:', error)
      process.exit(1)
    }

    // Split by semicolons and execute each statement
    const statements = schemaSQL
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('--'))

    for (const statement of statements) {
      if (statement.length === 0) continue

      try {
        await db.execute(sql.raw(statement))
        console.log(`✅ Executed: ${statement.substring(0, 50)}...`)
      } catch (error) {
        // Some statements might fail if they already exist (IF NOT EXISTS)
        // This is expected and safe to ignore for idempotent setup
        const errorMessage = error instanceof Error ? error.message : String(error)
        if (
          errorMessage.includes('already exists') ||
          errorMessage.includes('duplicate') ||
          errorMessage.includes('IF NOT EXISTS')
        ) {
          console.log(`ℹ️  Skipped (already exists): ${statement.substring(0, 50)}...`)
        } else {
          console.warn(`⚠️  Warning: ${errorMessage}`)
          // Don't fail on warnings - some operations might be idempotent
        }
      }
    }

    console.log('\n✅ Schema setup completed successfully!\n')
    return true
  } catch (error) {
    console.error('❌ Schema setup failed:', error)
    return false
  }
}

async function verifySetup() {
  console.log('🔍 Verifying setup...\n')

  const extensionExists = await checkExtension()
  const tableExists = await checkTable()

  if (extensionExists && tableExists) {
    console.log('✅ pgvector extension: Installed')
    console.log('✅ agent_memories table: Exists')
    console.log('\n✅ Database setup is complete!\n')
    return true
  } else {
    if (!extensionExists) {
      console.log('❌ pgvector extension: Not installed')
    }
    if (!tableExists) {
      console.log('❌ agent_memories table: Does not exist')
    }
    return false
  }
}

async function main() {
  console.log('🚀 Vector Database Setup\n')
  console.log('='.repeat(50) + '\n')

  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set')
    console.error('Please set DATABASE_URL to your Supabase connection string')
    process.exit(1)
  }

  // Check current state
  console.log('📋 Checking current state...\n')
  const extensionExists = await checkExtension()
  const tableExists = await checkTable()

  if (extensionExists && tableExists) {
    console.log('✅ Database is already set up!')
    console.log('   - pgvector extension: Installed')
    console.log('   - agent_memories table: Exists')
    console.log('\n💡 To re-run setup, drop the table and extension first.\n')
    process.exit(0)
  }

  // Run fresh schema setup
  console.log('📦 Setting up fresh database schema...\n')

  if (!extensionExists) {
    console.log('Installing pgvector extension...')
  }
  if (!tableExists) {
    console.log('Creating agent_memories table...')
  }

  const success = await setupSchema()

  if (!success) {
    console.error('\n❌ Setup failed. Please check the errors above.')
    process.exit(1)
  }

  // Verify
  const verified = await verifySetup()

  if (verified) {
    console.log('🎉 Setup complete! You can now run the integration tests.')
    console.log('\nNext steps:')
    console.log('  pnpm test:memory:verify  # Verify setup')
    console.log('  pnpm test:memory:all     # Run all memory tests\n')
    process.exit(0)
  } else {
    console.error('\n❌ Setup verification failed. Please check the errors above.')
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('Fatal error during setup:', error)
  process.exit(1)
})
