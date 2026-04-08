import type { Rule } from '../../schemas/rule.js';

export const skillsUsageRule: Rule = {
  id: 'skills-usage',
  tier: 'pro',
  name: 'Skill Auto-Use Guidelines',
  description: 'When to proactively invoke skills vs wait for explicit user request',
  scope: 'project',
  preambleTier: 4,
  tags: ['skills', 'automation'],
  content: `# Skill Auto-Use Guidelines

When the Skill tool is available, proactively invoke the following skills in these situations:

## Always invoke automatically (no user prompt needed)

- \`/vercel-react-best-practices\` — before completing any PR that touches React components or hooks
- \`/stripe-best-practices\` — any time you write or modify billing, payment, webhook, or Stripe code
- \`/next-best-practices\` — when implementing features in apps/cms or apps/marketing
- \`/next-cache-components\` — when adding 'use cache', cache profiles, or PPR to a Next.js route
- \`/vercel-composition-patterns\` — when adding new components to @revealui/presentation
- \`/web-design-guidelines\` — when asked to review a UI, page, or component for quality
- \`/review\` — when the user asks for a code review, asks to "check" or "look at" code
- \`/add-tests\` — when the user asks to write tests or add coverage for a specific file
- \`/audit\` — before any release or after a large refactor touching multiple packages
- \`/turborepo\` — when modifying turbo.json, pipeline configuration, or monorepo task dependencies

## Only invoke on explicit user request (disable-model-invocation: true)

- \`/gate\` — user must explicitly ask to run the gate
- \`/sync-lts\` — user must explicitly ask to sync or backup
- \`/new-package\` — user must explicitly ask to scaffold a package
- \`/new-professional-project\` — user must explicitly ask to create a project
- \`/vercel-deploy\` — user must explicitly ask to deploy
- \`/deploy-check\` — user must explicitly ask for pre-deploy check
- \`/db-migrate\` — user must explicitly ask to create or apply database migrations
- \`/preflight\` — user must explicitly ask to run the preflight checklist

## When in doubt

If a skill's description matches the current task, prefer invoking it over not invoking it.
The overhead of loading a skill is low; missing relevant guidance has higher cost.`,
};
