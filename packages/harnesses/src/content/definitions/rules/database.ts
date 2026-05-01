import type { Rule } from '../../schemas/rule.js';

export const databaseRule: Rule = {
  id: 'database',
  tier: 'oss',
  name: 'Database Conventions',
  description: 'Neon-primary database conventions (legacy Supabase phase-out) and query patterns',
  scope: 'project',
  preambleTier: 2,
  tags: ['database', 'architecture', 'drizzle'],
  content: `# Database Conventions

## Architecture

RevealUI uses **NeonDB (PostgreSQL via \`@neondatabase/serverless\`)** as the primary
database for all internal usage: collections, users, sessions, orders, products, AI
memory, and vector embeddings (via pgvector).

Legacy Supabase code remains in tree during the Supabase phase-out and is being
progressively removed. **Do not add new \`@supabase/*\` imports to any package** — new
features must depend on NeonDB only.

## Customer-extensible MCP adapter (intentionally retained)

The Supabase MCP adapter at \`packages/mcp/src/servers/supabase.ts\` is intentionally
retained as an OSS adapter for customers who run their own Supabase. It is exported
from \`@revealui/mcp\` (\`launchSupabaseMcp\`) and documented in the Pro MCP docs
(\`apps/docs/public/docs-pro/mcp/index.md\`). This is a customer-extensibility surface,
separate from RevealUI's own database stack — it does not contradict the "no new
Supabase imports" rule for product code.

## Schema Organization

\`\`\`
packages/db/src/schema/
├── accounts.ts       # user accounts
├── agents.ts         # AI agent definitions
├── api-keys.ts       # API key management
├── admin.ts          # admin collections, media
├── gdpr.ts           # GDPR consent, deletion
├── licenses.ts       # license keys, tiers
├── pages.ts          # pages, navigation
├── sites.ts          # multi-tenant sites
├── tickets.ts        # support tickets
├── users.ts          # user management, sessions
├── rest.ts           # REST schema barrel
├── index.ts          # Combined schema export
└── ...               # 30+ schema files total
\`\`\`

## Query Pattern

\`\`\`ts
import { db } from '@revealui/db'
import { posts } from '@revealui/db/schema'

const results = await db.select().from(posts).where(eq(posts.status, 'published'))
\`\`\`

## Migration Guidance

When adding new features:
1. **Content/REST data** → add to \`packages/db/src/schema/\` + use Drizzle on NeonDB
2. **Vector data / AI memory** → add to NeonDB with pgvector (already installed; see
   \`rag_documents\`, \`rag_chunks\`, \`rag_workspaces\`)
3. **Customer-bring-your-own DB** → expose via a new MCP adapter in \`@revealui/mcp\`
   following the pattern in \`packages/mcp/src/servers/supabase.ts\`; do not import the
   target DB's client directly into product packages`,
};
