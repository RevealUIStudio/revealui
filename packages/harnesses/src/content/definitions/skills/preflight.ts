import type { Skill } from '../../schemas/skill.js';

export const preflightSkill: Skill = {
  id: 'preflight',
  tier: 'oss',
  name: 'Preflight Check',
  description:
    'Run the 15-check pre-launch preflight and interpret results with context-aware fix suggestions',
  disableModelInvocation: true,
  skipFrontmatter: false,
  filePatterns: [],
  bashPatterns: [],
  references: {},
  content: `# Preflight Check

Run the full pre-launch preflight checklist and interpret results.

## Run

\`\`\`bash
pnpm preflight
\`\`\`

This runs 15 checks covering lint, types, tests, build, security, and structure.

## Interpreting Results

### Hard Failures (must fix before launch)

| Check | What It Means | Common Fix |
|-------|--------------|------------|
| **Biome lint** | Code style or correctness violation | \`pnpm lint:fix\` then review remaining |
| **TypeScript** | Type errors across workspaces | \`pnpm typecheck:all\` to see full list |
| **Build** | Compilation failure in one or more packages | Check \`dist/\` output, tsup config |
| **Tests** | Unit/integration test failures | \`pnpm test\` to see which tests fail |

### Warn-Only (should fix, won't block)

| Check | What It Means | Common Fix |
|-------|--------------|------------|
| **\`any\` audit** | Avoidable \`any\` types found | \`pnpm audit:any\`  -  use \`unknown\` + type guards |
| **Console audit** | \`console.*\` in production code | \`pnpm audit:console\`  -  use \`@revealui/utils\` logger |
| **Structure** | Supabase boundary violations or package issues | \`pnpm validate:structure\` |
| **Security** | CSP, CORS, or header issues | Check \`packages/security/\` |
| **Dependencies** | Version mismatches across workspaces | \`pnpm deps:check\` then \`pnpm deps:fix\` |

## After Preflight

If all hard checks pass:

1. Run \`pnpm gate\` for the full CI gate (superset of preflight)
2. Check for uncommitted changes: \`git status\`
3. Review the deployment checklist: \`/deploy-check\`

If checks fail, fix in priority order:
1. Build failures (blocks everything)
2. Type errors (blocks CI)
3. Test failures (blocks confidence)
4. Lint issues (blocks merge)
5. Warn-only items (fix before release)`,
};
