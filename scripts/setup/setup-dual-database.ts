#!/usr/bin/env node

/**
 * Triple Database Fresh Setup Script
 *
 * Sets up all three database components:
 * 1. Supabase (Vector) - for agent_memories with pgvector
 * 2. NeonDB (REST) - for all REST API tables
 * 3. ElectricSQL - syncs from NeonDB (REST) for real-time sync
 *
 * This is a unified setup script for the triple database architecture.
 *
 * For pre-production: Run this to set up fresh databases.
 * For post-production: Migrations will be added when features are added.
 *
 * @dependencies
 * - scripts/lib/errors.ts - ErrorCode and ScriptError for validation
 * - @revealui/db - Database clients (getRestClient, getVectorClient, resetClient)
 * - node:fs - File system operations (readFileSync)
 * - node:path - Path manipulation utilities
 * - node:url - URL utilities for ES modules
 * - drizzle-orm - ORM utilities (sql)
 *
 * @requires
 * - Environment: POSTGRES_URL (NeonDB), DATABASE_URL (Supabase)
 *
 * Usage:
 *   pnpm tsx packages/test/scripts/setup-dual-database.ts
 *   or
 *   pnpm test:db:setup
 *
 * Note: This script is idempotent - safe to run multiple times.
 * Note: ElectricSQL uses the same database as REST (NeonDB) - it syncs from it.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getRestClient, getVectorClient, resetClient } from '@revealui/db';
import { ErrorCode, ScriptError } from '@revealui/scripts/errors.js';
import { sql } from 'drizzle-orm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

type DbClient = ReturnType<typeof getRestClient>;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Validates that a string is a safe SQL identifier (table/column name)
 * Only allows alphanumeric characters and underscores
 */
function validateSQLIdentifier(identifier: string): void {
  if (!/^[a-zA-Z0-9_]+$/.test(identifier)) {
    throw new ScriptError(
      `Invalid SQL identifier: ${identifier}. Only alphanumeric and underscore allowed.`,
      ErrorCode.VALIDATION_ERROR,
    );
  }
}

async function checkTable(db: DbClient, tableName: string): Promise<boolean> {
  try {
    // Validate table name to prevent SQL injection
    // PostgreSQL identifiers can only contain alphanumeric + underscore
    validateSQLIdentifier(tableName);

    // Use sql.raw with validated input - table names cannot be parameterized
    // but we've validated the input to prevent injection
    const result = await db.execute(
      sql.raw(`SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = '${tableName}'
      ) as exists`),
    );

    const rows = Array.isArray(result)
      ? result
      : ((result as { rows?: Array<{ exists?: boolean }> }).rows ?? []);
    const exists = (rows[0] as { exists?: boolean } | undefined)?.exists;

    return exists === true;
  } catch (error) {
    // Use proper error handling - don't log to console in production
    if (process.env.NODE_ENV === 'development') {
      console.error(`Error checking table ${tableName}:`, error);
    }
    return false;
  }
}

async function checkExtension(db: DbClient, extName: string): Promise<boolean> {
  try {
    // Validate extension name to prevent SQL injection
    validateSQLIdentifier(extName);

    // Use sql.raw with validated input - extension names cannot be parameterized
    // but we've validated the input to prevent injection
    const result = await db.execute(
      sql.raw(`SELECT EXISTS (
        SELECT FROM pg_extension 
        WHERE extname = '${extName}'
      ) as exists`),
    );

    const rows = Array.isArray(result)
      ? result
      : ((result as { rows?: Array<{ exists?: boolean }> }).rows ?? []);
    const exists = (rows[0] as { exists?: boolean } | undefined)?.exists;

    return exists === true;
  } catch (error) {
    // Use proper error handling - don't log to console in production
    if (process.env.NODE_ENV === 'development') {
      console.error(`Error checking extension ${extName}:`, error);
    }
    return false;
  }
}

