#!/usr/bin/env tsx
/**
 * Contract Documentation Generator
 *
 * Auto-generates API documentation from contracts:
 * - Table schemas
 * - Field descriptions
 * - Validation rules
 * - Example usage
 * - Type definitions
 *
 * Usage: pnpm types:docs
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const rootDir = join(import.meta.dirname, '../..')
const docsDir = join(rootDir, 'docs/api')

interface TableDoc {
  name: string
  tableName: string
  description: string
  fields: FieldDoc[]
  relations: string[]
  indexes: string[]
}

interface FieldDoc {
  name: string
  type: string
  required: boolean
  hasDefault: boolean
  description?: string
  validation?: string[]
}

/**
 * Extract documentation from schema files
 */
function extractSchemaDocs(schemaFile: string): TableDoc | null {
  const fullPath = join(rootDir, schemaFile)
  if (!existsSync(fullPath)) return null

  const content = readFileSync(fullPath, 'utf-8')

  // Extract table definition
  const tableMatch = content.match(/export const (\w+) = pgTable\('([^']+)',/)
  if (!tableMatch) return null

  const [, varName, tableName] = tableMatch

  // Extract description from comments
  const descMatch = content.match(/\/\*\*\s*\n\s*\*\s*([^\n]+)\s*\n/)
  const description = descMatch ? descMatch[1].trim() : ''

  // Extract fields (simplified - would need better parsing in production)
  const fields: FieldDoc[] = []

  // Extract relations
  const relations: string[] = []
  const relationMatches = content.matchAll(/\.references\(\(\) => (\w+)\.(\w+)/g)
  for (const match of relationMatches) {
    relations.push(`${match[1]}.${match[2]}`)
  }

  return {
    name: varName,
    tableName,
    description,
    fields,
    relations,
    indexes: [],
  }
}

/**
 * Generate markdown documentation for a table
 */
function generateTableDoc(table: TableDoc): string {
  let md = `# ${table.name}\n\n`

  if (table.description) {
    md += `${table.description}\n\n`
  }

  md += `**Database Table:** \`${table.tableName}\`\n\n`

  // Schema section
  md += `## Schema\n\n`
  md += `\`\`\`typescript\n`
  md += `import { ${table.name}SelectSchema, ${table.name}InsertSchema } from '@revealui/contracts/generated'\n`
  md += `\n`
  md += `// Select (read from database)\n`
  md += `type ${table.name}Row = z.infer<typeof ${table.name}SelectSchema>\n`
  md += `\n`
  md += `// Insert (write to database)\n`
  md += `type ${table.name}Insert = z.infer<typeof ${table.name}InsertSchema>\n`
  md += `\`\`\`\n\n`

  // Contract section
  md += `## Contract\n\n`
  md += `\`\`\`typescript\n`
  md += `import { ${table.name}RowContract, ${table.name}InsertContract } from '@revealui/contracts/generated'\n`
  md += `\n`
  md += `// Validate data\n`
  md += `const result = ${table.name}RowContract.validate(data)\n`
  md += `if (result.success) {\n`
  md += `  console.log(result.data) // Typed as ${table.name}Row\n`
  md += `}\n`
  md += `\`\`\`\n\n`

  // Fields section
  if (table.fields.length > 0) {
    md += `## Fields\n\n`
    md += `| Field | Type | Required | Default | Description |\n`
    md += `|-------|------|----------|---------|-------------|\n`

    for (const field of table.fields) {
      const req = field.required ? '✓' : ''
      const def = field.hasDefault ? '✓' : ''
      const desc = field.description || ''
      md += `| \`${field.name}\` | \`${field.type}\` | ${req} | ${def} | ${desc} |\n`
    }
    md += `\n`
  }

  // Relations section
  if (table.relations.length > 0) {
    md += `## Relations\n\n`
    for (const relation of table.relations) {
      md += `- References: \`${relation}\`\n`
    }
    md += `\n`
  }

  // Usage examples
  md += `## Usage Examples\n\n`
  md += `### Query Database\n\n`
  md += `\`\`\`typescript\n`
  md += `import { db } from '@revealui/db'\n`
  md += `import { ${table.name} } from '@revealui/db/schema'\n`
  md += `\n`
  md += `// Select all\n`
  md += `const rows = await db.select().from(${table.name})\n`
  md += `\n`
  md += `// Select by ID\n`
  md += `const row = await db.select().from(${table.name}).where(eq(${table.name}.id, 'id'))\n`
  md += `\`\`\`\n\n`

  md += `### Insert Data\n\n`
  md += `\`\`\`typescript\n`
  md += `import { ${table.name}InsertContract } from '@revealui/contracts/generated'\n`
  md += `\n`
  md += `// Validate before insert\n`
  md += `const result = ${table.name}InsertContract.validate(data)\n`
  md += `if (result.success) {\n`
  md += `  await db.insert(${table.name}).values(result.data)\n`
  md += `}\n`
  md += `\`\`\`\n\n`

  md += `### Update Data\n\n`
  md += `\`\`\`typescript\n`
  md += `await db.update(${table.name})\n`
  md += `  .set({ /* partial data */ })\n`
  md += `  .where(eq(${table.name}.id, 'id'))\n`
  md += `\`\`\`\n\n`

  // Related documentation
  md += `## Related\n\n`
  md += `- [Type System Architecture](../TYPE_SYSTEM.md)\n`
  md += `- [Contract System](../CONTRACTS.md)\n`
  md += `- [Database Guide](../DATABASE.md)\n\n`

  md += `---\n\n`
  md += `*Auto-generated documentation from schema definitions*\n`

  return md
}

/**
 * Generate index page
 */
function generateIndexPage(tables: TableDoc[]): string {
  let md = `# API Documentation\n\n`
  md += `Auto-generated documentation for all database tables and contracts.\n\n`

  md += `## Tables\n\n`

  // Group by category (inferred from name)
  const core = tables.filter((t) => ['users', 'sessions', 'sites', 'pages'].includes(t.tableName))
  const cms = tables.filter((t) => t.tableName.includes('block') || t.tableName.includes('asset'))
  const agent = tables.filter(
    (t) => t.tableName.includes('agent') || t.tableName.includes('message'),
  )
  const other = tables.filter((t) => !(core.includes(t) || cms.includes(t) || agent.includes(t)))

  if (core.length > 0) {
    md += `### Core\n\n`
    for (const table of core) {
      md += `- [${table.name}](./${table.name}.md) - ${table.description}\n`
    }
    md += `\n`
  }

  if (cms.length > 0) {
    md += `### CMS\n\n`
    for (const table of cms) {
      md += `- [${table.name}](./${table.name}.md) - ${table.description}\n`
    }
    md += `\n`
  }

  if (agent.length > 0) {
    md += `### AI Agents\n\n`
    for (const table of agent) {
      md += `- [${table.name}](./${table.name}.md) - ${table.description}\n`
    }
    md += `\n`
  }

  if (other.length > 0) {
    md += `### Other\n\n`
    for (const table of other) {
      md += `- [${table.name}](./${table.name}.md) - ${table.description}\n`
    }
    md += `\n`
  }

  md += `## Usage\n\n`
  md += `All tables have auto-generated:\n\n`
  md += `- **Zod Schemas** - Runtime validation\n`
  md += `- **TypeScript Types** - Compile-time safety\n`
  md += `- **Contracts** - Unified validation interface\n\n`

  md += `### Import Patterns\n\n`
  md += `\`\`\`typescript\n`
  md += `// Database queries\n`
  md += `import { db } from '@revealui/db'\n`
  md += `import { users, sites, pages } from '@revealui/db/schema'\n`
  md += `\n`
  md += `// Type-safe schemas\n`
  md += `import { UsersSelectSchema, SitesInsertSchema } from '@revealui/contracts/generated'\n`
  md += `\n`
  md += `// Validation contracts\n`
  md += `import { UsersRowContract, SitesInsertContract } from '@revealui/contracts/generated'\n`
  md += `\`\`\`\n\n`

  md += `---\n\n`
  md += `*Last updated: ${new Date().toLocaleString()}*\n`

  return md
}

/**
 * Main documentation generation
 */
async function generateDocs(): Promise<void> {
  console.log('📚 Generating contract documentation...\n')

  // Ensure docs directory exists
  if (!existsSync(docsDir)) {
    mkdirSync(docsDir, { recursive: true })
  }

  // Find all schema files
  const schemaFiles = [
    'packages/db/src/schema/users.ts',
    'packages/db/src/schema/sites.ts',
    'packages/db/src/schema/pages.ts',
    'packages/db/src/schema/agents.ts',
    'packages/db/src/schema/cms.ts',
  ]

  const tables: TableDoc[] = []

  for (const file of schemaFiles) {
    const doc = extractSchemaDocs(file)
    if (doc) {
      tables.push(doc)
      console.log(`  ✓ Extracted: ${doc.name}`)

      // Generate individual table doc
      const markdown = generateTableDoc(doc)
      const outputFile = join(docsDir, `${doc.name}.md`)
      writeFileSync(outputFile, markdown)
    }
  }

  // Generate index
  const indexMarkdown = generateIndexPage(tables)
  writeFileSync(join(docsDir, 'README.md'), indexMarkdown)

  console.log(`\n✅ Generated documentation for ${tables.length} tables`)
  console.log(`📁 Output: ${docsDir}\n`)
}

// Main execution
const command = process.argv[2] || 'generate'

if (command === 'generate' || command === 'build') {
  await generateDocs()
} else {
  console.log('Contract Documentation Generator\n')
  console.log('Usage:')
  console.log('  pnpm types:docs           - Generate documentation')
  console.log('  pnpm types:docs build     - Generate documentation')
}
