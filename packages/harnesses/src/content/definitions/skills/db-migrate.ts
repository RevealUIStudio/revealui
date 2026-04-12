import type { Skill } from '../../schemas/skill.js';

export const dbMigrateSkill: Skill = {
  id: 'db-migrate',
  tier: 'pro',
  name: 'Database Migration',
  description:
    'Create and apply Drizzle ORM migrations with dual-DB boundary checks (NeonDB vs Supabase)',
  disableModelInvocation: true,
  skipFrontmatter: false,
  filePatterns: [],
  bashPatterns: [],
  references: {},
  content: `# Database Migration Workflow

Guide for creating and applying Drizzle ORM migrations in the RevealUI dual-database architecture.

## Pre-Flight Checks

Before creating a migration:

1. **Identify the target database**:
   - **NeonDB** (REST content): users, sessions, collections, products, orders, licenses, pages, sites, tickets, agents, api-keys, GDPR
   - **Supabase** (vectors/auth): embeddings, AI memory storage, real-time auth
   - If unsure, check \`packages/db/src/schema/rest.ts\` (NeonDB) vs \`packages/db/src/schema/vector.ts\` (Supabase)

2. **Check existing schema** for conflicts:
   \`\`\`bash
   # View current schema files
   ls packages/db/src/schema/

   # Check for table name conflicts
   grep -r "export const.*pgTable" packages/db/src/schema/
   \`\`\`

3. **Verify contracts alignment**  -  new tables/columns should have corresponding Zod schemas:
   \`\`\`bash
   ls packages/contracts/src/
   \`\`\`

## Migration Steps

### Step 1: Modify Schema

Edit the appropriate schema file in \`packages/db/src/schema/\`:

- Follow existing patterns (see adjacent schema files)
- Use Drizzle's \`pgTable\`, column types, and relations
- Add indexes for frequently queried columns
- Add \`createdAt\`/\`updatedAt\` timestamps with defaults

### Step 2: Generate Migration

\`\`\`bash
cd packages/db
pnpm drizzle-kit generate
\`\`\`

Review the generated SQL in \`packages/db/drizzle/\`  -  check for:
- Destructive changes (DROP TABLE, DROP COLUMN)
- Data loss risks (column type changes without USING clause)
- Missing indexes on foreign keys

### Step 3: Apply Migration (Development Only)

\`\`\`bash
# Development database ONLY  -  never production
pnpm db:migrate
\`\`\`

**NEVER run \`drizzle-kit push\`**  -  always use \`drizzle-kit migrate\` (the PreToolUse hook blocks \`push\`).

### Step 4: Verify

\`\`\`bash
# Typecheck the db package
pnpm --filter @revealui/db typecheck

# Run db tests
pnpm --filter @revealui/db test

# If schema changes affect contracts, update and test those too
pnpm --filter @revealui/contracts typecheck
pnpm --filter @revealui/contracts test
\`\`\`

### Step 5: Update Contracts (if needed)

If you added new tables or columns that are exposed via the API:

1. Add/update Zod schema in \`packages/contracts/src/\`
2. Export from \`packages/contracts/src/index.ts\`
3. Update any API routes that use the new schema

## Dual-DB Boundary Rules

| If your change touches... | Put it in... | Client |
|---------------------------|-------------|--------|
| Content, users, sessions, products, orders | \`packages/db/src/schema/\` (NeonDB barrel) | Drizzle ORM |
| Vector embeddings, AI memory | \`packages/db/src/schema/vector.ts\` | Supabase client |
| Real-time auth helpers | \`packages/db/src/auth/\` | Supabase client |

**Never mix** NeonDB and Supabase operations in the same module.

## Rollback

If a migration needs to be reverted:

1. Create a new migration that undoes the changes (Drizzle doesn't have built-in rollback)
2. Never manually edit the migration journal (\`_journal.json\`)
3. Document the rollback reason in the migration file comment`,
};
