// Claims-evidence index: every prose sentence in the covered marketing
// content files maps to the artifacts that prove it (owner directive
// 2026-07-12; spec: .jv docs/lanes/frontend-excellence/messaging-rewrite-2026-07-12.md).
//
// claim-drift.ts pins the NUMBERS marketing quotes; this index pins the
// SENTENCES. scripts/validate/claims-evidence.ts hard-fails the gate when a
// covered file gains prose with no entry here, when an entry's text no longer
// matches the copy, or when a cited code path stops existing.
//
// Granularity: one entry per copy FIELD (a field may hold more than one
// sentence); the evidence array carries one ref per distinct claim in the
// field, with the claim named in `note`. Line numbers never appear in `ref`
// (they drift); put them in `note` when helpful.
//
// Generalizes the existing pattern in capabilities.ts, where every capability
// card already cites its source file (checked by content.test.ts).

export type EvidenceKind = 'code' | 'command' | 'url' | 'metric';

export interface EvidenceRef {
  /** What kind of artifact proves the claim. */
  readonly kind: EvidenceKind;
  /** Repo-relative path (code/metric), runnable command, or public URL. */
  readonly ref: string;
  /** Which claim in the field this ref proves, and any caveat. */
  readonly note?: string;
}

export interface ClaimEntry {
  /** Content module, relative to app/content/. */
  readonly file: string;
  /** Dot path of the export the copy lives under (documentation aid). */
  readonly exportPath: string;
  /**
   * The exact runtime copy string. With `match: 'path'` (interpolated
   * template literals) the validator resolves `exportPath` instead and
   * `text` is documentation only.
   */
  readonly text: string;
  readonly match?: 'text' | 'path';
  readonly evidence: readonly EvidenceRef[];
}

/** Files whose prose the validator requires to be fully indexed. */
export interface CoveredFile {
  readonly file: string;
  /** When set, only exports whose name starts with this prefix are covered. */
  readonly exportPrefix?: string;
}

export const COVERED_FILES: readonly CoveredFile[] = [
  { file: 'home.ts' },
  { file: 'primitives.ts', exportPrefix: 'HOME_' },
  { file: 'proof.ts' },
  { file: 'pricing-teaser.ts' },
  { file: 'site.ts' },
] as const;

