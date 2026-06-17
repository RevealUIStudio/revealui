// Sourced from: app/components/landing/Proof.tsx (Phase 1c extraction).
// Phase 3 (2026-05-18) update: "21 of 27 packages MIT" trust card heading now
// uses METRICS license split (21 MIT). Pre-Phase-3 audit had off-by-one count.
// Per docs/lanes/marketing-overhaul/plan.md §4.4 + docs/MARKETING_METRICS.md §1.

import { METRICS, SITE } from './site';

export interface StackItem {
  readonly label: string;
  readonly kind: string;
}

export const PROOF_SECTION = {
  eyebrow: 'The stack so far',
  heading: 'Built in the open. Verifiable in the repo.',
  body: 'Every package, every PR, every test. Inspect the code before you commit a single line of your own.',
} as const;

export const PROOF_REPO_SIGNALS = {
  eyebrow: 'On GitHub',
  heading: 'Live signals',
  repoHref: SITE.urls.repo,
  ciLabel: 'Quality gates that block every PR',
} as const;

export const PROOF_CI_SIGNALS: readonly string[] = [
  'Biome lint + format',
  'Vitest unit + integration',
  'Playwright E2E',
  'CodeQL + Gitleaks',
  'TypeScript strict, repo-wide',
  'Affected-only PR gate',
] as const;

export const PROOF_STACK: readonly StackItem[] = [
  { label: 'Vite', kind: 'Marketing + docs frontends' },
  { label: 'Next.js 16', kind: 'Admin frontend' },
  { label: 'React 19', kind: 'UI runtime' },
  { label: 'PostgreSQL', kind: 'Database' },
  { label: 'Drizzle', kind: 'ORM' },
  { label: 'Stripe', kind: 'Payments' },
  { label: 'Hono', kind: 'API + edge' },
  { label: 'MCP', kind: 'Agent protocol' },
  { label: 'Tailwind', kind: 'Design system' },
] as const;

export const PROOF_STACK_PANEL = {
  eyebrow: 'No proprietary lock-in',
  heading: 'Yours to own. Theirs to trust.',
  body: "Nothing here is proprietary. Open protocols (OAuth, JWT, MCP, OpenAPI) run over a stack your team already knows, so there's no new framework to learn and no platform to trap you.",
} as const;

// Portability proof for the stack panel. The deploy/data-portability claim (the
// no-lock-in lead benefit) gets its own visual strip beneath the familiar-stack
// chip grid, so it is shown rather than only asserted in the body. Two beats,
// one root cause: standard parts -> familiar (the chips) AND yours to move (this).
export const PROOF_PORTABILITY = {
  deployLabel: 'Runs anywhere',
  deployTargets: ['Vercel', 'Cloudflare', 'Fly', 'Hetzner', 'self-host'],
  dataLabel: 'Your data stays yours',
  dataNote: 'Standard Postgres, export anytime.',
} as const;

export const PROOF_TRUST = {
  eyebrow: 'Trust',
  heading: 'Verifiable in three places.',
  cards: [
    {
      eyebrow: 'In the repo',
      heading: `${METRICS.licenseSplit.mit} of ${METRICS.packages} packages MIT, forever.`,
      body: {
        prefix: `The ${METRICS.licenseSplit.fsl} Pro packages ship under Fair Source (FSL-1.1-MIT) and auto-convert to MIT two years after each release. View the`,
        licenseLabel: 'LICENSE',
        licenseHref: SITE.urls.repoLicense,
        middle: 'or the',
        explainerLabel: 'Fair Source explainer',
        explainerHref: '/fair-source',
        suffix: '.',
      },
    },
    {
      eyebrow: 'In the schema',
      heading: 'Every mutation signs into a hash chain.',
      codeSnippet: `// HMAC-SHA256 signature for tamper detection
signature:         text('signature'),
// Signature of the prior entry — the chain link
previousSignature: text('previous_signature'),`,
      fileLabel: 'packages/db/src/schema/audit-log.ts',
      fileHref: `${SITE.urls.repo}/blob/main/packages/db/src/schema/audit-log.ts`,
      caption: '(tampering breaks the chain).',
    },
    {
      eyebrow: 'In production',
      heading: 'This site runs on RevealUI.',
      body: {
        prefix: 'The marketing site you are reading and the agency site at',
        agencyLabel: 'revealuistudio.com',
        agencyHref: SITE.urls.agency,
        middle: 'both run on',
        pkg1: '@revealui/router',
        plus: '+',
        pkg2: '@revealui/presentation',
        suffix: '. View the',
        sourceLabel: 'marketing app source',
        sourceHref: `${SITE.urls.repo}/tree/main/apps/marketing`,
        end: '.',
      },
    },
  ],
  changelogCta: {
    label: 'See what shipped this month →',
    href: SITE.urls.repoChangelog,
  },
} as const;
