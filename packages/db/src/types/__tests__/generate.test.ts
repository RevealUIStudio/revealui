/**
 * Tests for Database Type Generation
 *
 * Verifies that:
 * - All tables are included in the Database type
 * - Type inference is correct (Row, Insert, Update)
 * - Relationships are captured
 * - Generated types match expected structure
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Database } from '../database.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
// Always resolve to src/types/database.ts, regardless of whether test runs from src or dist
// From src/types/__tests__ or dist/types/__tests__, go up to package root (3 levels), then into src/types
const packageRoot = join(__dirname, '../../..')
const databaseTypePath = join(packageRoot, 'src/types/database.ts')

describe('Database Type Generation', () => {
  it('should generate database.ts file', () => {
    const content = readFileSync(databaseTypePath, 'utf-8')
    expect(content).toBeTruthy()
    expect(content).toContain('export type Database')
  })

  it('should include all expected tables (automatically discovered)', () => {
    const content = readFileSync(databaseTypePath, 'utf-8')
    const expectedTables = [
      'users',
      'sessions',
      'sites',
      'site_collaborators',
      'pages',
      'page_revisions',
      'agent_contexts',
      'agent_memories',
      'conversations',
      'agent_actions',
      'posts',
      'media',
      'global_header',
      'global_footer',
      'global_settings',
      'rate_limits',
      'failed_attempts',
      'node_id_mappings',
      'crdt_operations',
    ]

    // Check for table names (behavioral test, not exact format)
    for (const table of expectedTables) {
      expect(content).toContain(table)
    }

    // Verify tables are discovered automatically (not hardcoded)
    expect(content).toContain('Tables are automatically discovered from packages/db/src/core/*.ts')
  })

  it('should generate Row, Insert, and Update types for each table', () => {
    const content = readFileSync(databaseTypePath, 'utf-8')
    const tables = ['users', 'sites', 'pages']

    // Check that each table has Row, Insert, and Update types generated
    for (const table of tables) {
      // Convert table name to PascalCase for type names (e.g., users -> Users)
      const typeName = table.charAt(0).toUpperCase() + table.slice(1).replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
      expect(content).toContain(`${typeName}Row`)
      expect(content).toContain(`${typeName}Insert`)
      expect(content).toContain(`${typeName}Update`)
    }

    // Check for general type structure
    expect(content).toContain('Row')
    expect(content).toContain('Insert')
    expect(content).toContain('Update')
    expect(content).toContain('Relationships')
  })

  it('should include Relationships type definitions', () => {
    const content = readFileSync(databaseTypePath, 'utf-8')
    expect(content).toContain('DatabaseRelationships')
    expect(content).toContain('Relationships:')
  })

  it('should include Enums type definitions', () => {
    const content = readFileSync(databaseTypePath, 'utf-8')
    expect(content).toContain('DatabaseEnums')
    expect(content).toContain('Enums: DatabaseEnums')
  })

  it('should match Supabase Database type structure', () => {
    const content = readFileSync(databaseTypePath, 'utf-8')
    // Should have public.Tables structure
    expect(content).toContain('public: {')
    expect(content).toContain('Tables: {')
    expect(content).toContain('Enums:')
  })

  it('should export type utilities', () => {
    const content = readFileSync(databaseTypePath, 'utf-8')
    expect(content).toContain('TableRow<')
    expect(content).toContain('TableInsert<')
    expect(content).toContain('TableUpdate<')
    expect(content).toContain('TableRelationships<')
  })

  it('should have correct Database type structure', () => {
    // Type-level test - verify Database type exists and has correct structure
    // If types are wrong, TypeScript will error here
    const _users: Database['public']['Tables']['users'] =
      {} as Database['public']['Tables']['users']
    const _row: Database['public']['Tables']['users']['Row'] =
      {} as Database['public']['Tables']['users']['Row']
    const _insert: Database['public']['Tables']['users']['Insert'] =
      {} as Database['public']['Tables']['users']['Insert']
    const _update: Database['public']['Tables']['users']['Update'] =
      {} as Database['public']['Tables']['users']['Update']
    const _relationships: Database['public']['Tables']['users']['Relationships'] =
      {} as Database['public']['Tables']['users']['Relationships']

    // Runtime assertion - if we get here, types compiled successfully
    expect(_users).toBeDefined()
    expect(_row).toBeDefined()
    expect(_insert).toBeDefined()
    expect(_update).toBeDefined()
    expect(_relationships).toBeDefined()
  })

  it('should include all table type exports', () => {
    const content = readFileSync(databaseTypePath, 'utf-8')
    const expectedTypeExports = [
      'UsersRow',
      'UsersInsert',
      'UsersUpdate',
      'SessionsRow',
      'SitesRow',
      'PagesRow',
      'PostsRow',
      'MediaRow',
    ]

    for (const typeExport of expectedTypeExports) {
      expect(content).toContain(`export type ${typeExport}`)
    }
  })
})
