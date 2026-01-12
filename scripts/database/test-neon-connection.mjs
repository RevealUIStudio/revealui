#!/usr/bin/env node
/**
 * Neon HTTP Connection Test
 * 
 * Tests actual connection to Neon database using Drizzle/Neon HTTP driver.
 * This is used by validate-production.sh to verify connectivity.
 */

import { createClient } from '../packages/db/dist/client/index.js'

const POSTGRES_URL = process.env.POSTGRES_URL || process.env.DATABASE_URL

if (!POSTGRES_URL) {
  console.error('ERROR: POSTGRES_URL or DATABASE_URL must be set')
  process.exit(1)
}

try {
  const db = createClient({ connectionString: POSTGRES_URL })
  
  // Test connection with a simple query
  const result = await db.execute({ 
    sql: 'SELECT 1 as test, NOW() as timestamp', 
    params: [] 
  })
  
  // Handle different result formats
  const rows = Array.isArray(result) ? result : (result?.rows || [])
  
  if (rows.length > 0) {
    console.log('SUCCESS')
    console.log('Connection verified:', rows[0])
    process.exit(0)
  } else {
    console.error('ERROR: Query returned no results')
    process.exit(1)
  }
} catch (error) {
  console.error('ERROR:', error.message)
  if (error.stack) {
    console.error('Stack:', error.stack)
  }
  process.exit(1)
}