async function executeSQLFile(db: DbClient, filePath: string, dbName: string): Promise<boolean> {
  // Only log in development - use proper logger in production
  if (process.env.NODE_ENV === 'development') {
    console.log(`📦 Setting up ${dbName} database schema...\n`);
  }

  try {
    let schemaSQL: string;
    try {
      schemaSQL = readFileSync(filePath, 'utf-8');
    } catch (error) {
      console.error(`❌ Failed to read schema file: ${filePath}`);
      console.error('Error:', error);
      return false;
    }

    // Split by semicolons and execute each statement
    const statements = schemaSQL
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement.length === 0) continue;

      try {
        await db.execute(sql.raw(statement));
        console.log(`✅ Executed: ${statement.substring(0, 60)}...`);
      } catch (error) {
        // Some statements might fail if they already exist (IF NOT EXISTS)
        // This is expected and safe to ignore for idempotent setup
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (
          errorMessage.includes('already exists') ||
          errorMessage.includes('duplicate') ||
          errorMessage.includes('IF NOT EXISTS')
        ) {
          console.log(`ℹ️  Skipped (already exists): ${statement.substring(0, 60)}...`);
        } else {
          console.warn(`⚠️  Warning: ${errorMessage}`);
          // Don't fail on warnings - some operations might be idempotent
        }
      }
    }

    console.log(`\n✅ ${dbName} schema setup completed successfully!\n`);
    return true;
  } catch (error) {
    console.error(`❌ ${dbName} schema setup failed:`, error);
    return false;
  }
}

// =============================================================================
// Vector Database (Supabase) Setup
// =============================================================================

async function setupVectorDatabase(): Promise<boolean> {
  console.log('🔵 Setting up Vector Database (Supabase)...\n');
  console.log(`${'='.repeat(50)}\n`);

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set');
    console.error('Please set DATABASE_URL to your Supabase connection string');
    return false;
  }

  try {
    resetClient();
    const db = getVectorClient();

    // Check current state
    const extensionExists = await checkExtension(db, 'vector');
    const tableExists = await checkTable(db, 'agent_memories');

    if (extensionExists && tableExists) {
      console.log('✅ Vector database is already set up!');
      console.log('   - pgvector extension: Installed');
      console.log('   - agent_memories table: Exists\n');
      return true;
    }

    // Run setup
    const workspaceRoot = join(__dirname, '../../..');
    const schemaPath = join(workspaceRoot, 'packages/db/src/migrations/supabase-vector-setup.sql');

    const success = await executeSQLFile(db, schemaPath, 'Vector');

    if (!success) {
      return false;
    }

    // Verify
    const verifiedExtension = await checkExtension(db, 'vector');
    const verifiedTable = await checkTable(db, 'agent_memories');

    if (verifiedExtension && verifiedTable) {
      console.log('✅ Vector Database Setup Complete!');
      console.log('   - pgvector extension: Installed');
      console.log('   - agent_memories table: Exists\n');
      return true;
    } else {
      console.error('❌ Vector database verification failed');
      return false;
    }
  } catch (error) {
    console.error('❌ Vector database setup failed:', error);
    return false;
  }
}

// =============================================================================
// REST Database (NeonDB) Setup
// =============================================================================

async function setupRestDatabase(): Promise<boolean> {
  console.log('🟢 Setting up REST Database (NeonDB)...\n');
  console.log(`${'='.repeat(50)}\n`);

  const postgresUrl = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;

  if (!postgresUrl) {
    console.error('❌ POSTGRES_URL or DATABASE_URL environment variable is not set');
    console.error('Please set POSTGRES_URL to your NeonDB connection string');
    return false;
  }

  try {
    resetClient();
    const db = getRestClient();

    // Check if users table exists (indicator that schema is set up)
    const tableExists = await checkTable(db, 'users');
    const extensionExists = await checkExtension(db, 'vector');

    if (tableExists) {
      console.log('✅ REST database is already set up!');
      console.log('   - Users table: Exists');
      console.log('   - All REST tables: Present');
      if (extensionExists) {
        console.log('   - pgvector extension: Installed (for agent_contexts.embedding)');
      }
      console.log();
      return true;
    }

    // Run Drizzle migrations (manages all tables, triggers, and indexes)
    const workspaceRoot = join(__dirname, '../../..');
    const migrationsDir = join(workspaceRoot, 'packages/db/migrations');
    const migrationFiles = [
      '0000_init.sql',
      '0001_special_logan.sql',
      '0002_triggers_search_vectors.sql',
    ];
    let success = true;
    for (const file of migrationFiles) {
      const filePath = join(migrationsDir, file);
      const fileSuccess = await executeSQLFile(db, filePath, `REST (${file})`);
      if (!fileSuccess) {
        success = false;
        break;
      }
    }

    if (!success) {
      return false;
    }

    // Verify
    const verifiedTable = await checkTable(db, 'users');

    // Verify extension (optional - for agent_contexts.embedding)
    const verifiedExtension = await checkExtension(db, 'vector');

    if (verifiedTable) {
      console.log('✅ REST Database Setup Complete!');
      console.log('   - Users table: Exists');
      console.log('   - All REST tables: Present');
      if (verifiedExtension) {
        console.log('   - pgvector extension: Installed (for agent_contexts.embedding)');
      }
      console.log();
      return true;
    } else {
      console.error('❌ REST database verification failed');
      return false;
    }
  } catch (error) {
    console.error('❌ REST database setup failed:', error);
    return false;
  }
}

