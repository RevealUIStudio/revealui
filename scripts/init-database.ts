#!/usr/bin/env node
/**
 * Database Initialization Script
 *
 * Verifies database connection and initializes RevealUI tables.
 * Works with Neon, Supabase, and Vercel Postgres.
 */

import { config } from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables
config({ path: path.resolve(__dirname, '../apps/cms/.env.local') })
config({ path: path.resolve(__dirname, '../apps/cms/.env.development.local') })
config({ path: path.resolve(__dirname, '../.env.local') })

async function initDatabase() {
  try {
    // Get connection string from environment
    const connectionString =
      process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DATABASE_URI

    if (!connectionString) {
      console.error('❌ No database connection string found!')
      console.error('   Set one of: DATABASE_URL, POSTGRES_URL, or SUPABASE_DATABASE_URI')
      process.exit(1)
    }

    // Detect provider
    const url = connectionString.toLowerCase()
    let provider = 'generic'
    if (url.includes('.neon.tech') || url.includes('neon.tech')) {
      provider = 'neon'
    } else if (url.includes('.supabase.co') || url.includes('supabase')) {
      provider = 'supabase'
    } else if (url.includes('vercel') || process.env.VERCEL_ENV) {
      provider = 'vercel'
    }

    console.log(`🔍 Detected database provider: ${provider}`)
    console.log('🔄 Connecting to database...')

    // Use pg library for all providers (most compatible)
    const { Pool } = await import('pg')
    const pool = new Pool({
      connectionString,
      ssl:
        connectionString.includes('sslmode=require') || connectionString.includes('ssl=true')
          ? { rejectUnauthorized: false }
          : undefined,
    })

    const client = await pool.connect()
    try {
      // Test query
      const result = await client.query('SELECT NOW() as time, version() as version')
      console.log('✅ Database connected successfully')

      if (result.rows && result.rows.length > 0) {
        console.log(`   Server time: ${result.rows[0]?.time || 'N/A'}`)
        const version = result.rows[0]?.version || ''
        const pgVersion = version.match(/PostgreSQL (\d+\.\d+)/)?.[1] || 'unknown'
        console.log(`   PostgreSQL version: ${pgVersion}`)
      }

      // Check for required tables
      console.log('\n🔍 Checking for RevealUI system tables...')

      const tablesResult = await client.query(
        `SELECT tablename FROM pg_tables 
         WHERE schemaname = 'public' 
         AND tablename LIKE 'revealui%'
         ORDER BY tablename`
      )

      const tables = tablesResult.rows.map((row: { tablename: string }) => row.tablename)

      const requiredTables = [
        'revealui_locked_documents',
        'revealui_locked_documents_rels',
        'revealui_preferences',
        'revealui_preferences_rels',
        'revealui_migrations',
      ]

      const missingTables = requiredTables.filter((t) => !tables.includes(t))

      if (missingTables.length === 0) {
        console.log('✅ All required system tables exist')
      } else {
        console.log(`⚠️  Missing system tables: ${missingTables.join(', ')}`)
        console.log('   These will be created automatically on first RevealUI operation')
      }

      if (tables.length > 0) {
        console.log(`\n📊 Found ${tables.length} RevealUI system table(s):`)
        for (const table of tables) {
          console.log(`   - ${table}`)
        }
      }
    } finally {
      client.release()
      await pool.end()
    }

    console.log('\n✅ Database initialization complete')
    console.log('\n📝 Next steps:')
    console.log('   1. Start your development server: pnpm dev')
    console.log('   2. Visit http://localhost:4000/admin')
    console.log('   3. Create your first admin user')

    process.exit(0)
  } catch (error) {
    console.error('\n❌ Database initialization failed:')
    console.error(error)

    if (error instanceof Error) {
      if (error.message.includes('connection')) {
        console.error('\n💡 Tips:')
        console.error('   - Check your DATABASE_URL environment variable')
        console.error('   - Verify database credentials are correct')
        console.error('   - Ensure database is accessible (check IP allowlist)')
        console.error('   - For Supabase: Use connection pooling URL for serverless')
      }
    }

    process.exit(1)
  }
}

initDatabase()
