#!/usr/bin/env tsx

/**
 * Fresh Database Setup Script
 *
 * Resets the database and creates all tables from the current Drizzle schema.
 * This includes the passwordHash field in the users table.
 *
 * Usage:
 *   pnpm db:fresh
 *
 * WARNING: This will drop all existing tables and data!
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import { createLogger, validateDependencies } from '../shared/utils.js'

const logger = createLogger()

// Load environment variables
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
// Try multiple env file locations
config({ path: path.resolve(__dirname, '../../apps/cms/.env.local') })
config({
  path: path.resolve(__dirname, '../../apps/cms/.env.development.local'),
})
config({ path: path.resolve(__dirname, '../../apps/cms/.env') })
config({ path: path.resolve(__dirname, '../../.env.local') })
config({ path: path.resolve(__dirname, '../../.env') })
// Also load from process.env (may be set by shell)

async function setupFreshDatabase() {
  try {
    logger.header('Fresh Database Setup')

    // Validate dependencies
    await validateDependencies(['pg', 'dotenv'], {
      installCommand: 'pnpm add pg dotenv',
      customMessage: (missing) =>
        `Missing required packages: ${missing.join(', ')}\nInstall with: pnpm add pg dotenv`,
      importMetaUrl: import.meta.url,
    })

    // Get connection string from environment
    const connectionString =
      process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DATABASE_URI

    if (!connectionString) {
      logger.error('No database connection string found!')
      logger.error('Set one of: DATABASE_URL, POSTGRES_URL, or SUPABASE_DATABASE_URI')
      process.exit(1)
    }

    logger.warning('⚠️  WARNING: This will drop all existing tables and data!')
    logger.info(`Database: ${connectionString.split('@')[1]?.split('/')[0] || 'unknown'}`)

    // Use pg library for direct SQL execution
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
      // Test connection
      await client.query('SELECT NOW()')
      logger.success('Database connected successfully')

      // Step 1: Enable required extensions
      logger.info('\n📋 Step 1: Enabling required extensions...')
      try {
        await client.query('CREATE EXTENSION IF NOT EXISTS vector;')
        logger.success('pgvector extension enabled')
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : ''
        if (message.includes('permission denied')) {
          logger.warning('Could not enable vector extension (may need superuser)')
          logger.info(
            '   Continuing anyway - vector columns may fail if extension is not available',
          )
        } else {
          throw error
        }
      }

      // Step 2: Drop all existing tables
      logger.info('\n📋 Step 2: Dropping all existing tables...')
      await client.query(`
        DO $$ DECLARE
          r RECORD;
        BEGIN
          FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
            EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
          END LOOP;
        END $$;
      `)
      logger.success('All tables dropped')

      // Step 3: Run initial migration (creates all tables with current schema)
      logger.info('\n📋 Step 3: Creating tables from schema...')
      const migrationPath = path.resolve(
        __dirname,
        '../../packages/db/drizzle/0000_misty_pepper_potts.sql',
      )

      // Read and execute the initial migration
      const fs = await import('node:fs')
      const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')
      await client.query(migrationSQL)
      logger.success('Initial migration applied')

      // Step 3: Apply password_hash migration (adds column and indexes)
      logger.info('\n📋 Step 3: Applying password_hash migration...')
      const passwordHashMigrationPath = path.resolve(
        __dirname,
        '../../packages/db/drizzle/0001_add_password_hash.sql',
      )

      const passwordHashSQL = fs.readFileSync(passwordHashMigrationPath, 'utf-8')

      // Execute each statement separately to handle errors gracefully
      const statements = passwordHashSQL
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith('--'))

      for (const stmt of statements) {
        try {
          await client.query(`${stmt};`)
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : ''
          // Column/index might already exist, that's okay
          if (message.includes('already exists') || message.includes('duplicate')) {
            logger.info(`   Skipping (already exists): ${stmt.substring(0, 50)}...`)
          } else {
            throw error
          }
        }
      }
      logger.success('Password hash migration applied')

      // Step 4b: Apply email uniqueness constraint
      logger.info('\n📋 Step 4b: Applying email uniqueness constraint...')
      const emailUniqueMigrationPath = path.resolve(
        __dirname,
        '../../packages/db/drizzle/0002_add_email_unique_constraint.sql',
      )

      if (fs.existsSync(emailUniqueMigrationPath)) {
        const emailUniqueSQL = fs.readFileSync(emailUniqueMigrationPath, 'utf-8')
        const emailStatements = emailUniqueSQL
          .split(';')
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && !s.startsWith('--'))

        for (const stmt of emailStatements) {
          try {
            await client.query(`${stmt};`)
          } catch (error: unknown) {
            const message = error instanceof Error ? error.message : ''
            if (message.includes('already exists') || message.includes('duplicate')) {
              logger.info(`   Skipping (already exists): ${stmt.substring(0, 50)}...`)
            } else {
              throw error
            }
          }
        }
        logger.success('Email uniqueness constraint applied')
      }

      // Step 5: Verify schema
      logger.info('\n📋 Step 5: Verifying schema...')
      const usersTableResult = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users'
        ORDER BY ordinal_position
      `)

      const hasPasswordHash = usersTableResult.rows.some(
        // biome-ignore lint/style/useNamingConvention: Database column name.
        (row: { column_name?: string }) => row.column_name === 'password_hash',
      )

      if (hasPasswordHash) {
        logger.success('✅ users table has password_hash column')
      } else {
        logger.error('❌ users table missing password_hash column')
        logger.info('Applying ALTER TABLE to add password_hash...')
        await client.query('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_hash" text;')
        logger.success('password_hash column added')
      }

      // Check sessions table
      const sessionsTableResult = await client.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'sessions'
        ORDER BY ordinal_position
      `)

      if (sessionsTableResult.rows.length > 0) {
        logger.success('✅ sessions table exists')
      } else {
        logger.error('❌ sessions table missing')
      }

      // List all tables
      const tablesResult = await client.query(`
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY tablename
      `)

      logger.info(`\n📊 Created ${tablesResult.rows.length} table(s):`)
      for (const row of tablesResult.rows) {
        logger.info(`   - ${row.tablename}`)
      }
    } finally {
      client.release()
      await pool.end()
    }

    logger.success('\n✅ Fresh database setup complete!')
    logger.info('\n📝 Next steps:')
    logger.info('   1. Start your development server: pnpm dev')
    logger.info('   2. Visit http://localhost:4000/admin')
    logger.info('   3. Create your first admin user with the new auth system')
  } catch (error) {
    logger.error('\n❌ Database setup failed:')
    logger.error(error instanceof Error ? error.message : String(error))

    if (error instanceof Error) {
      if (error.message.includes('connection')) {
        logger.info('\n💡 Tips:')
        logger.info('   - Check your DATABASE_URL environment variable')
        logger.info('   - Verify database credentials are correct')
        logger.info('   - Ensure database is accessible (check IP allowlist)')
      }
      if (error.stack) {
        logger.error(`Stack trace: ${error.stack}`)
      }
    }

    process.exit(1)
  }
}

/**
 * Main function
 */
async function main() {
  try {
    await setupFreshDatabase()
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`)
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`)
    }
    process.exit(1)
  }
}

main()