const AUTH_SESSIONS: EvidenceRef = {
  kind: 'code',
  ref: 'packages/auth/src/server/auth.ts',
  note: 'session creation + sign-in/sign-up flows',
};
const RBAC_ABAC: EvidenceRef = {
  kind: 'code',
  ref: 'packages/security/src/authorization.ts',
  note: 'RBAC + ABAC policy engine; enforcement tests at packages/core/src/__tests__/auth/',
};
const COLLECTIONS: EvidenceRef = {
  kind: 'code',
  ref: 'apps/admin/src/lib/collections',
  note: 'collection definitions drive the admin UI + REST API; engine at packages/core/src/collections',
};
const BILLING: EvidenceRef = {
  kind: 'code',
  ref: 'apps/server/src/routes/billing.ts',
  note: 'Stripe checkout, subscription, portal routes',
};
const WEBHOOKS: EvidenceRef = {
  kind: 'code',
  ref: 'apps/server/src/routes/webhooks.ts',
  note: 'signature-verified Stripe webhook processing',
};
const RECONCILE: EvidenceRef = {
  kind: 'code',
  ref: 'apps/server/src/routes/cron/reconcile-subscriptions.ts',
  note: 'reconciliation crons; siblings reconcile-stripe-subscriptions.ts + drain-unreconciled.ts',
};
const MCP_CONTENT: EvidenceRef = {
  kind: 'code',
  ref: 'packages/mcp/src/servers/factories/revealui-content.ts',
  note: 'generic content tools + opt-in mcpResource collection introspection',
};
const TIER_GATES: EvidenceRef = {
  kind: 'code',
  ref: 'apps/server/src/middleware/entitlements.ts',
  note: 'per-account tier resolution; AI routes gated in entitlements mode in apps/server/src/index.ts',
};
const OPEN_WEIGHT: EvidenceRef = {
  kind: 'code',
  ref: 'apps/server/src/middleware/license.ts',
  note: 'requireAIAccess free-tier local-inference path (OLLAMA_BASE_URL / INFERENCE_SNAPS_BASE_URL)',
};
const PROVIDERS: EvidenceRef = {
  kind: 'code',
  ref: 'packages/ai/src/llm/providers',
  note: 'provider adapters; open-weight default via ollama.ts + inference/',
};
const CLI_CREATE: EvidenceRef = {
  kind: 'command',
  ref: 'npx create-revealui@latest my-app',
  note: 'scaffolder at packages/cli; the 60-second figure is a timed claim, re-verify per release',
};
const LICENSE_MIT: EvidenceRef = {
  kind: 'code',
  ref: 'LICENSE',
  note: 'root MIT license; per-package FSL-1.1-MIT files in the 5 Pro packages',
};
const LICENSE_SPLIT: EvidenceRef = {
  kind: 'metric',
  ref: 'scripts/validate/claim-drift.ts',
  note: 'licenseSplit 22 MIT + 5 FSL + 1 internal, pinned by the claim-drift gate',
};
const SELF_HOST: EvidenceRef = {
  kind: 'code',
  ref: 'docs/guides/deployment.md',
  note: 'self-host deployment guide; plain Node bundle, no vendor edge runtime',
};
const REPO: EvidenceRef = {
  kind: 'url',
  ref: 'https://github.com/RevealUIStudio/revealui',
  note: 'the entire runtime is in the public repo',
};
const CI_GATE: EvidenceRef = {
  kind: 'code',
  ref: 'scripts/gates/ci-gate.ts',
  note: '3-phase gate: Biome, typecheck, Vitest, build; CodeQL + Gitleaks in .github/workflows',
};
const TRIAL: EvidenceRef = {
  kind: 'code',
  ref: 'apps/server/src/routes/billing.ts',
  note: 'default trial period for new subscriptions (DEFAULT_TRIAL_DAYS)',
};
const TIER_LIMITS: EvidenceRef = {
  kind: 'code',
  ref: 'apps/server/src/lib/tier-limits.ts',
  note: 'pro maxAgentTasks 10_000; free 1_000',
};
const X402: EvidenceRef = {
  kind: 'code',
  ref: 'apps/server/src/middleware/x402.ts',
  note: 'HTTP 402 payment middleware; rails in development per the roadmap',
};
const MEMORY: EvidenceRef = {
  kind: 'code',
  ref: 'packages/ai/src/memory',
  note: 'CRDT agent memory',
};
const AGENT_ROUTES: EvidenceRef = {
  kind: 'code',
  ref: 'apps/server/src/routes/agent-tasks.ts',
  note: 'agent surfaces mounted behind the same auth + entitlement middleware as user routes',
};
const OPEN_STANDARDS: EvidenceRef = {
  kind: 'code',
  ref: 'packages/openapi/src',
  note: 'OpenAPI spec generation; MCP + Stripe webhooks + OAuth are the other open surfaces',
};
const POSTGRES: EvidenceRef = {
  kind: 'code',
  ref: 'packages/db/src/schema',
  note: 'plain Postgres via Drizzle; no proprietary database',
};
const THIS_SITE: EvidenceRef = {
  kind: 'url',
  ref: 'https://revealui.com',
  note: 'this site (apps/marketing) and revealuistudio.com run on RevealUI in production',
};
const PRICING_FALLBACKS: EvidenceRef = {
  kind: 'metric',
  ref: 'apps/marketing/app/lib/pricing-fallbacks.ts',
  note: 'display prices pinned in lockstep with scripts/setup/stripe-catalog.ts by validate:pricing-lockstep',
};
const NO_TELEMETRY: EvidenceRef = {
  kind: 'url',
  ref: 'https://github.com/RevealUIStudio/revealui/search?q=telemetry',
  note: 'negative claim: no telemetry client ships in the runtime; verify by repo search',
};
const DEPLOY_TARGETS: EvidenceRef = {
  kind: 'code',
  ref: 'docs/guides/deployment.md',
  note: 'Vercel, Cloudflare, Fly, Hetzner, self-host deploy paths',
};
const DOCS: EvidenceRef = { kind: 'url', ref: 'https://docs.revealui.com' };

