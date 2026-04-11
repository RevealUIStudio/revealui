import type { Rule } from '../../schemas/rule.js';

export const agentDispatchRule: Rule = {
  id: 'agent-dispatch',
  tier: 'pro',
  name: 'Agent Profile Dispatch',
  description: 'When to spawn specialized agent profiles from .claude/agents/',
  scope: 'project',
  preambleTier: 4,
  tags: ['agents', 'coordination'],
  content: `# Agent Profile Dispatch

Profiles live in \`.claude/agents/\`. Spawn them via the Agent tool when a task is
too large or specialized for the current session.

## Profiles

| Profile | When to spawn |
|---------|--------------|
| \`gate-runner\` | Running the full CI gate (\`pnpm gate\`), verifying the repo is clean before a push or release |
| \`security-reviewer\` | Auditing auth flows, reviewing security-sensitive PRs, checking new API routes for vulnerabilities |
| \`builder\` | Large feature implementation spanning multiple packages that would pollute the current session context |
| \`tester\` | Writing test suites, achieving coverage targets, fixing batches of failing tests |
| \`docs-sync\` | Updating public docs, syncing API reference, writing changelogs, keeping MASTER_PLAN in sync |
| \`linter\` | Bulk lint fixes, unused declaration sweeps, \`any\` type removal, Biome cleanup across the monorepo |

## Rules

1. Don't spawn a profile for work that takes under 15 minutes in the current session.
2. Check the workboard before spawning  -  another agent may already own that area.
3. Always give spawned agents:
   - Current phase from \`~/projects/revealui-jv/docs/MASTER_PLAN.md\`
   - Relevant workboard state
   - The specific task and acceptance criteria
4. Spawned agents report findings back to the parent. Only the parent updates MASTER_PLAN.md.
5. Spawned agents must not create plan files outside MASTER_PLAN.md (see \`planning.md\`).`,
};
