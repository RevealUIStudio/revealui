// Sourced from: app/components/landing/Proof.tsx (Phase 1c extraction).
// Phase 3 (2026-05-18) update: "21 of 27 packages MIT" trust card heading now
// uses METRICS license split (21 MIT). Pre-Phase-3 audit had off-by-one count.
// Per docs/lanes/marketing-overhaul/plan.md §4.4 + docs/MARKETING_METRICS.md §1.

import { SITE } from './site';

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

export interface TrustCard {
  readonly title: string;
  readonly body: string;
  readonly linkLabel: string;
  readonly linkHref: string;
}

export const PROOF_TRUST = {
  eyebrow: 'Proof, not promises',
  heading: "Don't take our word for it. Neither will your customers.",
  cards: [
    {
      title: 'Their security team can read every line.',
      body: 'The whole runtime is open source, MIT or Fair Source, sitting in the repo. No closed binary to explain away when procurement comes asking.',
      linkLabel: 'Read the LICENSE',
      linkHref: SITE.urls.repoLicense,
    },
    {
      title: 'Prove what happened, by anyone or anything.',
      body: 'Every change, by a person or an agent, signs into a tamper-evident chain. Alter one record and the chain breaks. Nothing gets quietly rewritten.',
      linkLabel: 'See the schema',
      linkHref: `${SITE.urls.repo}/blob/main/packages/db/src/schema/audit-log.ts`,
    },
    {
      title: 'We bet our own business on it.',
      body: 'This site and our agency site both run on RevealUI, and the code, data, and infrastructure are yours to keep. If it breaks for you, it breaks for us first, and you are never stranded with a vendor.',
      linkLabel: 'Read the source',
      linkHref: `${SITE.urls.repo}/tree/main/apps/marketing`,
    },
  ] as readonly TrustCard[],
  changelogCta: {
    label: 'See what shipped this month →',
    href: SITE.urls.repoChangelog,
  },
} as const;
