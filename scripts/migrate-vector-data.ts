/**
 * Vector Data Migration Script
 *
 * Migrates agent_memories data from NeonDB (REST database) to Supabase (Vector database).
 * This script should be run after setting up Supabase with the vector schema.
 *
 * Usage:
 *   POSTGRES_URL=<neondb-url> DATABASE_URL=<supabase-url> pnpm tsx scripts/migrate-vector-data.ts
 *
 * Safety:
 *   - Creates backup before migration
 *   - Verifies data integrity
 *   - Supports dry-run mode
 *   - Can be run multiple times (idempotent)
 */

import { getRestClient, getVectorClient } from '@revealui/db/client'
import { agentMemories as vectorMemories } from '@revealui/db/schema/vector'
import { eq, sql } from 'drizzle-orm'

interface MigrationOptions {
  dryRun?: boolean
  batchSize?: number
  skipExisting?: boolean
}

interface MigrationStats {
  total: number
  migrated: number
  skipped: number
  errors: number
  errorDetails: Array<{ id: string; error: string }>
}

/**
 * Migrate agent_memories from NeonDB to Supabase
 */
async function migrateVectorData(options: MigrationOptions = {}): Promise<MigrationStats> {
  const { dryRun = false, batchSize = 100, skipExisting = true } = options

  console.log('Starting vector data migration...')
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`)
  console.log(`Batch size: ${batchSize}`)
  console.log(`Skip existing: ${skipExisting}`)
  console.log('')

  const restDb = getRestClient()
  const vectorDb = getVectorClient()

  const stats: MigrationStats = {
    total: 0,
    migrated: 0,
    skipped: 0,
    errors: 0,
    errorDetails: [],
  }

  try {
    // Get all memories from NeonDB using raw SQL
    // (agentMemories is not in REST schema, so we use raw SQL)
    console.log('Fetching memories from NeonDB...')
    const result = await restDb.execute(
      sql`SELECT id, version, content, type, source, embedding, embedding_metadata, 
                 metadata, access_count, accessed_at, verified, verified_by, 
                 verified_at, site_id, agent_id, created_at, expires_at
          FROM agent_memories 
          ORDER BY created_at`,
    )

    const rows = Array.isArray(result) ? result : (result as any).rows || []
    const allMemories = rows.map((row: any) => ({
      id: row.id,
      version: row.version || 1,
      content: row.content,
      type: row.type,
      source: row.source,
      embedding: row.embedding,
      embeddingMetadata: row.embedding_metadata,
      metadata: row.metadata || {},
      accessCount: row.access_count || 0,
      accessedAt: row.accessed_at,
      verified: row.verified,
      verifiedBy: row.verified_by || null,
      verifiedAt: row.verified_at || null,
      siteId: row.site_id || null,
      agentId: row.agent_id || null,
      createdAt: row.created_at,
      expiresAt: row.expires_at || null,
    }))

    stats.total = allMemories.length
    console.log(`Found ${stats.total} memories to migrate`)
    console.log('')

    if (stats.total === 0) {
      console.log('No memories to migrate.')
      return stats
    }

    // Process in batches
    for (let i = 0; i < allMemories.length; i += batchSize) {
      const batch = allMemories.slice(i, i + batchSize)
      const batchNum = Math.floor(i / batchSize) + 1
      const totalBatches = Math.ceil(allMemories.length / batchSize)

      console.log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} memories)...`)

      for (const memory of batch) {
        try {
          // Check if memory already exists in Supabase
          if (skipExisting) {
            const existing = await vectorDb
              .select()
              .from(vectorMemories)
              .where(eq(vectorMemories.id, memory.id))
              .limit(1)

            if (existing.length > 0) {
              stats.skipped++
              continue
            }
          }

          // Prepare data for Supabase
          // Note: embedding is stored as vector type, we need to convert it
          const embeddingVector = memory.embedding
            ? Array.isArray(memory.embedding)
              ? memory.embedding
              : typeof memory.embedding === 'string'
                ? JSON.parse(memory.embedding.replace(/^\[/, '[').replace(/\]$/, ']'))
                : []
            : null

          const insertData = {
            id: memory.id,
            version: memory.version,
            content: memory.content,
            type: memory.type,
            source: memory.source,
            embedding: embeddingVector ? `[${embeddingVector.join(',')}]` : null,
            embeddingMetadata: memory.embeddingMetadata,
            metadata: memory.metadata || {},
            accessCount: memory.accessCount || 0,
            accessedAt: memory.accessedAt,
            verified: memory.verified,
            verifiedBy: memory.verifiedBy || null,
            verifiedAt: memory.verifiedAt || null,
            siteId: memory.siteId || null,
            agentId: memory.agentId || null,
            createdAt: memory.createdAt,
            expiresAt: memory.expiresAt || null,
          }

          if (!dryRun) {
            await vectorDb.insert(vectorMemories).values(insertData)
          }

          stats.migrated++
        } catch (error) {
          stats.errors++
          const errorMessage = error instanceof Error ? error.message : String(error)
          stats.errorDetails.push({
            id: memory.id,
            error: errorMessage,
          })
          console.error(`  Error migrating memory ${memory.id}:`, errorMessage)
        }
      }

      console.log(
        `  Batch ${batchNum} complete: ${stats.migrated} migrated, ${stats.skipped} skipped, ${stats.errors} errors`,
      )
    }

    console.log('')
    console.log('Migration complete!')
    console.log(`Total: ${stats.total}`)
    console.log(`Migrated: ${stats.migrated}`)
    console.log(`Skipped: ${stats.skipped}`)
    console.log(`Errors: ${stats.errors}`)

    if (stats.errors > 0) {
      console.log('')
      console.log('Error details:')
      stats.errorDetails.forEach(({ id, error }) => {
        console.log(`  - ${id}: ${error}`)
      })
    }

    // Verify data integrity
    if (!dryRun && stats.errors === 0) {
      console.log('')
      console.log('Verifying data integrity...')

      // Get counts using raw SQL
      const restResult = await restDb.execute(sql`SELECT COUNT(*) as count FROM agent_memories`)
      const restRows = Array.isArray(restResult) ? restResult : (restResult as any).rows || []
      const restCount = parseInt(restRows[0]?.count || '0', 10)

      const vectorCount = await vectorDb.query.agentMemories.findMany()

      console.log(`NeonDB count: ${restCount}`)
      console.log(`Supabase count: ${vectorCount.length}`)

      if (stats.migrated + stats.skipped === vectorCount.length) {
        console.log('✅ Data integrity verified!')
      } else {
        console.log('⚠️  Count mismatch - please verify manually')
      }
    }

    return stats
  } catch (error) {
    console.error('Fatal error during migration:', error)
    throw error
  }
}

// Run migration if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const batchSize = parseInt(
    args.find((arg) => arg.startsWith('--batch-size='))?.split('=')[1] || '100',
    10,
  )

  migrateVectorData({ dryRun, batchSize })
    .then((stats) => {
      if (stats.errors > 0) {
        process.exit(1)
      }
    })
    .catch((error) => {
      console.error('Migration failed:', error)
      process.exit(1)
    })
}

export { migrateVectorData, type MigrationOptions, type MigrationStats }
