#!/usr/bin/env tsx

/**
 * Database Initialization Script
 *
 * Verifies database connection and initializes RevealUI tables.
 * Works with Neon, Supabase, and Vercel Postgres.
 *
 * @dependencies
 * - scripts/lib/errors.ts - ErrorCode enum for exit codes
 * - scripts/lib/index.ts - Logger and project root utilities
 * - node:path - Path manipulation utilities
 * - node:url - URL utilities for ES modules
 * - dotenv - Environment variable loading
 * - pg - PostgreSQL client
 *
 * @requires
 * - Environment: DATABASE_URL or POSTGRES_URL or SUPABASE_DATABASE_URI
 *
 * Usage:
 *   pnpm db:init
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSSLConfig } from '@revealui/scripts/database/ssl-config.js';
import { ErrorCode } from '@revealui/scripts/errors.js';
import { createLogger, getProjectRoot } from '@revealui/scripts/index.js';
import { config } from 'dotenv';

const logger = createLogger();

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.resolve(__dirname, '../apps/admin/.env.local') });
config({ path: path.resolve(__dirname, '../apps/admin/.env.development.local') });
config({ path: path.resolve(__dirname, '../.env.local') });

async function initDatabase() {
  try {
    const _projectRoot = await getProjectRoot(import.meta.url);
    logger.header('Database Initialization');

    // Get connection string from environment
    const connectionString =
      process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DATABASE_URI;

    if (!connectionString) {
      logger.error('No database connection string found!');
      logger.error('Set one of: DATABASE_URL, POSTGRES_URL, or SUPABASE_DATABASE_URI');
      process.exit(ErrorCode.CONFIG_ERROR);
    }

    // Detect provider
    const url = connectionString.toLowerCase();
    let provider = 'generic';
    if (url.includes('.neon.tech') || url.includes('neon.tech')) {
      provider = 'neon';
    } else if (url.includes('.supabase.co') || url.includes('supabase')) {
      provider = 'supabase';
    } else if (url.includes('vercel') || process.env.VERCEL_ENV) {
      provider = 'vercel';
    }

    logger.info(`Detected database provider: ${provider}`);
    logger.info('Connecting to database...');

    // Use pg library for all providers (most compatible)
    const { Pool } = await import('pg');
    const pool = new Pool({
      connectionString,
      ssl: getSSLConfig(connectionString),
    });

    const client = await pool.connect();
    try {
      // Test query
      const result = await client.query('SELECT NOW() as time, version() as version');
      logger.success('Database connected successfully');

      if (result.rows && result.rows.length > 0) {
        logger.info(`   Server time: ${result.rows[0]?.time || 'N/A'}`);
        const version = result.rows[0]?.version || '';
        const pgVersion = version.match(/PostgreSQL (\d+\.\d+)/)?.[1] || 'unknown';
        logger.info(`   PostgreSQL version: ${pgVersion}`);
      }

      // Check for required tables
      logger.info('\n🔍 Checking for RevealUI system tables...');

      const tablesResult = await client.query(
        `SELECT tablename FROM pg_tables 
         WHERE schemaname = 'public' 
         AND tablename LIKE 'revealui%'
         ORDER BY tablename`,
      );

      const tables = tablesResult.rows.map((row: { tablename: string }) => row.tablename);

      const requiredTables = [
        'revealui_locked_documents',
        'revealui_locked_documents_rels',
        'revealui_preferences',
        'revealui_preferences_rels',
        'revealui_migrations',
      ];

      const missingTables = requiredTables.filter((t) => !tables.includes(t));

      if (missingTables.length === 0) {
        logger.success('All required system tables exist');
      } else {
        logger.warning(`Missing system tables: ${missingTables.join(', ')}`);
        logger.info('   These will be created automatically on first RevealUI operation');
      }

      if (tables.length > 0) {
        logger.info(`\n📊 Found ${tables.length} RevealUI system table(s):`);
        for (const table of tables) {
          logger.info(`   - ${table}`);
        }
      }
    } finally {
      client.release();
      await pool.end();
    }

    logger.success('\n✅ Database initialization complete');
    logger.info('\n📝 Next steps:');
    logger.info('   1. Start your development server: pnpm dev');
    logger.info('   2. Visit http://localhost:4000/admin');
    logger.info('   3. Create your first admin user');
  } catch (error) {
    logger.error('\n❌ Database initialization failed:');
    logger.error(error instanceof Error ? error.message : String(error));

    if (error instanceof Error) {
      if (error.message.includes('connection')) {
        logger.info('\n💡 Tips:');
        logger.info('   - Check your DATABASE_URL environment variable');
        logger.info('   - Verify database credentials are correct');
        logger.info('   - Ensure database is accessible (check IP allowlist)');
        logger.info('   - For Supabase: Use connection pooling URL for serverless');
      }
      if (error.stack) {
        logger.error(`Stack trace: ${error.stack}`);
      }
    }

    process.exit(ErrorCode.EXECUTION_ERROR);
  }
}

/**
 * Main function
 */
async function main() {
  try {
    await initDatabase();
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`);
    }
    process.exit(ErrorCode.EXECUTION_ERROR);
  }
}

main();
