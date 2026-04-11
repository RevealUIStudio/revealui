import type { Rule } from '../../schemas/rule.js';

export const monorepoRule: Rule = {
  id: 'monorepo',
  tier: 'oss',
  name: 'Monorepo Conventions',
  description: 'pnpm workspace, Turborepo, package structure, and publishing conventions',
  scope: 'project',
  preambleTier: 1,
  tags: ['monorepo', 'pnpm', 'turborepo'],
  content: `# Monorepo Conventions

## Structure
- Apps live in \`apps/\`  -  deployable services (Next.js, Hono, Vite)
- Packages live in \`packages/\`  -  shared libraries consumed by apps
- Scripts live in \`scripts/\`  -  CLI tools, automation, CI gates

## Package Manager
- pnpm 10 with workspace protocol
- Internal deps use \`workspace:*\` (never hardcoded versions)
- Run \`pnpm install:clean\` (suppresses Node deprecation warnings)
- \`preinstall\` script enforces pnpm-only (\`npx only-allow pnpm\`)

## Turborepo
- \`turbo run build --parallel\` for parallel builds
- \`turbo run test --concurrency=15\` for parallel tests
- Package-level \`turbo.json\` for task overrides (rare)
- Cache stored in \`.turbo/\` (gitignored)

## Package Conventions
- Every package has: \`build\`, \`dev\`, \`lint\`, \`test\`, \`typecheck\` scripts
- Build output goes to \`dist/\` via tsup
- Source in \`src/\`, tests in \`src/__tests__/\` or \`__tests__/\`
- Entry point: \`src/index.ts\` → \`dist/index.js\`
- Use \`exports\` field in package.json for subpath exports
- Include \`files: ["dist", "README.md"]\` for publishing

## Dependency Rules
- Use \`syncpack\` for version alignment (\`pnpm deps:check\`, \`pnpm deps:fix\`)
- Use \`catalog:\` for shared devDependencies (e.g., \`"zod": "catalog:"\`)
- pnpm overrides in root package.json for security patches
- \`onlyBuiltDependencies\` whitelist for native modules

## CI Gate
- \`pnpm gate\` runs the full CI pipeline locally: lint → typecheck → test → build
- \`pnpm gate:quick\` runs phase 1 only (fast feedback)
- Must pass before pushing (enforced by Husky pre-push hook)

## Adding a New Package
1. Create \`packages/<name>/\` with package.json, tsconfig.json, tsup.config.ts
2. Name: \`@revealui/<name>\`
3. Add \`workspace:*\` references from consuming packages
4. Register in turbo pipeline (automatic via conventions)
5. Add to CI if needed

## Publishing
- OSS packages: \`publishConfig.access: "public"\`, MIT license
- Pro packages: \`publishConfig.access: "public"\`, commercial license (source-available on npm)
- Use changesets for versioning: \`pnpm changeset\` → \`pnpm changeset:version\` → \`pnpm changeset:publish\`

## Import Conventions
- Use package names (\`@revealui/core\`) not relative paths between packages
- Use \`~/\` alias within apps (maps to \`src/*\`)
- Use ES Modules (\`import\`/\`export\`) everywhere`,
};