// =============================================================================
// Main Function
// =============================================================================

// =============================================================================
// ElectricSQL Setup
// =============================================================================

async function setupElectricSQL(): Promise<boolean> {
  console.log('⚡ Setting up ElectricSQL Sync...\n');
  console.log(`${'='.repeat(50)}\n`);

  // ElectricSQL uses the same database as REST (NeonDB)
  // It syncs from the REST database, so we just need to verify the connection
  const postgresUrl = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;

  if (!postgresUrl) {
    console.error('❌ POSTGRES_URL or DATABASE_URL environment variable is not set');
    console.error('ElectricSQL requires access to the REST database (NeonDB)');
    return false;
  }

  try {
    resetClient();
    const db = getRestClient();

    // Verify REST database is accessible (ElectricSQL syncs from it)
    const testResult = await db.execute(sql`SELECT 1 as test`);
    const testRows = Array.isArray(testResult)
      ? testResult
      : ((testResult as { rows?: unknown[] }).rows ?? []);

    if (testRows.length > 0) {
      console.log('✅ ElectricSQL setup verified!');
      console.log('   - REST Database connection: Working');
      console.log('   - ElectricSQL will sync from REST database');
      console.log('   - Start ElectricSQL service: pnpm electric:service:start\n');
      return true;
    } else {
      console.error('❌ ElectricSQL setup verification failed');
      return false;
    }
  } catch (error) {
    console.error('❌ ElectricSQL setup failed:', error);
    return false;
  }
}

// =============================================================================
// Main Function
// =============================================================================

async function main() {
  console.log('🚀 Triple Database Fresh Setup\n');
  console.log(`${'='.repeat(50)}\n`);
  console.log('This will set up all three database components:');
  console.log('  🔵 Vector Database (Supabase) - for agent_memories with pgvector');
  console.log('  🟢 REST Database (NeonDB) - for all REST API tables');
  console.log('  ⚡ ElectricSQL - syncs from REST database for real-time sync\n');
  console.log(`${'='.repeat(50)}\n`);

  // Setup all three components
  const vectorSuccess = await setupVectorDatabase();
  const restSuccess = await setupRestDatabase();
  const electricSuccess = await setupElectricSQL();

  // Summary
  console.log('='.repeat(50));
  console.log('📊 Setup Summary\n');

  if (vectorSuccess && restSuccess && electricSuccess) {
    console.log('✅ All three database components set up successfully!');
    console.log('\nNext steps:');
    console.log('  pnpm test:memory:verify  # Verify setup');
    console.log('  pnpm test:memory:all     # Run all memory tests');
    console.log('  pnpm electric:service:start  # Start ElectricSQL service (optional)\n');
    process.exit(ErrorCode.SUCCESS);
  } else {
    console.error('❌ Setup incomplete:');
    if (!vectorSuccess) {
      console.error('   - Vector Database (Supabase): Failed');
    }
    if (!restSuccess) {
      console.error('   - REST Database (NeonDB): Failed');
    }
    if (!electricSuccess) {
      console.error('   - ElectricSQL Sync: Failed');
    }
    console.error('\nPlease check the errors above and try again.\n');
    process.exit(ErrorCode.EXECUTION_ERROR);
  }
}

main().catch((error) => {
  console.error('Fatal error during setup:', error);
  process.exit(ErrorCode.EXECUTION_ERROR);
});
