#!/usr/bin/env tsx

/**
 * Migration CLI Script
 *
 * Command-line tool for migrating localStorage data to PostgreSQL.
 * Run with: tsx migrate.ts
 */

import { createSyncClient } from '../client/index.js'
import { migrateLocalStorageToDatabase } from './index.js'

async function main() {
  console.log('🚀 RevealUI Database Migration Tool')
  console.log('=====================================\n')

  try {
    // Create sync client
    const client = createSyncClient({
      debug: true,
      databaseType: 'rest', // Use REST client for migration
    })

    // Connect to database
    console.log('Connecting to database...')
    await client.connect()

    // Execute migration
    console.log('Starting migration...')
    const result = await migrateLocalStorageToDatabase(client)

    // Report results
    console.log('\n📊 Migration Results:')
    console.log(`✅ Success: ${result.success}`)
    console.log(`📤 Exported Records: ${result.exportedRecords}`)
    console.log(`📥 Imported Records: ${result.importedRecords}`)
    console.log(`🔄 Rollback Available: ${result.rollbackAvailable}`)

    if (result.errors.length > 0) {
      console.log('\n❌ Errors:')
      result.errors.forEach(error => console.log(`  - ${error}`))
    }

    if (result.success) {
      console.log('\n🎉 Migration completed successfully!')
      console.log('You can now enable ElectricSQL for real-time sync.')
    } else {
      console.log('\n💥 Migration failed. Check errors above.')
      process.exit(1)
    }

  } catch (error) {
    console.error('\n💥 Unexpected error:', error)
    process.exit(1)
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Migration failed:', error)
    process.exit(1)
  })
}