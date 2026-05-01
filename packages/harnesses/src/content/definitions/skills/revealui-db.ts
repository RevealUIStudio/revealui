import type { Skill } from '../../schemas/skill.js';

export const revealuiDbSkill: Skill = {
  id: 'revealui-db',
  tier: 'pro',
  name: 'RevealUI Database',
  description:
    'RevealUI database conventions for any task involving database, schema, query, migration,\nDrizzle ORM, NeonDB, PostgreSQL, pgvector, embeddings, or data modeling. Reflects the\nNeon-primary architecture (legacy Supabase phase-out in flight).',
  disableModelInvocation: false,
  skipFrontmatter: false,
  filePatterns: [],
  bashPatterns: [],
  references: {},
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
from \`@revealui/mcp\` (\`launchSupabaseMcp\`) and documented in the Pro MCP docs. This is
a customer-extensibility surface, separate from RevealUI's own database stack.

## Schema Organization

\`\`\`
packages/db/src/schema/
├── accounts/, users/, sessions/  # auth + identity (NeonDB)
├── collections/                  # content collections (NeonDB)
├── commerce/                     # products, orders, pricing (NeonDB)
├── rag/                          # rag_documents, rag_chunks, rag_workspaces (NeonDB + pgvector)
└── ...                           # 30+ schema files total
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
2. **Vector data / AI memory** → add to NeonDB with pgvector (already installed)
3. **Customer-bring-your-own DB** → expose via a new MCP adapter in \`@revealui/mcp\`
   following the pattern in \`packages/mcp/src/servers/supabase.ts\`; do not import the
   target DB's client directly into product packages`,
};
