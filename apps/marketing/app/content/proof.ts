// Sourced from: app/components/landing/Proof.tsx (Phase 1c extraction).
// Phase 3 (2026-05-18) update: the "23 of 29 total packages MIT" trust card
// heading (as it read then) now uses METRICS license split (21 MIT).
// Pre-Phase-3 audit had off-by-one count.
// Per the internal marketing-overhaul plan §4.4 + docs/MARKETING_METRICS.md §1.
//
// 2026-07-11 (homepage-truth): cut hard on an owner-directed audit. Removed:
// the shields.io README badges (open-source furniture doing customer-proof
// work, hardcoded the retired emerald 10b981 brand color, and made third-party
// requests on every page load); the raw tech-stack grid and CI-tool list (a
// buyer does not care that this runs on Vite); the governance/receipt proof
// beat (two independent code audits found the audit-chain and tamper-evidence
// claims are not true in the shipped code: prod never installs Postgres audit
// storage, request-level writes are rejected by a CHECK constraint, and no row
// has ever carried a signature. content/governance.ts and its PROOF_GOVERNANCE
// are deleted in this PR; the rebuild is tracked as a gap with the owner in the
// loop); the persona checklist (duplicated the "who it's for" framing and
// led with the same unproven audit-trail claim); and the local-AI beat (its
// own page covers this). What remains is what a buyer needs to decide whether
// to trust the repo: it is inspectable, and the numbers are checkable.

import { METRICS, SITE } from './site';

export const PROOF_SECTION = {
  eyebrow: 'Open source',
  heading: 'Inspect the code before you commit to it.',
  body: 'The entire runtime sits in the public repo under an open license. Read it, run it, or fork it before you build on it.',
  repoLinkLabel: 'View the repo on GitHub',
} as const;

// One trust point, kept as prose rather than a card: the buyer question this
// answers is whether their security team can read the code, not what
// framework it runs on.
export const PROOF_TRUST = {
  body: 'Your security team can read every line. The whole runtime is open source, MIT or Fair Source, sitting in the repo. There is no closed binary to explain away when procurement comes asking.',
  linkLabel: 'Read the LICENSE',
  linkHref: SITE.urls.repoLicense,
  changelogCta: {
    label: 'See what shipped this month →',
    href: SITE.urls.repoChangelog,
  },
} as const;

// Secondary FDE / deployers band (ADR 2026-07-21 accepted). Nested under Proof
// so the homepage stays within the ≤7 section hard rule (ADR 2026-07-10).
// Never a H1 or primary ICP. Copy pack §3 (scenario first, runtime noun).
export const PROOF_DEPLOYERS = {
  eyebrow: 'For deployers',
  heading: 'Built for people who deploy, not only demo.',
  body: 'Some buyers install RevealUI themselves. Some hire us, or their own forward-deployed engineer, to stamp and hand over a fleet. Either way the outcome is the same: a self-hosted runtime where the business and its agents live under one roof, on infrastructure the customer owns.',
  foil: 'Cloud agent platforms rent you an outcome. A forward-deployed engagement leaves a runtime the customer runs.',
  cta: {
    label: 'Work with Studio',
    href: SITE.urls.agency,
    external: true,
  },
} as const;

// Live-metrics snapshot badge. Every integer is read from site.ts METRICS, which
// is pinned to the codebase by the claim-drift gate (build fails on drift). The
// badge links to that validator so the "live from the repo" claim is checkable.
export interface LiveMetric {
  readonly value: number;
  readonly label: string;
}

export const LIVE_METRICS = {
  eyebrow: 'Live from the repo',
  heading: 'Every number here is pinned to the codebase.',
  body: 'These counts are validated on every PR by the claim-drift gate. If the code changes and a number drifts, the build fails before it can ship.',
  metrics: [
    { value: METRICS.packages, label: 'packages' },
    { value: METRICS.apps, label: 'apps' },
    { value: METRICS.testFiles, label: 'test files' },
    { value: METRICS.uiComponents, label: 'UI components' },
    { value: METRICS.mcpServers, label: 'MCP servers' },
    { value: METRICS.dbTables, label: 'DB tables' },
  ] as readonly LiveMetric[],
  validatorLabel: 'See the validator →',
  validatorHref: `${SITE.urls.repo}/blob/main/scripts/validate/claim-drift.ts`,
} as const;
