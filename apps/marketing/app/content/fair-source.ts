// Sourced from: app/routes/FairSourcePage.tsx (Phase 1 extraction).
// Hero headline + body math reference the METRICS license split
// (validator: 26 MIT + 5 FSL + 2 internal = 33 packages). The internal
// packages are @revealui/scripts and @revealui/apify-actor-governed-run
// (both private, no license field).
// Per the internal marketing-overhaul plan §4.4 + docs/MARKETING_METRICS.md §1.
// claims-ratchet 2026-07-12: services description scoped to Stripe + email,
// internal-package identity corrected, MIT-conversion example made version-agnostic.

import { METRICS, SITE } from './site';
import type { FaqItem } from './types';

export interface ContractCard {
  readonly kind: 'yes' | 'no';
  readonly title: string;
  readonly body: string;
}

export interface FslPackage {
  readonly name: string;
  readonly purpose: string;
  readonly license: string;
  readonly repo: string;
  readonly npm: string;
}

export interface LicensePeer {
  readonly name: string;
  readonly note: string;
  readonly url: string;
}

export const FAIR_SOURCE_PAGE_TITLE = 'Fair Source | RevealUI';

export const FAIR_SOURCE_HERO = {
  eyebrow: 'License contract for the Pro packages',
  headline: `${METRICS.licenseSplit.mit} of ${METRICS.packages} MIT.`,
  headlineHighlight: 'Forever.',
  subhead: `The ${METRICS.licenseSplit.fsl} commercial packages convert to MIT after 2 years.`,
  body: {
    prefix: `${METRICS.licenseSplit.mit} RevealUI packages ship under plain MIT and stay that way. ${METRICS.licenseSplit.fsl} packages ship under`,
    fslLabel: 'FSL-1.1-MIT',
    fslHref: SITE.urls.fslSoftware,
    suffix: `: source-visible, commercially usable, and MIT conversion follows the published Change Date and anniversary terms. Same license model used by Sentry, GitButler, and Keygen. (The remaining ${METRICS.licenseSplit.internal} workspace packages are @revealui/scripts and @revealui/apify-actor-governed-run, private tooling with no public license field, not customer-facing.)`,
  },
  ogTitle: 'Fair Source',
  ogSubtitle: 'Source available. Published license terms apply.',
} as const;

export const FAIR_SOURCE_CONTRACT_SECTION = {
  eyebrow: 'The contract, in plain English',
  heading: 'Three yeses and one no.',
} as const;

export const FAIR_SOURCE_CONTRACT_CARDS: readonly ContractCard[] = [
  {
    kind: 'yes',
    title: 'Use it commercially',
    body: 'Ship Fair Source code in your product, charge customers, run it in production. No royalties, no per-seat fees, no usage caps.',
  },
  {
    kind: 'yes',
    title: 'Read and modify the source',
    body: 'Every line is on GitHub. Fork it, patch it, audit it for security. The source is the source of truth. There is no closed binary hiding behind it.',
  },
  {
    kind: 'yes',
    title: 'Self-host on your own infra',
    body: 'Run it in your VPC, on bare metal, or air-gapped. Paid features require valid entitlement; hosted APIs and third-party integrations have their own dependencies.',
  },
  {
    kind: 'no',
    title: 'Build a competing developer platform',
    body: 'Competing uses are restricted by the package’s published license. Read its permitted-purpose, restriction, and conversion terms before relying on it.',
  },
];

export const FAIR_SOURCE_PACKAGES_SECTION = {
  eyebrow: 'Scope',
  heading: 'Which RevealUI packages are Fair Source.',
  body: {
    prefix:
      'Five packages carry FSL-1.1-MIT: the four published to npm are listed below, plus the private',
    privatePackage: '@revealui/engines',
    suffix:
      'workspace package. The core is MIT. Check each package’s license; internal workspace tooling can have different status.',
  },
  footer: {
    prefix: "Looking for a specific package's license? Run",
    command: 'npm view @revealui/<name> license',
    suffix: ': compare registry metadata with the LICENSE file included in the version you use.',
  },
} as const;

export const FAIR_SOURCE_PACKAGES: readonly FslPackage[] = [
  {
    name: '@revealui/ai',
    purpose: 'AI agents, CRDT memory, LLM provider abstractions, orchestration',
    license: 'FSL-1.1-MIT',
    repo: 'https://github.com/RevealUIStudio/revealui/tree/main/packages/ai',
    npm: 'https://www.npmjs.com/package/@revealui/ai',
  },
  {
    name: '@revealui/harnesses',
    purpose: 'AI harness adapters, workboard coordination, JSON-RPC primitives',
    license: 'FSL-1.1-MIT',
    repo: 'https://github.com/RevealUIStudio/revealui/tree/main/packages/harnesses',
    npm: 'https://www.npmjs.com/package/@revealui/harnesses',
  },
  {
    name: '@revealui/mcp',
    purpose: 'MCP framework: server hypervisor, adapter pattern, tool discovery',
    license: 'FSL-1.1-MIT',
    repo: 'https://github.com/RevealUIStudio/revealui/tree/main/packages/mcp',
    npm: 'https://www.npmjs.com/package/@revealui/mcp',
  },
  {
    name: '@revealui/services',
    purpose: 'External service integrations: Stripe billing and email delivery.',
    license: 'FSL-1.1-MIT',
    repo: 'https://github.com/RevealUIStudio/revealui/tree/main/packages/services',
    npm: 'https://www.npmjs.com/package/@revealui/services',
  },
];