export const CLAIMS: readonly ClaimEntry[] = [
  // ── site.ts ───────────────────────────────────────────────────────────────
  {
    file: 'site.ts',
    exportPath: 'SITE.brandTagline',
    text: 'The open runtime for businesses that run their own AI.',
    evidence: [LICENSE_MIT, OPEN_WEIGHT, SELF_HOST],
  },

  // ── home.ts — hero ───────────────────────────────────────────────────────
  {
    file: 'home.ts',
    exportPath: 'HOME_HERO.eyebrow',
    text: 'Open source. Self-hostable.',
    evidence: [LICENSE_MIT, SELF_HOST],
  },
  {
    file: 'home.ts',
    exportPath: 'HOME_HERO.h1',
    text: 'Run your whole business on one runtime you own.',
    evidence: [
      {
        kind: 'code',
        ref: 'packages',
        note: 'auth, content, billing, agents in one monorepo runtime',
      },
      LICENSE_MIT,
      SELF_HOST,
    ],
  },
  {
    file: 'home.ts',
    exportPath: 'HOME_HERO.subtitle.sentence1',
    text: 'RevealUI is the self-hosted runtime where your business and the AI agents that run it live under one roof.',
    evidence: [SELF_HOST, AGENT_ROUTES, TIER_GATES],
  },
  {
    file: 'home.ts',
    exportPath: 'HOME_HERO.subtitle.support',
    text: 'It runs on any AI provider you choose.',
    evidence: [PROVIDERS, OPEN_WEIGHT],
  },
  {
    file: 'home.ts',
    exportPath: 'HOME_HERO_FOUNDATION.h1',
    text: 'The foundation your business runs on.',
    evidence: [
      {
        kind: 'code',
        ref: 'packages',
        note: 'sanctioned A/B variant of HOME_HERO.h1; same grounding',
      },
    ],
  },

  // ── home.ts — problem ────────────────────────────────────────────────────
  {
    file: 'home.ts',
    exportPath: 'HOME_PROBLEM.heading',
    text: 'Vendor sprawl, or framework-only. Pick neither.',
    evidence: [
      {
        kind: 'code',
        ref: 'packages',
        note: 'framing sentence; the table below carries the claims',
      },
    ],
  },
  {
    file: 'home.ts',
    exportPath: 'HOME_PROBLEM.body',
    text: 'You either glue together an auth vendor, a headless CMS, Stripe code, and a job runner, or you pick an agent framework and rebuild all four underneath it. RevealUI is the third option: the whole set arrives wired into one runtime that you own.',
    evidence: [AUTH_SESSIONS, COLLECTIONS, BILLING, LICENSE_MIT],
  },
  {
    file: 'home.ts',
    exportPath: 'HOME_PROBLEM.rows[0].sprawl',
    text: 'A separate auth vendor, per seat',
    evidence: [
      {
        kind: 'url',
        ref: 'https://revealui.com/pricing',
        note: 'competitor-column framing; cost detail lives on the pricing page',
      },
    ],
  },
  {
    file: 'home.ts',
    exportPath: 'HOME_PROBLEM.rows[0].revealui',
    text: 'Sessions with RBAC and ABAC, built in',
    evidence: [AUTH_SESSIONS, RBAC_ABAC],
  },
  {
    file: 'home.ts',
    exportPath: 'HOME_PROBLEM.rows[1].sprawl',
    text: 'A headless CMS, plus a team to wire it',
    evidence: [
      {
        kind: 'url',
        ref: 'https://revealui.com/pricing',
        note: 'competitor-column framing; cost detail lives on the pricing page',
      },
    ],
  },
  {
    file: 'home.ts',
    exportPath: 'HOME_PROBLEM.rows[1].revealui',
    text: 'Collections with an admin UI and REST API',
    evidence: [COLLECTIONS, OPEN_STANDARDS],
  },
  {
    file: 'home.ts',
    exportPath: 'HOME_PROBLEM.rows[2].revealui',
    text: 'Checkout, webhooks, and reconciliation crons',
    evidence: [BILLING, WEBHOOKS, RECONCILE],
  },
  {
    file: 'home.ts',
    exportPath: 'HOME_PROBLEM.rows[3].revealui',
    text: 'Content tools over MCP, plus collections you opt in',
    evidence: [MCP_CONTENT],
  },
  {
    file: 'home.ts',
    exportPath: 'HOME_PROBLEM.footnote',
    text: 'Capability comparison only; a monthly cost estimate lives on the pricing page. (interpolated: Pro price from pricing-fallbacks)',
    match: 'path',
    evidence: [PRICING_FALLBACKS, DEPLOY_TARGETS],
  },

  // ── home.ts — demo ───────────────────────────────────────────────────────
  {
    file: 'home.ts',
    exportPath: 'HOME_DEMO.heading',
    text: 'From one command to a working stack in 60 seconds.',
    evidence: [CLI_CREATE],
  },
  {
    file: 'home.ts',
    exportPath: 'HOME_DEMO.body',
    text: 'The stack runs locally in 60 seconds, Stripe starts in test mode, and agents connect over MCP.',
    evidence: [CLI_CREATE, BILLING, MCP_CONTENT],
  },
  {
    file: 'home.ts',
    exportPath: 'HOME_DEMO.mockupCaption.prefix',
    text: 'Local screenshot from a fresh',
    evidence: [CLI_CREATE],
  },
  {
    file: 'home.ts',
    exportPath: 'HOME_DEMO.mockupCaption.suffix',
    text: '. The three beats below describe the steps.',
    evidence: [CLI_CREATE],
  },
  {
    file: 'home.ts',
    exportPath: 'HOME_DEMO.beats[0].body',
    text: 'One command. Auth, content, admin UI, the Stripe webhook handler, and MCP server scaffolding all running locally in 60 seconds.',
    evidence: [CLI_CREATE, AUTH_SESSIONS, WEBHOOKS, MCP_CONTENT],
  },
  {
    file: 'home.ts',
    exportPath: 'HOME_DEMO.beats[1].title',
    text: 'Customer flow, end to end.',
    evidence: [BILLING],
  },
  {
    file: 'home.ts',
    exportPath: 'HOME_DEMO.beats[1].body',
    text: 'A user signs up, picks a plan, and Stripe test-mode checkout completes. The admin UI shows the new account. Switch to live mode when you are ready to take real money.',
    evidence: [
      AUTH_SESSIONS,
      BILLING,
      {
        kind: 'code',
        ref: 'apps/server/src/lib/validate-startup.ts',
        note: 'STRIPE_LIVE_MODE flip validated at boot',
      },
    ],
  },
  {
    file: 'home.ts',
    exportPath: 'HOME_DEMO.beats[2].body',
    text: 'Wire an LLM provider and your agents read your sites, users, and content over MCP, with every call passing the same auth and tier gates your human users pass.',
    evidence: [PROVIDERS, MCP_CONTENT, TIER_GATES],
  },

  // ── home.ts — FAQ ────────────────────────────────────────────────────────
  {
    file: 'home.ts',
    exportPath: 'HOME_FAQ.items[0].answer',
    text: 'No. Open standards end-to-end: OAuth, JWT, Stripe webhooks, MCP, and OpenAPI, over plain Postgres. Deploy anywhere Node runs, and take your data, your code, and your infrastructure with you. RevealUI is the runtime, not the prison.',
    evidence: [OPEN_STANDARDS, POSTGRES, SELF_HOST],
  },
  {
    file: 'home.ts',
    exportPath: 'HOME_FAQ.items[1].answer',
    text: 'Every PR clears a 3-phase gate before it lands: Biome, Vitest unit and integration tests, Playwright end-to-end tests, CodeQL, and Gitleaks. This site and the agency site at revealuistudio.com both run on RevealUI in production.',
    evidence: [CI_GATE, THIS_SITE],
  },
  {
    file: 'home.ts',
    exportPath: 'HOME_FAQ.items[2].question',
    text: 'How is this different from stitching together separate auth, database, CMS, and background-job services?',
    evidence: [
      { kind: 'code', ref: 'packages', note: 'question copy; the answer carries the claims' },
    ],
  },
  {
    file: 'home.ts',
    exportPath: 'HOME_FAQ.items[2].answer',
    text: 'Each of those covers one slice: a real-time database, a Postgres-plus-auth backend, a session service, a jobs runner. RevealUI is the whole runtime: auth, content, billing, admin UI, and an agent layer, self-hosted at every tier. (Vercel, Cloudflare, and Fly are deploy targets, not competitors. RevealUI runs on all three.)',
    evidence: [AUTH_SESSIONS, COLLECTIONS, BILLING, AGENT_ROUTES, DEPLOY_TARGETS],
  },
  {
    file: 'home.ts',
    exportPath: 'HOME_FAQ.items[3].answer',
    text: 'Yes. 22 of 28 packages are MIT and stay MIT, forever. The 5 Pro packages are Fair Source (FSL-1.1-MIT) and auto-convert to MIT two years after each release. Self-host the entire stack on your own infrastructure at any tier, with no vendor-specific edge runtimes and no proprietary database.',
    evidence: [LICENSE_SPLIT, LICENSE_MIT, SELF_HOST, POSTGRES],
  },
  {
    file: 'home.ts',
    exportPath: 'HOME_FAQ.items[4].question',
    text: 'What does "agent-native" actually mean in code?',
    evidence: [
      {
        kind: 'code',
        ref: 'packages/mcp/src',
        note: 'question copy; the answer carries the claims',
      },
    ],
  },
  {
    file: 'home.ts',
    exportPath: 'HOME_FAQ.items[4].answer',
    text: 'Agents authenticate like users and pass the same tier gates your customers pass. The content MCP server ships discovery and read tools, any collection becomes a discoverable MCP resource with one flag, and writes go through the same REST API your app uses.',
    evidence: [TIER_GATES, MCP_CONTENT, OPEN_STANDARDS],
  },
  {
    file: 'home.ts',
    exportPath: 'HOME_FAQ.items[5].question',
    text: 'How does AI inference work?',
    evidence: [OPEN_WEIGHT],
  },
  {
    file: 'home.ts',
    exportPath: 'HOME_FAQ.items[5].answer',
    text: 'Agents run on an open-weight model on your own infrastructure by default, with Claude, GPT, or any other provider one config line away. See the local AI docs at revealui.com/local-ai for the full pathway.',
    evidence: [OPEN_WEIGHT, PROVIDERS],
  },
  {
    file: 'home.ts',
    exportPath: 'HOME_FAQ.items[6].question',
    text: 'How do agent payments work?',
    evidence: [X402],
  },
  {
    file: 'home.ts',
    exportPath: 'HOME_FAQ.items[6].answer',
    text: 'RevealUI implements the HTTP 402 payment protocol so agents can pay each other over standard HTTP, with the payment rails still in development. See the agents section of the pricing page for the current status.',
    evidence: [X402],
  },

  // ── home.ts — get started ────────────────────────────────────────────────
  {
    file: 'home.ts',
    exportPath: 'HOME_GET_STARTED.heading',
    text: 'Your stack is one command away.',
    evidence: [CLI_CREATE],
  },
  {
    file: 'home.ts',
    exportPath: 'HOME_GET_STARTED.body',
    text: 'Spin it up on your machine in minutes. Flip to live mode when you are ready to charge real customers.',
    evidence: [
      CLI_CREATE,
      {
        kind: 'code',
        ref: 'apps/server/src/lib/validate-startup.ts',
        note: 'live-mode flip validated at boot',
      },
    ],
  },
  {
    file: 'home.ts',
    exportPath: 'HOME_GET_STARTED.cli.caption',
    text: 'Local dev stack in 60 seconds. No credit card.',
    evidence: [
      CLI_CREATE,
      {
        kind: 'code',
        ref: 'apps/admin/src/app/api/auth/sign-up/route.ts',
        note: 'signup takes no payment method',
      },
    ],
  },
  {
    file: 'home.ts',
    exportPath: 'HOME_GET_STARTED.newsletter.label',
    text: 'Not ready to start? Get product updates and engineering insights.',
    evidence: [
      {
        kind: 'code',
        ref: 'apps/server/src/routes/waitlist.ts',
        note: 'newsletter capture endpoint',
      },
    ],
  },

  // ── primitives.ts (HOME_ exports) ────────────────────────────────────────
  {
    file: 'primitives.ts',
    exportPath: 'HOME_PRIMITIVES_SECTION.eyebrow',
    text: 'Five primitives. One login.',
    evidence: [
      AUTH_SESSIONS,
      {
        kind: 'code',
        ref: 'packages/engines/src',
        note: 'the five business primitives behind one session',
      },
    ],
  },
  {
    file: 'primitives.ts',
    exportPath: 'HOME_PRIMITIVES_SECTION.heading',
    text: 'The five things every business runs on.',
    evidence: [
      {
        kind: 'code',
        ref: 'packages/engines/src',
        note: 'people, content, offers, payments, agents',
      },
    ],
  },
  {
    file: 'primitives.ts',
    exportPath: 'HOME_PRIMITIVES_SECTION.body',
    text: 'Each primitive ships as an API and an admin surface, and your agents work the same objects your team does.',
    evidence: [OPEN_STANDARDS, COLLECTIONS, AGENT_ROUTES],
  },
  {
    file: 'primitives.ts',
    exportPath: 'HOME_PRIMITIVES_SECTION.docsLink.label',
    text: 'See the primitive reference →',
    evidence: [DOCS],
  },
  {
    file: 'primitives.ts',
    exportPath: 'HOME_PRIMITIVES[0].body',
    text: 'Your team signs in with sessions and works under RBAC and ABAC policies.',
    evidence: [AUTH_SESSIONS, RBAC_ABAC],
  },
  {
    file: 'primitives.ts',
    exportPath: 'HOME_PRIMITIVES[1].body',
    text: 'Collections give you a CMS, rich text, and media, with an admin UI generated from your schema.',
    evidence: [
      COLLECTIONS,
      { kind: 'code', ref: 'packages/core/src/richtext', note: 'Lexical rich text' },
    ],
  },
  {
    file: 'primitives.ts',
    exportPath: 'HOME_PRIMITIVES[2].body',
    text: 'Catalogs and feature gates decide what each tier can do, for your people and your agents.',
    evidence: [
      TIER_GATES,
      TIER_LIMITS,
      { kind: 'code', ref: 'packages/core/src/features.ts', note: 'tier feature matrix' },
    ],
  },
  {
    file: 'primitives.ts',
    exportPath: 'HOME_PRIMITIVES[3].body',
    text: 'Stripe checkout, subscriptions, and webhook reconciliation come pre-wired.',
    evidence: [BILLING, WEBHOOKS, RECONCILE],
  },
  {
    file: 'primitives.ts',
    exportPath: 'HOME_PRIMITIVES[4].body',
    text: 'Agents run on an open-weight model you host, with any provider one config line away.',
    evidence: [OPEN_WEIGHT, PROVIDERS],
  },

  // ── proof.ts ─────────────────────────────────────────────────────────────
  {
    file: 'proof.ts',
    exportPath: 'PROOF_SECTION.heading',
    text: 'Inspect the code before you commit to it.',
    evidence: [REPO],
  },
  {
    file: 'proof.ts',
    exportPath: 'PROOF_SECTION.body',
    text: 'The entire runtime sits in the public repo under an open license. Read it, run it, or fork it before you build on it.',
    evidence: [REPO, LICENSE_MIT],
  },
  {
    file: 'proof.ts',
    exportPath: 'PROOF_TRUST.body',
    text: 'Your security team can read every line. The whole runtime is open source, MIT or Fair Source, sitting in the repo. There is no closed binary to explain away when procurement comes asking.',
    evidence: [REPO, LICENSE_SPLIT],
  },
  {
    file: 'proof.ts',
    exportPath: 'PROOF_TRUST.changelogCta.label',
    text: 'See what shipped this month →',
    evidence: [
      { kind: 'url', ref: 'https://github.com/RevealUIStudio/revealui/blob/main/CHANGELOG.md' },
    ],
  },
  {
    file: 'proof.ts',
    exportPath: 'LIVE_METRICS.heading',
    text: 'Every number here is pinned to the codebase.',
    evidence: [LICENSE_SPLIT],
  },
  {
    file: 'proof.ts',
    exportPath: 'LIVE_METRICS.body',
    text: 'These counts are validated on every PR by the claim-drift gate. If the code changes and a number drifts, the build fails before it can ship.',
    evidence: [LICENSE_SPLIT, CI_GATE],
  },

  // ── pricing-teaser.ts ────────────────────────────────────────────────────
  {
    file: 'pricing-teaser.ts',
    exportPath: 'PRICING_TEASER_SECTION.heading',
    text: 'Start free. Pay when you scale.',
    evidence: [LICENSE_MIT, TIER_LIMITS],
  },
  {
    file: 'pricing-teaser.ts',
    exportPath: 'PRICING_TEASER_SECTION.body',
    text: 'Self-host the open-source stack at no cost. Pro, Max, and Enterprise add runtime entitlements and an agent task allowance. Pro and Max include a 7-day free trial.',
    evidence: [LICENSE_MIT, TIER_GATES, TIER_LIMITS, TRIAL],
  },
  {
    file: 'pricing-teaser.ts',
    exportPath: 'PRICING_TEASER_TIERS[0].description',
    text: '22 of 28 packages are MIT, forever. The 5 Pro packages are Fair Source (FSL) and convert to MIT after two years. There is no telemetry.',
    evidence: [LICENSE_SPLIT, NO_TELEMETRY],
  },
  {
    file: 'pricing-teaser.ts',
    exportPath: 'PRICING_TEASER_TIERS[0].features[3]',
    text: 'Bring your own model (open-weight default)',
    evidence: [OPEN_WEIGHT, PROVIDERS],
  },
  {
    file: 'pricing-teaser.ts',
    exportPath: 'PRICING_TEASER_TIERS[1].description',
    text: 'Pro adds the AI primitives, an agent task allowance, and priority support.',
    evidence: [TIER_GATES, TIER_LIMITS],
  },
  {
    file: 'pricing-teaser.ts',
    exportPath: 'PRICING_TEASER_TIERS[1].features[1]',
    text: '10,000 agent tasks / month included',
    evidence: [TIER_LIMITS],
  },
  {
    file: 'pricing-teaser.ts',
    exportPath: 'PRICING_TEASER_TIERS[1].features[2]',
    text: 'Pro AI features (agents, MCP, memory), beta in production',
    evidence: [
      TIER_GATES,
      MEMORY,
      { kind: 'code', ref: 'packages/mcp/src', note: 'MCP hypervisor + servers' },
    ],
  },
  {
    file: 'pricing-teaser.ts',
    exportPath: 'PRICING_TEASER_LINKS[0].description',
    text: 'Max adds AI memory, advanced inference, and compliance tooling.',
    evidence: [
      MEMORY,
      { kind: 'code', ref: 'packages/ai/src/inference', note: 'inference layer' },
      RBAC_ABAC,
    ],
  },
  {
    file: 'pricing-teaser.ts',
    exportPath: 'PRICING_TEASER_LINKS[1].description',
    text: 'Enterprise adds scale and compliance controls.',
    evidence: [TIER_LIMITS, RBAC_ABAC],
  },
  {
    file: 'pricing-teaser.ts',
    exportPath: 'PRICING_TEASER_FOOTER.caption.prefix',
    text: 'Deploys to Vercel, Cloudflare, Fly, Hetzner, or self-host.',
    evidence: [DEPLOY_TARGETS],
  },
  {
    file: 'pricing-teaser.ts',
    exportPath: 'PRICING_TEASER_FOOTER.caption.suffix',
    text: 'produces a standard Node bundle.',
    evidence: [{ kind: 'command', ref: 'pnpm build', note: 'turbo build to a plain Node bundle' }],
  },
] as const;

/**
 * Field names whose string values are never prose claims (icons, colors,
 * routes, ids). The validator skips them when computing coverage.
 */
export const NON_COPY_KEYS: readonly string[] = [
  'iconPath',
  'icon',
  'color',
  'bgColor',
  'ringColor',
  'href',
  'moreHref',
  'linkHref',
  'validatorHref',
  'code',
  'command',
  'id',
  'n',
  'key',
  'tableAriaLabel',
  'create',
] as const;
