#!/usr/bin/env node

/**
 * Test Setup Verification Script
 *
 * Verifies that the test environment is properly configured for running
 * vector memory integration tests. Checks database connections, schema,
 * and required extensions.
 *
 * Usage:
 *   pnpm tsx packages/test/scripts/verify-test-setup.ts
 *   or
 *   pnpm test:memory:verify
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getRestClient, getVectorClient, resetClient } from '@revealui/db'
import { sql } from 'drizzle-orm'

interface VerificationResult {
  name: string
  status: 'pass' | 'fail' | 'warning'
  message: string
  details?: string
}

const results: VerificationResult[] = []

function addResult(result: VerificationResult) {
  results.push(result)
  const icon = result.status === 'pass' ? '✅' : result.status === 'warning' ? '⚠️' : '❌'
  console.log(`${icon} ${result.name}: ${result.message}`)
  if (result.details) {
    console.log(`   ${result.details}`)
  }
}

async function verifyEnvironmentVariables() {
  console.log('\n📋 Verifying Environment Variables...\n')

  const requiredVars = {
    DATABASE_URL: 'Supabase (Vector) database connection string',
    POSTGRES_URL: 'NeonDB (REST) database connection string',
    OPENAI_API_KEY: 'OpenAI API key for generating embeddings',
  }

  let allPresent = true

  for (const [varName, description] of Object.entries(requiredVars)) {
    const value = process.env[varName]
    if (!value || value.trim().length === 0) {
      addResult({
        name: `Environment Variable: ${varName}`,
        status: 'fail',
        message: `Missing or empty`,
        details: `Required for: ${description}`,
      })
      allPresent = false
    } else {
      // Mask sensitive values
      const masked =
        varName.includes('KEY') || varName.includes('URL')
          ? `${value.substring(0, 10)}...${value.substring(value.length - 4)}`
          : '***'
      addResult({
        name: `Environment Variable: ${varName}`,
        status: 'pass',
        message: 'Set',
        details: description,
      })
    }
  }

  return allPresent
}

async function verifyConnectionStringFormat() {
  console.log('\n🔗 Verifying Connection String Format...\n')

  const dbUrl = process.env.DATABASE_URL
  const postgresUrl = process.env.POSTGRES_URL

  if (dbUrl) {
    const isValid = /^postgresql:\/\//.test(dbUrl) || /^postgres:\/\//.test(dbUrl)
    addResult({
      name: 'DATABASE_URL Format',
      status: isValid ? 'pass' : 'fail',
      message: isValid ? 'Valid PostgreSQL connection string' : 'Invalid format',
      details: isValid ? undefined : 'Expected format: postgresql://user:pass@host:port/db',
    })
  }

  if (postgresUrl) {
    const isValid = /^postgresql:\/\//.test(postgresUrl) || /^postgres:\/\//.test(postgresUrl)
    addResult({
      name: 'POSTGRES_URL Format',
      status: isValid ? 'pass' : 'fail',
      message: isValid ? 'Valid PostgreSQL connection string' : 'Invalid format',
      details: isValid ? undefined : 'Expected format: postgresql://user:pass@host:port/db',
    })
  }
}

async function verifyDatabaseConnections() {
  console.log('\n🔌 Testing Database Connections...\n')

  // Test REST database connection
  try {
    resetClient()
    const restDb = getRestClient()
    const restResult = await restDb.execute(sql`SELECT 1 as test`)
    addResult({
      name: 'REST Database Connection',
      status: 'pass',
      message: 'Connected successfully',
      details: 'NeonDB connection is working',
    })
  } catch (error) {
    addResult({
      name: 'REST Database Connection',
      status: 'fail',
      message: 'Connection failed',
      details: error instanceof Error ? error.message : String(error),
    })
  }

  // Test Vector database connection
  try {
    resetClient()
    const vectorDb = getVectorClient()
    const vectorResult = await vectorDb.execute(sql`SELECT 1 as test`)
    addResult({
      name: 'Vector Database Connection',
      status: 'pass',
      message: 'Connected successfully',
      details: 'Supabase connection is working',
    })
  } catch (error) {
    addResult({
      name: 'Vector Database Connection',
      status: 'fail',
      message: 'Connection failed',
      details: error instanceof Error ? error.message : String(error),
    })
  }
}

async function verifySupabaseSchema() {
  console.log('\n📊 Verifying Supabase Schema...\n')

  try {
    resetClient()
    const vectorDb = getVectorClient()

    // Check if agent_memories table exists
    const tableCheck = await vectorDb.execute(
      sql`SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'agent_memories'
      ) as exists`,
    )

    const tableExists = Array.isArray(tableCheck)
      ? (tableCheck[0] as any)?.exists
      : (tableCheck as any).rows?.[0]?.exists

    if (!tableExists) {
      addResult({
        name: 'agent_memories Table',
        status: 'fail',
        message: 'Table does not exist',
        details: 'Run the migration script: pnpm test:memory:setup',
      })
      return
    }

    addResult({
      name: 'agent_memories Table',
      status: 'pass',
      message: 'Table exists',
    })

    // Check required columns
    const columnsCheck = await vectorDb.execute(
      sql`SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'agent_memories'
        ORDER BY column_name`,
    )

    const columns = Array.isArray(columnsCheck) ? columnsCheck : (columnsCheck as any).rows || []

    const requiredColumns = [
      'id',
      'content',
      'type',
      'source',
      'embedding',
      'embedding_metadata',
      'metadata',
      'created_at',
    ]

    const existingColumns = columns.map((c: any) => c.column_name || c.column_name)
    const missingColumns = requiredColumns.filter((col) => !existingColumns.includes(col))

    if (missingColumns.length > 0) {
      addResult({
        name: 'Table Schema',
        status: 'fail',
        message: `Missing columns: ${missingColumns.join(', ')}`,
        details: 'Run the migration script to create the correct schema',
      })
    } else {
      addResult({
        name: 'Table Schema',
        status: 'pass',
        message: 'All required columns present',
      })
    }
  } catch (error) {
    addResult({
      name: 'Schema Verification',
      status: 'fail',
      message: 'Failed to verify schema',
      details: error instanceof Error ? error.message : String(error),
    })
  }
}

async function verifyPgVectorExtension() {
  console.log('\n🔍 Verifying pgvector Extension...\n')

  try {
    resetClient()
    const vectorDb = getVectorClient()

    const extensionCheck = await vectorDb.execute(
      sql`SELECT EXISTS (
        SELECT FROM pg_extension 
        WHERE extname = 'vector'
      ) as exists`,
    )

    const extensionExists = Array.isArray(extensionCheck)
      ? (extensionCheck[0] as any)?.exists
      : (extensionCheck as any).rows?.[0]?.exists

    if (!extensionExists) {
      addResult({
        name: 'pgvector Extension',
        status: 'fail',
        message: 'Extension not installed',
        details: 'Run: CREATE EXTENSION IF NOT EXISTS vector; in your Supabase database',
      })
      return
    }

    addResult({
      name: 'pgvector Extension',
      status: 'pass',
      message: 'Extension is installed',
    })

    // Verify vector type is available
    try {
      await vectorDb.execute(sql`SELECT '[1,2,3]'::vector(3) as test_vector`)
      addResult({
        name: 'Vector Type',
        status: 'pass',
        message: 'Vector type is functional',
      })
    } catch (error) {
      addResult({
        name: 'Vector Type',
        status: 'warning',
        message: 'Vector type test failed',
        details: error instanceof Error ? error.message : String(error),
      })
    }
  } catch (error) {
    addResult({
      name: 'pgvector Extension',
      status: 'fail',
      message: 'Failed to check extension',
      details: error instanceof Error ? error.message : String(error),
    })
  }
}

async function verifyIndexes() {
  console.log('\n📇 Verifying Indexes...\n')

  try {
    resetClient()
    const vectorDb = getVectorClient()

    const indexCheck = await vectorDb.execute(
      sql`SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE tablename = 'agent_memories' 
        AND schemaname = 'public'`,
    )

    const indexes = Array.isArray(indexCheck) ? indexCheck : (indexCheck as any).rows || []

    const hasEmbeddingIndex = indexes.some(
      (idx: any) => idx.indexname?.includes('embedding') || idx.indexdef?.includes('embedding'),
    )

    if (!hasEmbeddingIndex) {
      addResult({
        name: 'HNSW Index',
        status: 'warning',
        message: 'Embedding index not found',
        details: 'Performance may be degraded. Run migration to create HNSW index.',
      })
    } else {
      addResult({
        name: 'HNSW Index',
        status: 'pass',
        message: 'Embedding index exists',
      })
    }

    addResult({
      name: 'Total Indexes',
      status: 'pass',
      message: `Found ${indexes.length} index(es)`,
    })
  } catch (error) {
    addResult({
      name: 'Index Verification',
      status: 'warning',
      message: 'Failed to verify indexes',
      details: error instanceof Error ? error.message : String(error),
    })
  }
}

async function verifyOpenAIConnection() {
  console.log('\n🤖 Verifying OpenAI API Connection...\n')

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    addResult({
      name: 'OpenAI API Key',
      status: 'fail',
      message: 'API key not set',
    })
    return
  }

  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })

    if (response.ok) {
      addResult({
        name: 'OpenAI API Connection',
        status: 'pass',
        message: 'Connection successful',
        details: 'Can generate embeddings',
      })
    } else {
      addResult({
        name: 'OpenAI API Connection',
        status: 'fail',
        message: `API returned status ${response.status}`,
        details: 'Check your API key and account status',
      })
    }
  } catch (error) {
    addResult({
      name: 'OpenAI API Connection',
      status: 'fail',
      message: 'Connection failed',
      details: error instanceof Error ? error.message : String(error),
    })
  }
}

async function main() {
  console.log('🧪 Test Setup Verification\n')
  console.log('='.repeat(50))

  // Run all verification checks
  const envOk = await verifyEnvironmentVariables()
  await verifyConnectionStringFormat()

  if (!envOk) {
    console.log('\n❌ Environment variables are missing. Please set them before continuing.')
    process.exit(1)
  }

  await verifyDatabaseConnections()
  await verifySupabaseSchema()
  await verifyPgVectorExtension()
  await verifyIndexes()
  await verifyOpenAIConnection()

  // Summary
  console.log('\n' + '='.repeat(50))
  console.log('\n📊 Verification Summary\n')

  const passed = results.filter((r) => r.status === 'pass').length
  const failed = results.filter((r) => r.status === 'fail').length
  const warnings = results.filter((r) => r.status === 'warning').length

  console.log(`✅ Passed: ${passed}`)
  console.log(`⚠️  Warnings: ${warnings}`)
  console.log(`❌ Failed: ${failed}`)

  if (failed > 0) {
    console.log('\n❌ Setup verification failed. Please fix the issues above before running tests.')
    process.exit(1)
  } else if (warnings > 0) {
    console.log(
      '\n⚠️  Setup verification passed with warnings. Tests should work, but some features may be limited.',
    )
    process.exit(0)
  } else {
    console.log('\n✅ All checks passed! You can now run the integration tests.')
    process.exit(0)
  }
}

main().catch((error) => {
  console.error('Fatal error during verification:', error)
  process.exit(1)
})
