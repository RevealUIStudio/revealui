export function generateCursorRules(): string {
  return `# RevealUI — Cursor Rules

## Project

RevealUI is a TypeScript monorepo (pnpm + Turborepo) providing business infrastructure:
Users, Content, Products, Payments, and AI — pre-wired and ready to deploy.

## Stack

- TypeScript 5.9 (strict mode, ESM only)
- React 19, Next.js 16, Hono
- Drizzle ORM — NeonDB (REST) + Supabase (vectors)
- Tailwind CSS v4, Biome 2, Vitest 4

## Package Map

- \`@revealui/core\` — CMS engine, collections, access control, hooks
- \`@revealui/db\` — Drizzle schema + queries (dual-DB: Neon + Supabase)
- \`@revealui/auth\` — session auth, password reset, rate limiting
- \`@revealui/contracts\` — Zod schemas (single source of truth for types)
- \`@revealui/presentation\` — 50+ UI components (Tailwind v4, no external UI deps)

## Rules

- Use \`workspace:*\` for internal package deps
- Use \`~/\` alias inside apps (maps to \`src/*\`)
- Biome formats on save — do not add Prettier or ESLint config
- Async/await over \`.then()\` chains
- \`interface\` over \`type\` for object shapes (unless union/intersection needed)
- No \`any\` — use \`unknown\` with type guards
- Vitest for tests, not Jest
- pnpm only (\`npm\`/\`yarn\` blocked by preinstall hook)
- Soft-delete: set \`deletedAt\` instead of hard-deleting rows
`.trimEnd();
}
