import type { Skill } from '../../schemas/skill.js';

export const revealuiSafetySkill: Skill = {
  id: 'revealui-safety',
  tier: 'oss',
  name: 'RevealUI Safety',
  description:
    'RevealUI safety guardrails for any code task  -  editing, writing, creating, fixing,\nrefactoring, changing, adding, updating, or removing files. Protects credentials,\nenforces import boundaries, ensures code quality, and verifies work before completion.',
  disableModelInvocation: false,
  skipFrontmatter: false,
  filePatterns: [],
  bashPatterns: [],
  references: {},
  content: `# RevealUI Safety

Follow these rules for ALL code changes in the RevealUI monorepo.

## Protected Files  -  Ask Before Editing

- \`.env*\` files (\`.env\`, \`.env.local\`, \`.env.production\`, etc.)
- Lock files: \`pnpm-lock.yaml\`, \`package-lock.json\`, \`yarn.lock\`
- Database schema files in \`packages/db/src/schema/\`  -  changes require migration planning

## Protected Paths  -  Never Edit

- Windows host mounts (typically \`/mnt/c/\`) and the LTS backup mount (\`$LTS_ROOT\`, typically \`/mnt/e/\`)  -  read-only
- System/credential directories: \`/etc/\`, \`~/.ssh/\`, \`~/.gnupg/\`, \`~/.aws/\`

## Import Boundaries

Do NOT add new \`@supabase/*\` imports to any package. RevealUI uses NeonDB as the
primary database; legacy Supabase code remains in tree during the Supabase phase-out
and is being progressively removed. The only intentional Supabase touch-point is the
customer-extensible MCP adapter at \`packages/mcp/src/servers/supabase.ts\`.

If you find yourself wanting to import \`@supabase/*\`, instead:
- Use Drizzle + NeonDB for content/REST data
- Use NeonDB + pgvector for vector embeddings (already installed)
- Expose customer-bring-your-own DB via a new MCP adapter in \`@revealui/mcp\`

## Code Quality

- Never use \`any\`  -  use \`unknown\` + type guards
- Never add \`console.*\` in production code  -  use \`@revealui/utils\` logger
- Never hardcode API keys, tokens, passwords, or secrets
- Use \`crypto.randomInt()\` for security-sensitive values, not \`Math.random()\`

## Static Analysis

- For security and architecture validation scripts, prefer AST-based analysis over regex when the rule depends on syntax or code shape
- Use regex only for heuristic inventory scans (for example obvious secret patterns), not as the source of truth for code-security conclusions

## After Every Edit

Run \`npx biome check --write <file>\` on each file you edit before moving on.

## Before Claiming Done

1. Run \`pnpm gate:quick\` and confirm no new errors
2. Review \`git diff\` for unintended changes
3. Ensure conventional commit format: \`type(scope): description\`
4. Git identity: RevealUI Studio <founder@revealui.com>

## Known Limitation

These rules are advisory. Unlike Claude Code (which enforces via lifecycle hooks), Codex has no hook system. If working on sensitive files, explicitly invoke \`$revealui-safety\` to load these rules.`,
};
