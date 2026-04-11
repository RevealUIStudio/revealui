export function generateAntigravityRules(): string {
  return `# RevealUI — Antigravity Agent Rules

## Project Context

RevealUI is a TypeScript monorepo. Five primitives: Users · Content · Products · Payments · AI.
Stack: React 19, Next.js 16, Hono, Drizzle ORM, Tailwind CSS v4, Biome 2, Vitest 4.
Package manager: pnpm 10 (\`workspace:*\` for internal deps).

## Key Packages

- \`@revealui/core\`  -  Runtime engine, collections, access control, hooks
- \`@revealui/db\`  -  Drizzle schema (NeonDB) + vector schema (Supabase)
- \`@revealui/auth\`  -  session auth, bcrypt, rate limiting
- \`@revealui/contracts\`  -  Zod schemas (canonical source of truth)
- \`@revealui/presentation\`  -  UI components (Tailwind v4)

## Agent Guidelines

- Run \`pnpm --filter <package> typecheck\` after editing any package
- Run \`pnpm --filter <package> test\` to verify tests pass
- Use \`pnpm gate:quick\` for fast quality check (lint + typecheck)
- Use \`pnpm gate\` before pushing (full CI: lint, typecheck, test, build)
- Biome 2 is the formatter/linter  -  do not add ESLint or Prettier config
- All new code must use ES Modules (\`import\`/\`export\`)
- No \`any\` types  -  use \`unknown\` with type guards
- Soft-delete: set \`deletedAt\` instead of hard-deleting rows

## Database Rules

- NeonDB (Drizzle ORM): all REST content (users, sessions, posts, media, etc.)
- Supabase: vector embeddings only (\`packages/db/src/vector/\`)
- Never import \`@supabase/supabase-js\` outside designated vector/auth modules
`.trimEnd();
}