export const FAIR_SOURCE_CLOCK_SECTION = {
  eyebrow: 'Published change-date terms',
  heading: 'MIT conversion follows the published license.',
  body: 'Each package’s LICENSE specifies its Change Date. FSL conversion occurs on that date or the fourth anniversary of the first public distribution under FSL, whichever comes first. Read the license shipped with your version.',
  steps: [
    {
      title: 'Release publishes under FSL-1.1-MIT',
      body: 'Inspect the package source and the LICENSE shipped with your version, including its Change Date.',
      color: 'emerald' as const,
    },
    {
      title: 'Before conversion',
      body: 'Use follows the package’s published permitted-purpose and restriction terms.',
      color: 'amber' as const,
    },
    {
      title: 'At the conversion date: MIT',
      body: 'The licensed work becomes available under the specified MIT Change License according to the published conversion terms.',
      color: 'emerald' as const,
    },
  ],
} as const;

export const FAIR_SOURCE_PEERS_SECTION = {
  eyebrow: 'In good company',
  heading: 'The same license model used by serious infrastructure projects.',
} as const;

export const FAIR_SOURCE_PEERS: readonly LicensePeer[] = [
  {
    name: 'Sentry',
    note: 'Application monitoring; flagship FSL adopter (license they originally co-authored with FOSSA).',
    url: 'https://blog.sentry.io/introducing-the-functional-source-license-freedom-without-free-riding/',
  },
  {
    name: 'GitButler',
    note: 'Git client for branch management. FSL across the stack.',
    url: 'https://gitbutler.com/blog/fair-source',
  },
  {
    name: 'Keygen',
    note: 'License management infrastructure; FSL on their core engine.',
    url: 'https://keygen.sh/blog/fair-source/',
  },
];

export const FAIR_SOURCE_FAQ_SECTION = {
  eyebrow: 'Common questions',
  heading: 'Detailed answers, not lawyer-speak.',
} as const;

export const FAIR_SOURCE_FAQS: readonly FaqItem[] = [
  {
    question: 'Is Fair Source open source?',
    answer:
      'FSL-licensed packages are source available. Their published license permits defined uses and restricts competing uses. MIT conversion follows its Change Date and anniversary terms.',
  },
  {
    question: 'What counts as a "competing developer platform"?',
    answer: `The license uses the standard FSL definition: a software product with substantially the same functionality as RevealUI that is offered to the same audience as a developer platform. Building a SaaS app for end users that happens to use @revealui/ai under the hood is fine. Building a marketplace for AI-agent tooling on top of @revealui/harnesses and selling it to developers is the case the clause addresses. If you are unsure, email ${SITE.emails.founder}. We would rather you ship than worry.`,
  },
  {
    question: 'When exactly does each release convert to MIT?',
    answer:
      'Check the LICENSE shipped with the version you use. Its Change Date and fourth-anniversary provision determine MIT conversion; a version tag alone does not establish a new two-year clock.',
  },
  {
    question: 'Why not just use plain MIT for everything?',
    answer:
      'The Pro packages represent meaningful R&D investment in agent runtimes and harness coordination. Plain MIT lets a competitor fork the entire stack on day one and undercut the project on price, leaving the studio with no path to sustain the work. Fair Source closes that specific risk while keeping every other freedom you need. It is a deliberate middle path between "everything free, no business model" and "closed proprietary."',
  },
  {
    question: 'How is the Pro tier enforced if the source is visible?',
    answer:
      'License enforcement is at runtime on the studio control plane (admin.revealui.com and api.revealui.com), not baked into the npm packages. That is a license check on RevealUI Studio infrastructure, not a customer VM we operate. You self-host the runtime. The hosted RevealUI API checks Ed25519-signed license JWTs and gates Pro API routes; self-hosted paid features also use entitlement checks. FSL is the legal protection: the source is visible and you can run it, but shipping a competing developer platform on top of it is exactly what the non-compete clause prohibits, with civil remedies available. MIT conversion follows the published license terms.',
  },
  {
    question: 'What about the rest of the RevealUI packages?',
    answer:
      'The core and the published MIT packages are open source under MIT. Check package-specific licenses for other workspace members. That is the OSS substrate (auth, content, billing primitives, admin UI, presentation system, router, etc.). Fair Source applies to five packages: @revealui/ai, @revealui/engines, @revealui/harnesses, @revealui/mcp, and @revealui/services.',
  },
];

export const FAIR_SOURCE_CTA = {
  heading: 'Read the spec yourself.',
  body: 'FSL-1.1-MIT is short, plain English, and authored by the FOSSA legal team. Two pages. Read it before you ship.',
  primaryLabel: 'FSL-1.1-MIT spec text',
  primaryHref: SITE.urls.fslSpecText,
  secondaryLabel: 'Email a license question',
  secondaryHref: `mailto:${SITE.emails.founder}?subject=Fair%20Source%20question`,
} as const;
