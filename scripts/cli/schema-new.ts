#!/usr/bin/env tsx
/**
 * Schema Scaffolding Tool
 *
 * Quickly scaffold a new Drizzle table schema with best practices.
 *
 * Usage:
 *   pnpm db:schema:new <tableName>
 *
 * Example:
 *   pnpm db:schema:new organizations
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const rootDir = join(import.meta.dirname, '../..')

function toCamelCase(str: string): string {
  return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase())
}

function toPascalCase(str: string): string {
  const camel = toCamelCase(str)
  return camel.charAt(0).toUpperCase() + camel.slice(1)
}

function _toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
}

interface ScaffoldOptions {
  tableName: string
  includeTimestamps?: boolean
  includeSoftDelete?: boolean
}

function generateSchemaFile(options: ScaffoldOptions): string {
  const { tableName, includeTimestamps = true, includeSoftDelete = false } = options
  const pascalName = toPascalCase(tableName)

  return `/**
 * ${pascalName} Table Schema
 *
 * TODO: Add description of what this table stores
 */

import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

/**
 * ${pascalName} table
 *
 * TODO: Document table purpose and relationships
 */
export const ${tableName} = pgTable('${tableName}', {
  /** Primary key */
  id: uuid('id').primaryKey().defaultRandom(),

  /** TODO: Add your fields here */
  name: text('name').notNull(),
  description: text('description'),
${
  includeTimestamps
    ? `
  /** Creation timestamp */
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),

  /** Last update timestamp */
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
`
    : ''
}${
  includeSoftDelete
    ? `
  /** Soft delete timestamp */
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
`
    : ''
}})

/**
 * TODO: Add relations if needed
 *
 * Example:
 * export const ${tableName}Relations = relations(${tableName}, ({ one, many }) => ({
 *   user: one(users, {
 *     fields: [${tableName}.userId],
 *     references: [users.id],
 *   }),
 * }))
 */
`
}

function addToSchemaIndex(tableName: string): void {
  const indexPath = join(rootDir, 'packages/db/src/schema/index.ts')

  if (!existsSync(indexPath)) {
    console.log('⚠️  Warning: schema/index.ts not found')
    return
  }

  const content = readFileSync(indexPath, 'utf-8')

  // Check if already exported
  if (content.includes(`export * from './${tableName}.js'`)) {
    console.log('ℹ️  Table already exported in schema/index.ts')
    return
  }

  // Find the last export line and add after it
  const lines = content.split('\n')
  const lastExportIndex = lines.findLastIndex((line) => line.startsWith('export *'))

  if (lastExportIndex === -1) {
    lines.push(`export * from './${tableName}.js'`)
  } else {
    lines.splice(lastExportIndex + 1, 0, `export * from './${tableName}.js'`)
  }

  writeFileSync(indexPath, lines.join('\n'))
  console.log('✅ Added export to schema/index.ts')
}

function addToRestExports(tableName: string): void {
  const restPath = join(rootDir, 'packages/db/src/schema/rest.ts')

  if (!existsSync(restPath)) {
    console.log('⚠️  Warning: schema/rest.ts not found')
    return
  }

  const content = readFileSync(restPath, 'utf-8')

  // Check if already exported
  if (content.includes(tableName)) {
    console.log('ℹ️  Table already exported in schema/rest.ts')
    return
  }

  // Add to appropriate export section
  const lines = content.split('\n')

  // Find a good place to add - after the last table export
  const lastTableExportIndex = lines.findLastIndex((line) => line.trim().startsWith('export'))

  if (lastTableExportIndex === -1) {
    lines.push(`export { ${tableName} } from './${tableName}.js'`)
  } else {
    lines.splice(lastTableExportIndex + 1, 0, `export { ${tableName} } from './${tableName}.js'`)
  }

  writeFileSync(restPath, lines.join('\n'))
  console.log('✅ Added export to schema/rest.ts')
}

function showNextSteps(tableName: string): void {
  console.log('\n📝 Next Steps:\n')
  console.log(`1. Edit the schema file:`)
  console.log(`   packages/db/src/schema/${tableName}.ts`)
  console.log('')
  console.log('2. Add your fields and constraints')
  console.log('')
  console.log('3. Generate types:')
  console.log('   pnpm generate:all')
  console.log('')
  console.log('4. Create a migration:')
  console.log('   pnpm db:migrate')
  console.log('')
  console.log('5. (Optional) Create an entity contract:')
  console.log(`   packages/contracts/src/entities/${tableName.replace(/-/g, '-')}.ts`)
  console.log('')
}

// Main execution
const tableName = process.argv[2]

if (!tableName) {
  console.error('❌ Error: Table name required')
  console.log('\nUsage: pnpm db:schema:new <tableName>')
  console.log('\nExample:')
  console.log('  pnpm db:schema:new organizations')
  process.exit(1)
}

// Validate table name
if (!/^[a-z][a-z0-9-]*$/.test(tableName)) {
  console.error('❌ Error: Table name must be lowercase with hyphens (kebab-case)')
  console.log('Example: user-profiles, api-keys, organizations')
  process.exit(1)
}

const schemaPath = join(rootDir, `packages/db/src/schema/${tableName}.ts`)

// Check if file already exists
if (existsSync(schemaPath)) {
  console.error(`❌ Error: Schema file already exists: ${tableName}.ts`)
  process.exit(1)
}

console.log(`📦 Creating new schema: ${tableName}\n`)

// Generate the schema file
const schemaContent = generateSchemaFile({
  tableName,
  includeTimestamps: true,
  includeSoftDelete: false,
})

writeFileSync(schemaPath, schemaContent)
console.log(`✅ Created: packages/db/src/schema/${tableName}.ts`)

// Add exports
addToSchemaIndex(tableName)
addToRestExports(tableName)

// Show next steps
showNextSteps(tableName)
