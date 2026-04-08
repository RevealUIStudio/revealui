import type { Skill } from '../../schemas/skill.js';

export const revealuiConventionsSkill: Skill = {
  id: 'revealui-conventions',
  tier: 'oss',
  name: 'RevealUI Conventions',
  description:
    'RevealUI coding conventions for any code task — writing, editing, reviewing, creating,\nfixing, refactoring, changing, adding, or updating TypeScript, React, CSS, or config files.\nCovers TypeScript strict mode, ES Modules, Biome formatting, Tailwind v4 syntax,\nconventional commits, monorepo workspace protocol, feature gating, parameterization,\nand unused declaration policy.',
  disableModelInvocation: false,
  skipFrontmatter: false,
  filePatterns: [],
  bashPatterns: [],
  references: {},
  content: `# RevealUI Conventions

Follow these conventions for ALL code in the RevealUI monorepo.

## TypeScript

- Always use strict mode (\`strict: true\` in tsconfig)
- Use ES Modules (\`import\`/\`export\`), never CommonJS (\`require\`)
- Prefer \`interface\` over \`type\` for object shapes (unless union/intersection needed)
- Use explicit return types on exported functions
- Avoid \`any\` — use \`unknown\` and narrow with type guards
- Use \`as const\` for literal objects and arrays when appropriate
- Prefer \`satisfies\` over \`as\` for type assertions when possible
- Use optional chaining (\`?.\`) and nullish coalescing (\`??\`) over manual checks
- Async/await over \`.then()\` chains

## Git

### Commit Messages
- Use conventional commits: \`type(scope): description\`
- Types: feat, fix, refactor, docs, test, chore, ci, perf
- Scope is optional, use package name for monorepos (e.g., \`feat(core): add parser\`)
- Description in imperative mood, lowercase, no period
- Keep subject line under 72 characters

### Branch Naming
- Feature: \`feat/<short-description>\`
- Bugfix: \`fix/<short-description>\`
- Chore: \`chore/<short-description>\`

### Identity
- RevealUI Studio <founder@revealui.com>

## Monorepo

### Structure
- Apps live in \`apps/\` — deployable services (Next.js, Hono, Vite)
- Packages live in \`packages/\` — shared libraries consumed by apps
- Scripts live in \`scripts/\` — CLI tools, automation, CI gates

### Package Manager
- pnpm 10 with workspace protocol
- Internal deps use \`workspace:*\` (never hardcoded versions)
- Run \`pnpm install:clean\` (suppresses Node deprecation warnings)
- \`preinstall\` script enforces pnpm-only (\`npx only-allow pnpm\`)

### Turborepo
- \`turbo run build --parallel\` for parallel builds
- \`turbo run test --concurrency=15\` for parallel tests
- Package-level \`turbo.json\` for task overrides (rare)
- Cache stored in \`.turbo/\` (gitignored)

### Package Conventions
- Every package has: \`build\`, \`dev\`, \`lint\`, \`test\`, \`typecheck\` scripts
- Build output goes to \`dist/\` via tsup
- Source in \`src/\`, tests in \`src/__tests__/\` or \`__tests__/\`
- Entry point: \`src/index.ts\` → \`dist/index.js\`
- Use \`exports\` field in package.json for subpath exports
- Include \`files: ["dist", "README.md"]\` for publishing

### Dependency Rules
- Use \`syncpack\` for version alignment (\`pnpm deps:check\`, \`pnpm deps:fix\`)
- Use \`catalog:\` for shared devDependencies (e.g., \`"zod": "catalog:"\`)
- pnpm overrides in root package.json for security patches

### CI Gate
- \`pnpm gate\` runs the full CI pipeline locally: lint → typecheck → test → build
- \`pnpm gate:quick\` runs phase 1 only (fast feedback)
- Must pass before pushing (enforced by Husky pre-push hook)

### Adding a New Package
1. Create \`packages/<name>/\` with package.json, tsconfig.json, tsup.config.ts
2. Name: \`@revealui/<name>\`
3. Add \`workspace:*\` references from consuming packages
4. Register in turbo pipeline (automatic via conventions)

### Publishing
- OSS packages: \`publishConfig.access: "public"\`, MIT license
- Pro packages: \`"private": true\` (not published to npm)
- Use changesets for versioning: \`pnpm changeset\` → \`pnpm changeset:version\` → \`pnpm changeset:publish\`

### Import Conventions
- Use package names (\`@revealui/core\`) not relative paths between packages
- Use \`~/\` alias within apps (maps to \`src/*\`)
- Use ES Modules (\`import\`/\`export\`) everywhere

## Biome

Biome 2 is the sole linter and formatter for this monorepo.

### Commands
- \`pnpm lint\` — check all files (\`biome check .\`)
- \`pnpm format\` — format all files (\`biome format --write .\`)
- \`pnpm lint:fix\` — auto-fix (\`biome check --write .\`)

### Key Rules
- No unused variables or imports (auto-removed on format)
- No \`console.*\` in production code (use \`@revealui/utils\` logger)
- No \`any\` types (use \`unknown\` + type guards)
- Consistent import ordering (auto-sorted)
- Single quotes for strings
- Trailing commas
- Semicolons always
- 2-space indentation

### Suppressing Rules
- Use \`// biome-ignore <rule>: <reason>\` for specific lines
- Avoid blanket suppressions — prefer fixing the code
- Document why a suppression is needed

## Tailwind v4

RevealUI uses **Tailwind CSS v4** (\`^4.1.18\`). Key syntax changes from v3:

### Must-Know Gotchas

\`\`\`css
/* CORRECT (v4) */
@import "tailwindcss";

/* WRONG (v3) */
@tailwind base;
@tailwind components;
@tailwind utilities;
\`\`\`

\`\`\`css
/* CORRECT (v4) */
@utility my-util { /* styles */ }

/* WRONG (v3) */
@layer utilities { .my-util { /* styles */ } }
\`\`\`

\`\`\`html
<!-- CORRECT (v4) — parentheses for CSS vars -->
<div class="bg-(--brand-color)">

<!-- WRONG (v3) — square brackets -->
<div class="bg-[--brand-color]">
\`\`\`

\`\`\`html
<!-- CORRECT (v4) — important at the end -->
<div class="bg-red-500!">

<!-- WRONG (v3) — important at the start -->
<div class="bg-!red-500">
\`\`\`

### Rules for New Code
1. Never use \`@tailwind\` directives — use \`@import "tailwindcss"\`
2. Never use \`@layer utilities\` or \`@layer components\` — use \`@utility\`
3. Use \`bg-(--var)\` syntax for CSS variables, not \`bg-[--var]\`
4. Important goes at the end: \`bg-red-500!\` not \`!bg-red-500\`
5. Prefer \`gap\` over \`space-*\` / \`divide-*\` for spacing in flex/grid
6. No \`transform-none\` — use \`scale-none\`, \`rotate-none\`, \`translate-none\`

## Parameterization

**Never hardcode configuration values inline.** All tunable constants (TTLs, limits, lengths, thresholds, intervals) must be:

1. **Extracted** into a named config object or constant at module scope
2. **Typed** with an explicit interface
3. **Defaulted** with sensible production values
4. **Overridable** via an exported \`configure*()\` function or constructor parameter

### Pattern

\`\`\`ts
export interface ModuleConfig {
  /** TTL in milliseconds (default: 5 minutes) */
  ttlMs: number
  /** Max entries before forced cleanup (default: 10_000) */
  maxEntries: number
}

const DEFAULT_CONFIG: ModuleConfig = {
  ttlMs: 5 * 60 * 1000,
  maxEntries: 10_000,
}

let config: ModuleConfig = { ...DEFAULT_CONFIG }

export function configureModule(overrides: Partial<ModuleConfig>): void {
  config = { ...DEFAULT_CONFIG, ...overrides }
}
\`\`\`

### Applies To
- Rate limit windows and thresholds
- Cache TTLs and max sizes
- OTP/token lengths and expiry times
- Retry counts and backoff intervals
- Batch sizes and concurrency limits

### Does NOT Apply To
- Structural constants (HTTP status codes, header names, URL paths)
- Type discriminants and enum values
- Schema definitions (use contracts)

## Unused Declarations

**NEVER suppress an unused variable/import warning without first determining if the code is incomplete.**

### Mandatory Decision Tree

\`\`\`
1. Stub or placeholder?
   → IMPLEMENT the missing functionality. Do not suppress.

2. Intentional side-effect resource?
   → Rename with \`_\` prefix. Add a comment explaining WHY.

3. Type-only import?
   → Change to \`import type { ... }\`.

4. Required callback parameter?
   → Prefix with \`_\` (e.g. \`_req\`). Comment if non-obvious.

5. Genuinely dead code?
   → DELETE entirely. No grace periods.
\`\`\`

### Verification After Any Lint Fix

\`\`\`bash
pnpm --filter <package> typecheck
node_modules/.bin/biome check <file>
pnpm --filter <package> test   # if you implemented a stub
\`\`\`

## Feature Gating

### Tier Model

| Tier | Code String | Distribution |
|------|-------------|-------------|
| Free | \`'free'\` | MIT, open source |
| Pro | \`'pro'\` | Source-available, commercially licensed |
| Max | \`'max'\` | Extended Pro features |
| Enterprise (Forge) | \`'enterprise'\` | White-label (planned), multi-tenant, self-hosted |

### Runtime Checks

\`\`\`ts
import { isLicensed, isFeatureEnabled } from '@revealui/core'

if (isLicensed('pro')) { /* Pro+ feature */ }
if (isFeatureEnabled('ai')) { /* AI feature (requires Pro) */ }
\`\`\`

### Package Boundaries
- **OSS**: \`@revealui/core\`, \`contracts\`, \`db\`, \`auth\`, \`presentation\`, \`router\`, \`config\`, \`utils\`, \`cli\`, \`setup\`, \`sync\`, \`dev\`, \`test\`
- **Pro**: \`@revealui/ai\`, \`mcp\`, \`editors\`, \`services\`, \`harnesses\`

### Rules
1. OSS packages must never import from Pro packages
2. Pro packages may import from OSS packages
3. Public tests must not hard-require Pro package source paths
4. Feature gates use \`isLicensed()\` / \`isFeatureEnabled()\`, not environment variables`,
};
