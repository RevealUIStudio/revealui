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
  { file: 'primitives.ts' },
  { file: 'products.ts' },
  { file: 'capabilities.ts' },
  { file: 'proof.ts' },
  { file: 'pricing-teaser.ts' },
  { file: 'site.ts' },
  { file: 'pricing.ts' },
  { file: 'pricing-faq.ts' },
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
  note: 'self-host deployment guide; named hosts in copy are examples of standard Node targets, the guide covers the primary paths',
};
const DOCS: EvidenceRef = { kind: 'url', ref: 'https://docs.revealui.com' };
const LIVE_AGENT_CARD: EvidenceRef = {
  kind: 'url',
  ref: 'https://api.revealui.com/.well-known/agent.json',
  note: 'returns 200 on live prod, verified 2026-07-12; route at apps/server/src/routes/a2a.ts',
};
const FEATURES_MATRIX: EvidenceRef = {
  kind: 'code',
  ref: 'packages/core/src/features.ts',
  note: 'per-tier feature flags (getFeaturesForTier)',
};
const X402_FACILITATOR: EvidenceRef = {
  kind: 'code',
  ref: 'packages/paywall/src/x402',
  note: 'Coinbase-compatible USDC-on-Base facilitator; gated behind X402_ENABLED, default off',
};
const COMMERCIAL_POLICY: EvidenceRef = {
  kind: 'url',
  ref: 'https://revealui.com/pricing',
  note: 'owner-committed commercial policy (service rungs, credits, custom pricing/SLA); no code artifact by nature. Policy-page follow-up tracked in the coordination hub',
};
const FAIR_SOURCE_PAGE: EvidenceRef = {
  kind: 'code',
  ref: 'apps/marketing/app/routes/FairSourcePage.tsx',
};
const INFRA_COST_ESTIMATE: EvidenceRef = {
  kind: 'url',
  ref: 'https://revealui.com/pricing',
  note: 'infra cost estimate of the rented stack, not a RevealUI price',
};
const WAITLIST: EvidenceRef = {
  kind: 'code',
  ref: 'apps/server/src/routes/waitlist.ts',
  note: 'newsletter/release-updates capture endpoint',
};

// ── claims-ratchet 2026-07-12 evidence (products/capabilities/primitives) ────
const HARNESS_WORKBOARD: EvidenceRef = {
  kind: 'code',
  ref: 'packages/harnesses/src/workboard/workboard-manager.ts',
  note: 'shared workboard manager for cross-session agent coordination',
};
const HARNESS_ADAPTER: EvidenceRef = {
  kind: 'code',
  ref: 'packages/harnesses/src/adapters/revealui-agent-adapter.ts',
  note: 'the one working agent adapter; roadmap profiles at packages/harnesses/src/protocol/roadmap-profiles.ts state no working adapter ships for claude-code/cursor yet',
};
const HYPERVISOR: EvidenceRef = {
  kind: 'code',
  ref: 'packages/mcp/src/hypervisor.ts',
  note: 'supervises the MCP servers and surfaces their tool registries',
};
const RESILIENCE: EvidenceRef = {
  kind: 'code',
  ref: 'packages/resilience/src/circuit-breaker.ts',
  note: 'circuit breaker + retry + bulkhead; consumed by the packages/ai llm client, the db saga, and core error-handling',
};
const ENCRYPTION: EvidenceRef = {
  kind: 'code',
  ref: 'packages/security/src/encryption.ts',
  note: 'per-record DEK wrapped by a KEK, with a rotation manager that re-encrypts records under a new key',
};
const CRDT_REPLAY: EvidenceRef = {
  kind: 'code',
  ref: 'packages/ai/src/memory/persistence/crdt-persistence.ts',
  note: 'replayOperations rebuilds state from the op log (used by sync-manager); schema at packages/db/src/schema/crdt-operations.ts',
};
const PROVENANCE: EvidenceRef = {
  kind: 'code',
  ref: 'apps/server/src/collab/provenance-logger.ts',
  note: 'writes collab_edits clientType/agentModel per edit; commit-level schema packages/db/src/schema/code-provenance.ts has a manual API only, automatic commit ingest is roadmap',
};
const WEBHOOK_EVENTS: EvidenceRef = {
  kind: 'code',
  ref: 'packages/db/src/schema/webhook-events.ts',
  note: 'every Stripe event recorded for idempotency',
};
const DRAIN: EvidenceRef = {
  kind: 'code',
  ref: 'apps/server/src/routes/cron/drain-unreconciled.ts',
  note: 'cron replays failed webhook handlers from Stripe',
};
const SECURITY_AUTHZ: EvidenceRef = {
  kind: 'code',
  ref: 'packages/security/src/authorization.ts',
  note: 'role inheritance + attribute condition operators; roughly 95 tests at packages/security/src/__tests__/authorization.test.ts',
};
const ENFORCEMENT_TESTS: EvidenceRef = {
  kind: 'code',
  ref: 'packages/core/src/collections/operations/__tests__/access-enforcement.test.ts',
  note: '42 enforcement cases here + 18 in packages/core/src/__tests__/auth/access.test.ts = the 60',
};
const TASK_QUOTA: EvidenceRef = {
  kind: 'code',
  ref: 'apps/server/src/middleware/task-quota.ts',
  note: '429 over per-tier maxAgentTasks; mounted on agent-tasks + agent-stream in apps/server/src/index.ts',
};
const MEDIA_R2: EvidenceRef = {
  kind: 'code',
  ref: 'apps/server/src/lib/storage.ts',
  note: 'Cloudflare R2 is the sole media backend; R2_PUBLIC_BASE_URL is the CDN delivery URL',
};
const DRAFTS: EvidenceRef = {
  kind: 'code',
  ref: 'packages/core/src/collections/operations/drafts.ts',
  note: 'draft/live publishing workflow',
};
const TENANT: EvidenceRef = {
  kind: 'code',
  ref: 'apps/server/src/middleware/tenant.ts',
  note: 'membership-validated multi-tenant isolation, mounted on /api/*',
};
const RICHTEXT: EvidenceRef = {
  kind: 'code',
  ref: 'packages/core/src/client/richtext',
  note: 'Lexical rich text editor with custom block nodes',
};
const ORCHESTRATOR: EvidenceRef = {
  kind: 'code',
  ref: 'packages/ai/src/orchestration/orchestrator.ts',
  note: 'multi-agent coordination + orchestration',
};
const A2A_ROUTES: EvidenceRef = {
  kind: 'code',
  ref: 'apps/server/src/routes/a2a.ts',
  note: 'JSON-RPC agent-to-agent protocol mounted at /a2a behind entitlement middleware',
};
const ELECTRIC_SYNC: EvidenceRef = {
  kind: 'code',
  ref: 'packages/sync/src',
  note: 'ElectricSQL shapes cover the agent/coordination/kg collections',
};
const GDPR: EvidenceRef = {
  kind: 'code',
  ref: 'packages/security/src/gdpr.ts',
  note: 'GDPR consent, deletion, and anonymization framework',
};
const PERPETUAL: EvidenceRef = {
  kind: 'code',
  ref: 'apps/server/src/routes/billing.ts',
  note: 'perpetualCheckoutRoute POST /checkout-perpetual; catalog products in scripts/setup/stripe-catalog.ts; licenses.perpetual column',
};
const MCP_SERVERS: EvidenceRef = {
  kind: 'code',
  ref: 'packages/mcp/src/servers',
  note: 'first-party MCP servers; the count is METRICS.mcpServers, pinned by scripts/validate/claim-drift.ts',
};
const REVVAULT_REPO: EvidenceRef = {
  kind: 'url',
  ref: 'https://github.com/RevealUIStudio/revvault',
  note: 'Rust CLI (crates/) + Tauri desktop app; age-encrypted passage-compatible store; workspace version 0.3.0',
};
const REVFORGE_REF: EvidenceRef = {
  kind: 'url',
  ref: 'https://revealui.com/products',
  note: 'operator-only tool in a private repo; stamping/domain-lock/multi-tenant capabilities verified internally 2026-07-12; the repo is not public, which is why the card carries no GitHub link',
};
const REVDEV_REPO: EvidenceRef = {
  kind: 'url',
  ref: 'https://github.com/RevealUIStudio/revdev',
  note: 'apps/studio + apps/console + packages/daemon at 0.1.1; the daemon registers and coordinates agents over JSON-RPC',
};
const REVCON_REPO: EvidenceRef = {
  kind: 'url',
  ref: 'https://github.com/RevealUIStudio/revcon',
  note: 'MIT editor config sync (Zed + Cursor), symlinked per project',
};
const REVSKILLS_REPO: EvidenceRef = {
  kind: 'url',
  ref: 'https://github.com/RevealUIStudio/revskills',
  note: 'MIT Claude Code skills library (Drizzle schemas, Vitest patterns, security hardening)',
};
const ROADMAP: EvidenceRef = {
  kind: 'url',
  ref: 'https://revealui.com/roadmap',
  note: 'RevMarket is Planned; third-party publishing is roadmap-only, not yet shipped',
};

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

  // ── capabilities.ts ──────────────────────────────────────────────────────
  {
    file: 'capabilities.ts',
    exportPath: 'CAPABILITIES_SECTION.eyebrow',
    text: 'Capabilities, file by file',
    evidence: [REPO],
  },
  {
    file: 'capabilities.ts',
    exportPath: 'CAPABILITIES_SECTION.body',
    text: 'Eight load-bearing primitives most platforms ship as separate products, or never ship at all. Each card links to the actual file.',
    evidence: [REPO],
  },
  {
    file: 'capabilities.ts',
    exportPath: 'CAPABILITIES_SECTION.footnote',
    text: 'Trust through specificity. These are primitives most platforms ship as separate products, or never ship at all. Each card links to the actual file.',
    evidence: [REPO],
  },
  {
    file: 'capabilities.ts',
    exportPath: 'CAPABILITIES[0].body',
    text: 'Role checks with inheritance and attribute policies with condition operators, proven by roughly 95 authorization tests in the security package alone.',
    evidence: [SECURITY_AUTHZ],
  },
  {
    file: 'capabilities.ts',
    exportPath: 'CAPABILITIES[1].title',
    text: 'Stripe webhook reconciliation',
    evidence: [WEBHOOK_EVENTS, RECONCILE],
  },
  {
    file: 'capabilities.ts',
    exportPath: 'CAPABILITIES[1].body',
    text: 'Every event is recorded for idempotency, failed handlers are replayed from Stripe by a drain cron, and reconcile crons surface drift between Stripe and the local DB.',
    evidence: [WEBHOOK_EVENTS, DRAIN, RECONCILE],
  },
  {
    file: 'capabilities.ts',
    exportPath: 'CAPABILITIES[2].body',
    text: 'Most platforms snapshot-merge. RevealUI replays operations, so collaborative editing across humans and agents stays correct after concurrent edits.',
    evidence: [CRDT_REPLAY],
  },
  {
    file: 'capabilities.ts',
    exportPath: 'CAPABILITIES[3].title',
    text: 'Circuit breakers + retry + bulkhead',
    evidence: [RESILIENCE],
  },
  {
    file: 'capabilities.ts',
    exportPath: 'CAPABILITIES[3].body',
    text: 'Production resilience patterns wired into the runtime: circuit breakers with adaptive failure thresholds, configurable retry with backoff, and bulkhead isolation that early-stage SaaS usually skips.',
    evidence: [RESILIENCE],
  },
  {
    file: 'capabilities.ts',
    exportPath: 'CAPABILITIES[4].title',
    text: 'Agent harness + shared workboard',
    evidence: [HARNESS_ADAPTER, HARNESS_WORKBOARD],
  },
  {
    file: 'capabilities.ts',
    exportPath: 'CAPABILITIES[4].body',
    text: 'A working agent adapter, a shared workboard manager for cross-session coordination, and a translation layer. Adapter profiles for Claude Code and Cursor are specced on the roadmap, not shipped.',
    evidence: [HARNESS_ADAPTER, HARNESS_WORKBOARD],
  },
  {
    file: 'capabilities.ts',
    exportPath: 'CAPABILITIES[5].title',
    text: 'MCP hypervisor + introspection',
    evidence: [HYPERVISOR],
  },
  {
    file: 'capabilities.ts',
    exportPath: 'CAPABILITIES[5].body',
    text: 'One process supervises all MCP servers and surfaces their tool registries, so every adapter is discoverable from a single place.',
    evidence: [HYPERVISOR],
  },
  {
    file: 'capabilities.ts',
    exportPath: 'CAPABILITIES[6].title',
    text: 'Envelope encryption + key rotation',
    evidence: [ENCRYPTION],
  },
  {
    file: 'capabilities.ts',
    exportPath: 'CAPABILITIES[6].body',
    text: 'Sensitive fields wrapped in per-record DEKs encrypted by a KEK, with a rotation manager that re-encrypts records under a new key.',
    evidence: [ENCRYPTION],
  },
  {
    file: 'capabilities.ts',
    exportPath: 'CAPABILITIES[7].body',
    text: 'Every collaborative edit records whether a human or an agent made it, and which model. A commit-level provenance schema and API ship alongside; the automatic commit ingest is on the roadmap.',
    evidence: [PROVENANCE],
  },

  // ── products.ts ──────────────────────────────────────────────────────────
  {
    file: 'products.ts',
    exportPath: 'PRODUCTS_PAGE_HERO.h1',
    text: 'The RevFleet product family',
    evidence: [REVVAULT_REPO, REVDEV_REPO, REVCON_REPO, REVSKILLS_REPO],
  },
  {
    file: 'products.ts',
    exportPath: 'PRODUCTS_PAGE_HERO.subtitle',
    text: 'Start with the runtime, add the rest as you grow. Seven products on one foundation, all built and operated by RevealUI Studio. Five are yours to use today, RevForge runs in private preview, and the agent marketplace is on the way.',
    evidence: [
      REPO,
      REVVAULT_REPO,
      REVDEV_REPO,
      REVCON_REPO,
      REVSKILLS_REPO,
      REVFORGE_REF,
      ROADMAP,
    ],
  },
  {
    file: 'products.ts',
    exportPath: 'PRODUCTS_FLAGSHIP.priceLabel',
    text: 'Free to self-host · Pro tier optional',
    evidence: [LICENSE_MIT, SELF_HOST, TIER_GATES],
  },
  {
    file: 'products.ts',
    exportPath: 'PRODUCTS_FLAGSHIP.tagline',
    text: 'The agentic business runtime',
    evidence: [AGENT_ROUTES, SELF_HOST],
  },
  {
    file: 'products.ts',
    exportPath: 'PRODUCTS_FLAGSHIP.body',
    text: 'People, content, offers, payments, and agents: pre-wired into one runtime your team and your AI agents share through a single open protocol. The foundation every other RevFleet product builds on.',
    evidence: [AUTH_SESSIONS, COLLECTIONS, BILLING, AGENT_ROUTES, MCP_CONTENT],
  },
  {
    file: 'products.ts',
    exportPath: 'PRODUCTS_SISTERS[0].tagline',
    text: 'Age-encrypted secret vault',
    evidence: [REVVAULT_REPO],
  },
  {
    file: 'products.ts',
    exportPath: 'PRODUCTS_SISTERS[0].highlights[0]',
    text: 'Rust CLI + Tauri desktop app',
    evidence: [REVVAULT_REPO],
  },
  {
    file: 'products.ts',
    exportPath: 'PRODUCTS_SISTERS[0].highlights[1]',
    text: 'Age-encrypted, passage-compatible store format',
    evidence: [REVVAULT_REPO],
  },
  {
    file: 'products.ts',
    exportPath: 'PRODUCTS_SISTERS[0].highlights[2]',
    text: 'Canonical secret store, no .env plaintext',
    evidence: [REVVAULT_REPO],
  },
  {
    file: 'products.ts',
    exportPath: 'PRODUCTS_SISTERS[1].highlights[0]',
    text: 'Generates branded RevealUI trial kits',
    evidence: [REVFORGE_REF],
  },
  {
    file: 'products.ts',
    exportPath: 'PRODUCTS_SISTERS[1].highlights[1]',
    text: 'Domain-locked, multi-tenant',
    evidence: [REVFORGE_REF],
  },
  {
    file: 'products.ts',
    exportPath: 'PRODUCTS_SISTERS[1].highlights[2]',
    text: 'Self-hosted runtime instances',
    evidence: [REVFORGE_REF],
  },
  {
    file: 'products.ts',
    exportPath: 'PRODUCTS_SISTERS[1].priceLabel',
    text: 'Operator tool · private preview',
    evidence: [REVFORGE_REF],
  },
  {
    file: 'products.ts',
    exportPath: 'PRODUCTS_SISTERS[2].highlights[0]',
    text: 'Desktop Studio + Console + Node daemon',
    evidence: [REVDEV_REPO],
  },
  {
    file: 'products.ts',
    exportPath: 'PRODUCTS_SISTERS[2].highlights[1]',
    text: 'Coordinates agents across a multi-repo workspace',
    evidence: [REVDEV_REPO],
  },
  {
    file: 'products.ts',
    exportPath: 'PRODUCTS_SISTERS[2].highlights[2]',
    text: 'Registers and coordinates agents over JSON-RPC',
    evidence: [REVDEV_REPO],
  },
  {
    file: 'products.ts',
    exportPath: 'PRODUCTS_SISTERS[3].highlights[1]',
    text: 'Symlinked into every project',
    evidence: [REVCON_REPO],
  },
  {
    file: 'products.ts',
    exportPath: 'PRODUCTS_SISTERS[3].highlights[2]',
    text: 'Edit once, propagate fleet-wide',
    evidence: [REVCON_REPO],
  },
  {
    file: 'products.ts',
    exportPath: 'PRODUCTS_SISTERS[4].tagline',
    text: 'Claude Code skills library',
    evidence: [REVSKILLS_REPO],
  },
  {
    file: 'products.ts',
    exportPath: 'PRODUCTS_SISTERS[4].highlights[0]',
    text: 'Drizzle schemas, Vitest patterns, security hardening',
    evidence: [REVSKILLS_REPO],
  },
  {
    file: 'products.ts',
    exportPath: 'PRODUCTS_SISTERS[4].highlights[1]',
    text: 'Drop into any Claude Code agent',
    evidence: [REVSKILLS_REPO],
  },
  {
    file: 'products.ts',
    exportPath: 'PRODUCTS_SISTERS[5].highlights[0]',
    text: 'N first-party integrations, out of the box. (interpolated: N from METRICS.mcpServers)',
    match: 'path',
    evidence: [MCP_SERVERS],
  },
  {
    file: 'products.ts',
    exportPath: 'PRODUCTS_SISTERS[5].highlights[1]',
    text: 'Stripe, Neon, Vercel, Next.js, and more',
    evidence: [MCP_SERVERS],
  },
  {
    file: 'products.ts',
    exportPath: 'PRODUCTS_SISTERS[5].highlights[2]',
    text: 'Third-party publishing planned',
    evidence: [ROADMAP],
  },
  {
    file: 'products.ts',
    exportPath: 'PRODUCTS_STATS_SECTION.heading',
    text: 'Built to production standards',
    evidence: [CI_GATE],
  },
  {
    file: 'products.ts',
    exportPath: 'PRODUCTS_STATS_SECTION.body',
    text: 'Not a starter template. A complete runtime with tested, documented, and audited code.',
    evidence: [CI_GATE, REPO],
  },
  {
    file: 'products.ts',
    exportPath: 'PRODUCTS_CTA_SECTION.body',
    text: 'Every other RevFleet product builds on RevealUI. One command, full source, everything pre-wired and ready for your first deploy.',
    evidence: [REPO, CLI_CREATE],
  },
  {
    file: 'products.ts',
    exportPath: 'PRODUCTS_CTA_SECTION.cliSnippet',
    text: 'npx create-revealui my-app',
    evidence: [CLI_CREATE],
  },

  // ── primitives.ts — PRODUCTS_PRIMITIVES[0] People ────────────────────────
  {
    file: 'primitives.ts',
    exportPath: 'PRODUCTS_PRIMITIVES[0].forYou.headline',
    text: 'Auth, roles, and compliance, handled',
    evidence: [AUTH_SESSIONS, SECURITY_AUTHZ, GDPR],
  },
  {
    file: 'primitives.ts',
    exportPath: 'PRODUCTS_PRIMITIVES[0].forYou.description',
    text: 'Session-based auth, RBAC with 60 enforcement tests, rate limiting, brute-force protection, and GDPR compliance. No auth library decisions. No JWT debates.',
    evidence: [AUTH_SESSIONS, ENFORCEMENT_TESTS, GDPR],
  },
  {
    file: 'primitives.ts',
    exportPath: 'PRODUCTS_PRIMITIVES[0].forAgents.headline',
    text: 'Agents call the same identity-aware API',
    evidence: [AGENT_ROUTES, MCP_CONTENT],
  },
  {
    file: 'primitives.ts',
    exportPath: 'PRODUCTS_PRIMITIVES[0].forAgents.description',
    text: 'Agents reach the runtime through the identical REST and MCP surface your app uses. Scoping what an individual agent can do through the RBAC + ABAC engine is not shipped yet.',
    evidence: [AGENT_ROUTES, MCP_CONTENT, SECURITY_AUTHZ],
  },
  {
    file: 'primitives.ts',
    exportPath: 'PRODUCTS_PRIMITIVES[0].together.headline',
    text: 'One access control engine for your team, today.',
    evidence: [SECURITY_AUTHZ],
  },
  {
    file: 'primitives.ts',
    exportPath: 'PRODUCTS_PRIMITIVES[0].together.description',
    text: 'RBAC + ABAC governs your human users, proven by 60 enforcement tests. Extending that same engine to scope agents individually is on our list, not yet shipped.',
    evidence: [SECURITY_AUTHZ, ENFORCEMENT_TESTS],
  },
  {
    file: 'primitives.ts',
    exportPath: 'PRODUCTS_PRIMITIVES[0].features[0]',
    text: 'Session-based auth (httpOnly, secure, sameSite)',
    evidence: [AUTH_SESSIONS],
  },
  {
    file: 'primitives.ts',
    exportPath: 'PRODUCTS_PRIMITIVES[0].features[2]',
    text: 'Rate limiting and brute-force protection',
    evidence: [AUTH_SESSIONS],
  },
  {
    file: 'primitives.ts',
    exportPath: 'PRODUCTS_PRIMITIVES[0].features[4]',
    text: 'Multi-tenant user isolation',
    evidence: [TENANT],
  },

  // ── primitives.ts — PRODUCTS_PRIMITIVES[1] Content ───────────────────────
  {
    file: 'primitives.ts',
    exportPath: 'PRODUCTS_PRIMITIVES[1].forYou.headline',
    text: 'Define collections in TypeScript, get an API and admin UI',
    evidence: [COLLECTIONS, OPEN_STANDARDS],
  },
  {
    file: 'primitives.ts',
    exportPath: 'PRODUCTS_PRIMITIVES[1].forYou.description',
    text: 'Rich text editing with Lexical, media management, draft/live publishing, and a full REST API with OpenAPI spec. Define your data model once and the admin dashboard and API generate automatically.',
    evidence: [COLLECTIONS, RICHTEXT, MEDIA_R2, DRAFTS, OPEN_STANDARDS],
  },
  {
    file: 'primitives.ts',
    exportPath: 'PRODUCTS_PRIMITIVES[1].forAgents.headline',
    text: 'Collections become discoverable resources over MCP',
    evidence: [MCP_CONTENT],
  },
  {
    file: 'primitives.ts',
    exportPath: 'PRODUCTS_PRIMITIVES[1].forAgents.description',
    text: 'The content MCP server ships discovery and read tools, and any collection you flag with mcpResource: true becomes a discoverable MCP resource. Agents write through the same REST API your app uses.',
    evidence: [MCP_CONTENT, OPEN_STANDARDS],
  },
  {
    file: 'primitives.ts',
    exportPath: 'PRODUCTS_PRIMITIVES[1].together.headline',
    text: 'Define your data model once. Choose what agents can discover.',
    evidence: [COLLECTIONS, MCP_CONTENT],
  },
  {
    file: 'primitives.ts',
    exportPath: 'PRODUCTS_PRIMITIVES[1].together.description',
    text: 'Add a collection and the admin UI and REST API appear with it. Flag it as an MCP resource and agents can discover and read it too.',
    evidence: [COLLECTIONS, MCP_CONTENT],
  },
  {
    file: 'primitives.ts',
    exportPath: 'PRODUCTS_PRIMITIVES[1].features[0]',
    text: 'Schema-first collection definitions',
    evidence: [COLLECTIONS],
  },
  {
    file: 'primitives.ts',
    exportPath: 'PRODUCTS_PRIMITIVES[1].features[1]',
    text: 'Rich text editor with custom blocks',
    evidence: [RICHTEXT],
  },
  {
    file: 'primitives.ts',
    exportPath: 'PRODUCTS_PRIMITIVES[1].features[2]',
    text: 'REST API with OpenAPI spec',
    evidence: [OPEN_STANDARDS],
  },
  {
    file: 'primitives.ts',
    exportPath: 'PRODUCTS_PRIMITIVES[1].features[3]',
    text: 'Draft/live publishing workflow',
    evidence: [DRAFTS],
  },
  {
    file: 'primitives.ts',
    exportPath: 'PRODUCTS_PRIMITIVES[1].features[4]',
    text: 'Media management and CDN delivery',
    evidence: [MEDIA_R2],
  },
  {
    file: 'primitives.ts',
    exportPath: 'PRODUCTS_PRIMITIVES[1].features[5]',
    text: 'R2-backed media with CDN delivery',
    evidence: [MEDIA_R2],
  },

  // ── primitives.ts — PRODUCTS_PRIMITIVES[2] Offers ────────────────────────
  {
    file: 'primitives.ts',
    exportPath: 'PRODUCTS_PRIMITIVES[2].forYou.headline',
    text: 'Product catalog, pricing tiers, and usage tracking',
    evidence: [BILLING, TIER_GATES, TIER_LIMITS],
  },
  {
    file: 'primitives.ts',
    exportPath: 'PRODUCTS_PRIMITIVES[2].forYou.description',
    text: 'Define products, pricing tiers, and feature gates in one place. License enforcement and upgrade prompts are built in. Subscription billing via Stripe, and perpetual licenses you can buy today.',
    evidence: [BILLING, TIER_GATES, PERPETUAL],
  },
  {
    file: 'primitives.ts',
    exportPath: 'PRODUCTS_PRIMITIVES[2].forAgents.headline',
    text: 'Feature gates control which agent capabilities are enabled per tier',
    evidence: [TIER_GATES, TASK_QUOTA],
  },
  {
    file: 'primitives.ts',
    exportPath: 'PRODUCTS_PRIMITIVES[2].forAgents.description',
    text: 'Agent capabilities are gated by the same tier system that governs human features. When a customer upgrades, their agents automatically gain access to more tools and higher task limits.',
    evidence: [TIER_GATES, TIER_LIMITS, TASK_QUOTA],
  },
  {
    file: 'primitives.ts',
    exportPath: 'PRODUCTS_PRIMITIVES[2].together.headline',
    text: 'Revenue model governs both humans and agents.',
    evidence: [BILLING, TIER_GATES],
  },
  {
    file: 'primitives.ts',
    exportPath: 'PRODUCTS_PRIMITIVES[2].together.description',
    text: 'Upgrade a customer and their agents get smarter. One product catalog, one billing system, one set of feature gates, applied consistently to every user and every agent.',
    evidence: [BILLING, TIER_GATES],
  },
  {
    file: 'primitives.ts',
    exportPath: 'PRODUCTS_PRIMITIVES[2].features[0]',
    text: 'Subscription and perpetual pricing tracks, live today.',
    evidence: [BILLING, PERPETUAL],
  },
  {
    file: 'primitives.ts',
    exportPath: 'PRODUCTS_PRIMITIVES[2].features[1]',
    text: 'Feature gating with tier enforcement',
    evidence: [TIER_GATES],
  },
  {
    file: 'primitives.ts',
    exportPath: 'PRODUCTS_PRIMITIVES[2].features[2]',
    text: 'Usage tracking and limit enforcement',
    evidence: [TIER_LIMITS, TASK_QUOTA],
  },
  {
    file: 'primitives.ts',
    exportPath: 'PRODUCTS_PRIMITIVES[2].features[4]',
    text: 'Upgrade prompts and billing portal',
    evidence: [BILLING],
  },
  {
    file: 'primitives.ts',
    exportPath: 'PRODUCTS_PRIMITIVES[2].features[5]',
    text: 'Agent task quotas metered and enforced per tier',
    evidence: [TASK_QUOTA, TIER_LIMITS],
  },

  // ── primitives.ts — PRODUCTS_PRIMITIVES[3] Payments ──────────────────────
  {
    file: 'primitives.ts',
    exportPath: 'PRODUCTS_PRIMITIVES[3].forYou.headline',
    text: 'Stripe checkout, subscriptions, and billing, pre-configured',
    evidence: [BILLING],
  },
  {
    file: 'primitives.ts',
    exportPath: 'PRODUCTS_PRIMITIVES[3].forYou.description',
    text: 'Stripe checkout, subscription management, webhooks, and a customer billing portal. Products, prices, and webhooks are wired up. You configure your Stripe keys and start charging.',
    evidence: [BILLING, WEBHOOKS],
  },
  {
    file: 'primitives.ts',
    exportPath: 'PRODUCTS_PRIMITIVES[3].forAgents.headline',
    text: 'x402 protocol design: agent-native HTTP payments',
    evidence: [X402],
  },
  {
    file: 'primitives.ts',
    exportPath: 'PRODUCTS_PRIMITIVES[3].forAgents.description',
    text: 'The x402 design routes agent payments over HTTP 402, aligned with the Coinbase / Cloudflare x402 Foundation. This is in development. See the roadmap for current status.',
    evidence: [X402, ROADMAP],
  },
  {
    file: 'primitives.ts',
    exportPath: 'PRODUCTS_PRIMITIVES[3].together.headline',
    text: 'Humans monetize. Agents transact. One billing infrastructure.',
    evidence: [BILLING, X402],
  },
  {
    file: 'primitives.ts',
    exportPath: 'PRODUCTS_PRIMITIVES[3].together.description',
    text: 'Your customers pay through Stripe. Agent payments via x402 are in development. Both flows are designed to settle into the same revenue system.',
    evidence: [BILLING, X402],
  },
  {
    file: 'primitives.ts',
    exportPath: 'PRODUCTS_PRIMITIVES[3].features[0]',
    text: 'Stripe checkout and subscriptions',
    evidence: [BILLING],
  },
  {
    file: 'primitives.ts',
    exportPath: 'PRODUCTS_PRIMITIVES[3].features[1]',
    text: 'Webhook handling and event processing',
    evidence: [WEBHOOKS],
  },
  {
    file: 'primitives.ts',
    exportPath: 'PRODUCTS_PRIMITIVES[3].features[3]',
    text: 'x402 agent payments (in development)',
    evidence: [X402],
  },

  // ── primitives.ts — PRODUCTS_PRIMITIVES[4] Agents ────────────────────────
  {
    file: 'primitives.ts',
    exportPath: 'PRODUCTS_PRIMITIVES[4].forYou.headline',
    text: 'Agents on open-weight models you run yourself',
    evidence: [OPEN_WEIGHT],
  },
  {
    file: 'primitives.ts',
    exportPath: 'PRODUCTS_PRIMITIVES[4].forYou.description',
    text: 'Agents manage content, process tasks, and coordinate workflows on open-weight models running on infrastructure you own, via Ubuntu Inference Snaps or Ollama. Add a frontier provider in one config line: opt-in, never assumed. Your own inference cost, not a per-token API tax.',
    evidence: [OPEN_WEIGHT, PROVIDERS],
  },
  {
    file: 'primitives.ts',
    exportPath: 'PRODUCTS_PRIMITIVES[4].forAgents.headline',
    text: 'A2A protocol, CRDT memory, and MCP servers',
    evidence: [A2A_ROUTES, MEMORY, MCP_SERVERS],
  },
  {
    file: 'primitives.ts',
    exportPath: 'PRODUCTS_PRIMITIVES[4].forAgents.description',
    text: 'Agent-to-agent communication, persistent memory, and N production MCP servers. (interpolated: N from METRICS.mcpServers)',
    match: 'path',
    evidence: [A2A_ROUTES, MEMORY, MCP_SERVERS],
  },
  {
    file: 'primitives.ts',
    exportPath: 'PRODUCTS_PRIMITIVES[4].together.headline',
    text: 'Build one business. Agents extend it. Neither locked to any vendor.',
    evidence: [OPEN_WEIGHT, PROVIDERS, OPEN_STANDARDS],
  },
  {
    file: 'primitives.ts',
    exportPath: 'PRODUCTS_PRIMITIVES[4].together.description',
    text: 'You build on open standards. Your agents operate through the same open standards. Switch models, swap providers, self-host everything. The intelligence layer belongs to you.',
    evidence: [OPEN_STANDARDS, PROVIDERS, SELF_HOST],
  },
  {
    file: 'primitives.ts',
    exportPath: 'PRODUCTS_PRIMITIVES[4].features[0]',
    text: 'Open-model inference (Snaps, Ollama)',
    evidence: [OPEN_WEIGHT],
  },
  {
    file: 'primitives.ts',
    exportPath: 'PRODUCTS_PRIMITIVES[4].features[1]',
    text: 'CRDT-based agent memory (working + episodic + vector)',
    evidence: [MEMORY],
  },
  {
    file: 'primitives.ts',
    exportPath: 'PRODUCTS_PRIMITIVES[4].features[3]',
    text: 'A2A agent-to-agent protocol',
    evidence: [A2A_ROUTES],
  },
  {
    file: 'primitives.ts',
    exportPath: 'PRODUCTS_PRIMITIVES[4].features[4]',
    text: 'Multi-agent coordination and orchestration',
    evidence: [ORCHESTRATOR],
  },
  {
    file: 'primitives.ts',
    exportPath: 'PRODUCTS_PRIMITIVES[4].features[5]',
    text: 'Real-time coordination sync (ElectricSQL)',
    evidence: [ELECTRIC_SYNC],
  },

  // ── pricing.ts (claims-ratchet 2, 2026-07-12) ───────────────────────────
  {
    file: 'pricing.ts',
    exportPath: 'PRICING_HERO.subtitle',
    text: 'Subscribe, or buy a perpetual license. Start free. Upgrade when you need to.',
    evidence: [PERPETUAL, TIER_LIMITS],
  },
  {
    file: 'pricing.ts',
    exportPath: 'PRICING_HERO_SUBTEXT.prefix',
    text: 'All plans run as self-hosted installations under your license. Managed deployment available as a service add-on. Want to deploy a branded version for your own customers? See',
    evidence: [SELF_HOST, COMMERCIAL_POLICY, PERPETUAL],
  },
  {
    file: 'pricing.ts',
    exportPath: 'PRICING_HERO_SUBTEXT.suffix',
    text: 'for RevealUI Fleet licensing.',
    evidence: [PERPETUAL],
  },
  {
    file: 'pricing.ts',
    exportPath: 'PRICING_TRACK_A_SECTION.heading',
    text: 'Subscribe monthly or annually',
    evidence: [BILLING],
  },
  {
    file: 'pricing.ts',
    exportPath: 'PRICING_TRACK_A_SECTION.body',
    text: 'Every subscription includes an agent task allowance. 7-day free trial on Pro and Max.',
    evidence: [TIER_LIMITS, TRIAL],
  },
  {
    file: 'pricing.ts',
    exportPath: 'PRICING_VALUE_BAND.body',
    text: 'Teams shipping more than one product typically rent auth, content, billing, and observability from four or five vendors, and the bill climbs further once enterprise SSO or compliance tiers enter. RevealUI replaces the rented stack with one runtime you own. You still pay for your own Postgres and compute.',
    evidence: [INFRA_COST_ESTIMATE, SELF_HOST],
  },
  {
    file: 'pricing.ts',
    exportPath: 'PRICING_VALUE_BAND.points[0]',
    text: 'One runtime, not five separate SaaS subscriptions',
    evidence: [INFRA_COST_ESTIMATE, SELF_HOST],
  },
  {
    file: 'pricing.ts',
    exportPath: 'PRICING_VALUE_BAND.points[1]',
    text: 'Self-host on Vercel, Cloudflare, Fly, Hetzner, or your own metal',
    evidence: [DEPLOY_TARGETS],
  },
  {
    file: 'pricing.ts',
    exportPath: 'PRICING_VALUE_BAND.points[2]',
    text: 'Full source code access on every tier',
    evidence: [LICENSE_MIT, REPO],
  },
  {
    file: 'pricing.ts',
    exportPath: 'PRICING_VALUE_BAND.points[3]',
    text: "Open-weight AI by default: your bill doesn't scale with usage",
    evidence: [OPEN_WEIGHT],
  },
  {
    file: 'pricing.ts',
    exportPath: 'PRICING_COST_CALCULATOR.heading',
    text: 'Add up what you would otherwise rent.',
    evidence: [INFRA_COST_ESTIMATE],
  },
  {
    file: 'pricing.ts',
    exportPath: 'PRICING_COST_CALCULATOR.body',
    text: 'A multi-product team rents auth, content, billing, observability, and background jobs from four to six vendors. Estimate the monthly bill for that rented stack, then compare it to one runtime you own.',
    evidence: [INFRA_COST_ESTIMATE, SELF_HOST],
  },
  {
    file: 'pricing.ts',
    exportPath: 'PRICING_COST_CALCULATOR.inputs.vendors.label',
    text: 'Vendor services you would replace',
    evidence: [INFRA_COST_ESTIMATE],
  },
  {
    file: 'pricing.ts',
    exportPath: 'PRICING_COST_CALCULATOR.tiers[0].note',
    text: 'Entry tiers across four or five vendors.',
    evidence: [INFRA_COST_ESTIMATE],
  },
  {
    file: 'pricing.ts',
    exportPath: 'PRICING_COST_CALCULATOR.tiers[1].note',
    text: 'More products and seats push you up the published tiers.',
    evidence: [INFRA_COST_ESTIMATE],
  },
  {
    file: 'pricing.ts',
    exportPath: 'PRICING_COST_CALCULATOR.tiers[2].note',
    text: 'Enterprise SSO, compliance tiers, or higher-tier auth enter.',
    evidence: [INFRA_COST_ESTIMATE],
  },
  {
    file: 'pricing.ts',
    exportPath: 'PRICING_COST_CALCULATOR.revealui.sub',
    text: '+ your own Postgres and compute',
    evidence: [SELF_HOST],
  },
  {
    file: 'pricing.ts',
    exportPath: 'PRICING_COST_CALCULATOR.footnote',
    text: 'A sourced estimate from current 2026 published pricing, time-sensitive. It excludes payment processing, and RevealUI is self-hosted, so you still pay for your own Postgres and compute. Figures are ranges, not a quote.',
    evidence: [INFRA_COST_ESTIMATE, SELF_HOST],
  },
  {
    file: 'pricing.ts',
    exportPath: 'PRICING_TRIAL_NOTE',
    text: 'Pro and Max include a 7-day free trial. Cancel during the trial and you pay nothing.',
    evidence: [TRIAL],
  },
  {
    file: 'pricing.ts',
    exportPath: 'PRICING_TRACK_C_SECTION.body',
    text: 'A perpetual license costs about three years of the subscription. Pay once, own it forever, and renew support only if you want it.',
    evidence: [PERPETUAL, COMMERCIAL_POLICY],
  },
  {
    file: 'pricing.ts',
    exportPath: 'PRICING_AGENCY_VALUE_BAND.heading',
    text: 'One runtime. Every client gets their own.',
    evidence: [PERPETUAL],
  },
  {
    file: 'pricing.ts',
    exportPath: 'PRICING_AGENCY_VALUE_BAND.body',
    text: 'Building or reselling software for more than one client means re-licensing auth, billing, content, and an admin for every account you take on. An Agency Perpetual license covers the runtime once, so you ship a branded, self-hosted instance per client instead.',
    evidence: [PERPETUAL, REVFORGE_REF],
  },
  {
    file: 'pricing.ts',
    exportPath: 'PRICING_AGENCY_VALUE_BAND.points[0]',
    text: 'One license, a branded instance per client. No per-client SaaS re-licensing.',
    evidence: [PERPETUAL],
  },
  {
    file: 'pricing.ts',
    exportPath: 'PRICING_AGENCY_VALUE_BAND.points[1]',
    text: 'White-label stamping via RevForge, in private preview.',
    evidence: [REVFORGE_REF, FEATURES_MATRIX],
  },
  {
    file: 'pricing.ts',
    exportPath: 'PRICING_AGENCY_VALUE_BAND.points[2]',
    text: 'Each client owns their data, infrastructure, and Stripe account. Clean handoff, no lock-in.',
    evidence: [SELF_HOST, COMMERCIAL_POLICY],
  },
  {
    file: 'pricing.ts',
    exportPath: 'PRICING_AGENCY_VALUE_BAND.points[3]',
    text: 'One runtime, one upgrade cadence across every client you serve.',
    evidence: [PERPETUAL],
  },
  {
    file: 'pricing.ts',
    exportPath: 'PRICING_AGENTS_SECTION.subhead',
    text: 'Agents discover, authenticate, and pay without human intervention.',
    evidence: [LIVE_AGENT_CARD, AUTH_SESSIONS, X402],
  },
  {
    file: 'pricing.ts',
    exportPath: 'PRICING_AGENT_A2A.body.prefix',
    text: 'Agents find RevealUI via a standard Agent Card at',
    evidence: [LIVE_AGENT_CARD, A2A_ROUTES],
  },
  {
    file: 'pricing.ts',
    exportPath: 'PRICING_AGENT_A2A.body.suffix',
    text: '. Capabilities, skills, and pricing all machine-readable.',
    evidence: [LIVE_AGENT_CARD],
  },
  {
    file: 'pricing.ts',
    exportPath: 'PRICING_AGENT_X402.body',
    text: 'RevealUI implements the HTTP 402 payment protocol. Built on the open x402 standard, with a Coinbase-compatible facilitator implemented. Agents pay agents over standard HTTP. No accounts, no subscriptions. The rail ships in the code and activates when the operator configures a receiving wallet; it is not switched on today.',
    evidence: [X402, X402_FACILITATOR],
  },
  {
    file: 'pricing.ts',
    exportPath: 'PRICING_AGENT_MCP.body',
    text: 'N production MCP servers including Stripe, Neon, Vercel, Playwright, Next.js DevTools, content management, and email. Marketplace discovery coming soon. (interpolated: N from METRICS.mcpServers)',
    match: 'path',
    evidence: [MCP_SERVERS],
  },
  {
    file: 'pricing.ts',
    exportPath: 'PRICING_DONE_FOR_YOU.heading',
    text: 'Want it built and handed over?',
    evidence: [COMMERCIAL_POLICY],
  },
  {
    file: 'pricing.ts',
    exportPath: 'PRICING_DONE_FOR_YOU.body',
    text: 'RevealUI Studio (the agency) ships fixed-bid engagements on the runtime: scoped in a discovery call, delivered with a full handoff, owned by you afterward.',
    evidence: [COMMERCIAL_POLICY],
  },
  {
    file: 'pricing.ts',
    exportPath: 'PRICING_DONE_FOR_YOU.rungs[0].note',
    text: 'Fixed-bid written assessment of your project, schema, deployment, and security posture. Credited toward a Fleet deployment if you proceed within 30 days.',
    evidence: [COMMERCIAL_POLICY],
  },
  {
    file: 'pricing.ts',
    exportPath: 'PRICING_DONE_FOR_YOU.rungs[1].note',
    text: 'Your RevealUI instance is set up, configured, and deployed to production, with a full handoff session included.',
    evidence: [COMMERCIAL_POLICY],
  },
  {
    file: 'pricing.ts',
    exportPath: 'PRICING_DONE_FOR_YOU.rungs[2].note',
    text: 'A branded, self-hosted RevealUI deployment for your business or your clients. Starting point, scoped in discovery.',
    evidence: [COMMERCIAL_POLICY],
  },
  {
    file: 'pricing.ts',
    exportPath: 'PRICING_DONE_FOR_YOU.rungs[3].note',
    text: 'Bespoke platform engagement, 4 to 12 week sprints. Starting point, scoped in discovery.',
    evidence: [COMMERCIAL_POLICY],
  },
  {
    file: 'pricing.ts',
    exportPath: 'PRICING_DONE_FOR_YOU.secondaryCta.label',
    text: 'Visit revealuistudio.com →',
    evidence: [{ kind: 'url', ref: 'https://revealuistudio.com', note: 'agency site link label' }],
  },
  {
    file: 'pricing.ts',
    exportPath: 'PRICING_FINAL_CTA.title',
    text: 'Start free with full source access.',
    evidence: [LICENSE_MIT, TIER_LIMITS],
  },
  {
    file: 'pricing.ts',
    exportPath: 'PRICING_FINAL_CTA.subtitle',
    text: 'Every tier ships the complete source. Upgrade when your business needs Pro features.',
    evidence: [LICENSE_MIT, TIER_GATES],
  },
  {
    file: 'pricing.ts',
    exportPath: 'PRICING_NEWSLETTER_LABEL',
    text: 'Not ready yet? Get release updates by email.',
    evidence: [WAITLIST],
  },
  {
    file: 'pricing.ts',
    exportPath: 'SUBSCRIPTION_TIERS[0].description',
    text: 'Perfect for trying out RevealUI and small projects.',
    evidence: [TIER_LIMITS],
  },
  {
    file: 'pricing.ts',
    exportPath: 'SUBSCRIPTION_TIERS[0].features[0]',
    text: 'Unlimited admin collections',
    evidence: [COLLECTIONS],
  },
  {
    file: 'pricing.ts',
    exportPath: 'SUBSCRIPTION_TIERS[0].features[5]',
    text: 'Local AI inference (Inference Snaps / Ollama)',
    evidence: [OPEN_WEIGHT],
  },
  {
    file: 'pricing.ts',
    exportPath: 'SUBSCRIPTION_TIERS[1].description',
    text: 'For software companies building production products.',
    evidence: [TIER_LIMITS],
  },
  {
    file: 'pricing.ts',
    exportPath: 'SUBSCRIPTION_TIERS[1].features[0]',
    text: 'Unlimited admin collections',
    evidence: [COLLECTIONS],
  },
  {
    file: 'pricing.ts',
    exportPath: 'SUBSCRIPTION_TIERS[1].features[4]',
    text: 'AI agents (local + cloud via RevealUI harness)',
    evidence: [OPEN_WEIGHT, PROVIDERS],
  },
  {
    file: 'pricing.ts',
    exportPath: 'SUBSCRIPTION_TIERS[1].features[9]',
    text: '10,000 agent tasks/month included',
    evidence: [TIER_LIMITS],
  },
  {
    file: 'pricing.ts',
    exportPath: 'SUBSCRIPTION_TIERS[1].features[10]',
    text: 'RevVault desktop app (encrypted secret management)',
    evidence: [REVVAULT_REPO],
  },
  {
    file: 'pricing.ts',
    exportPath: 'SUBSCRIPTION_TIERS[1].features[11]',
    text: 'RevVault rotation engine (automated credential lifecycle)',
    evidence: [REVVAULT_REPO],
  },
  {
    file: 'pricing.ts',
    exportPath: 'SUBSCRIPTION_TIERS[1].features[12]',
    text: 'Email support (48h response)',
    evidence: [COMMERCIAL_POLICY],
  },
  {
    file: 'pricing.ts',
    exportPath: 'SUBSCRIPTION_TIERS[1].cta',
    text: 'Start your 7-day free trial',
    evidence: [TRIAL],
  },
  {
    file: 'pricing.ts',
    exportPath: 'SUBSCRIPTION_TIERS[2].description',
    text: 'For teams that need AI memory, advanced inference, and compliance tooling.',
    evidence: [MEMORY, PROVIDERS, RBAC_ABAC],
  },
  {
    file: 'pricing.ts',
    exportPath: 'SUBSCRIPTION_TIERS[2].features[3]',
    text: 'Full AI memory (working + episodic + vector)',
    evidence: [MEMORY],
  },
  {
    file: 'pricing.ts',
    exportPath: 'SUBSCRIPTION_TIERS[2].features[4]',
    text: 'Advanced inference configuration (coming soon)',
    evidence: [PROVIDERS],
  },
  {
    file: 'pricing.ts',
    exportPath: 'SUBSCRIPTION_TIERS[2].features[6]',
    text: '50,000 agent tasks/month included',
    evidence: [TIER_LIMITS],
  },
  {
    file: 'pricing.ts',
    exportPath: 'SUBSCRIPTION_TIERS[2].features[7]',
    text: 'RevKit environment provisioning (coming soon)',
    evidence: [ROADMAP],
  },
  {
    file: 'pricing.ts',
    exportPath: 'SUBSCRIPTION_TIERS[2].features[8]',
    text: 'Email support (24h response)',
    evidence: [COMMERCIAL_POLICY],
  },
  {
    file: 'pricing.ts',
    exportPath: 'SUBSCRIPTION_TIERS[2].cta',
    text: 'Start your 7-day free trial',
    evidence: [TRIAL],
  },
  {
    file: 'pricing.ts',
    exportPath: 'SUBSCRIPTION_TIERS[3].description',
    text: 'Full ecosystem access with scale, compliance, and agent payments.',
    evidence: [TIER_LIMITS, RBAC_ABAC, X402],
  },
  {
    file: 'pricing.ts',
    exportPath: 'SUBSCRIPTION_TIERS[3].features[3]',
    text: 'Session-based auth + OAuth',
    evidence: [AUTH_SESSIONS],
  },
  {
    file: 'pricing.ts',
    exportPath: 'SUBSCRIPTION_TIERS[3].features[4]',
    text: 'Full inference suite (all open models)',
    evidence: [PROVIDERS, OPEN_WEIGHT],
  },
  {
    file: 'pricing.ts',
    exportPath: 'SUBSCRIPTION_TIERS[3].features[5]',
    text: 'x402 agent payments (USDC, coming soon)',
    evidence: [X402, X402_FACILITATOR],
  },
  {
    file: 'pricing.ts',
    exportPath: 'PERPETUAL_TIERS[0].description',
    text: 'Pro features, forever. No subscription required.',
    evidence: [PERPETUAL],
  },
  {
    file: 'pricing.ts',
    exportPath: 'PERPETUAL_TIERS[0].features[2]',
    text: '1 year priority support included',
    evidence: [COMMERCIAL_POLICY],
  },
  {
    file: 'pricing.ts',
    exportPath: 'PERPETUAL_TIERS[0].features[3]',
    text: 'All Pro updates released during support period',
    evidence: [COMMERCIAL_POLICY],
  },
  {
    file: 'pricing.ts',
    exportPath: 'PERPETUAL_TIERS[0].features[4]',
    text: 'Private GitHub repo access',
    evidence: [COMMERCIAL_POLICY],
  },
  {
    file: 'pricing.ts',
    exportPath: 'PERPETUAL_TIERS[1].description',
    text: 'RevealUI Fleet license for agencies. Sell branded RevealUI to your clients without per-site subscriptions.',
    evidence: [PERPETUAL, REVFORGE_REF],
  },
  {
    file: 'pricing.ts',
    exportPath: 'PERPETUAL_TIERS[1].features[2]',
    text: 'Up to 10 client deployments',
    evidence: [COMMERCIAL_POLICY],
  },
  {
    file: 'pricing.ts',
    exportPath: 'PERPETUAL_TIERS[1].features[3]',
    text: '1 year priority support included',
    evidence: [COMMERCIAL_POLICY],
  },
  {
    file: 'pricing.ts',
    exportPath: 'PERPETUAL_TIERS[1].features[4]',
    text: 'All Max updates released during support period',
    evidence: [COMMERCIAL_POLICY],
  },
  {
    file: 'pricing.ts',
    exportPath: 'PERPETUAL_TIERS[1].features[5]',
    text: 'Private GitHub repo access',
    evidence: [COMMERCIAL_POLICY],
  },
  {
    file: 'pricing.ts',
    exportPath: 'PERPETUAL_TIERS[2].description',
    text: 'Full self-hosted Enterprise tier with unlimited deployments.',
    evidence: [PERPETUAL, SELF_HOST],
  },
  {
    file: 'pricing.ts',
    exportPath: 'PERPETUAL_TIERS[2].features[0]',
    text: 'All Enterprise tier features',
    evidence: [TIER_LIMITS],
  },
  {
    file: 'pricing.ts',
    exportPath: 'PERPETUAL_TIERS[2].features[2]',
    text: 'Unlimited self-hosted deployments',
    evidence: [COMMERCIAL_POLICY],
  },
  {
    file: 'pricing.ts',
    exportPath: 'PERPETUAL_TIERS[2].features[3]',
    text: '1 year priority support included',
    evidence: [COMMERCIAL_POLICY],
  },
  {
    file: 'pricing.ts',
    exportPath: 'PERPETUAL_TIERS[2].features[4]',
    text: 'All Enterprise tier updates released during support period',
    evidence: [COMMERCIAL_POLICY],
  },
  {
    file: 'pricing.ts',
    exportPath: 'PERPETUAL_TIERS[2].features[5]',
    text: 'Private GitHub repo + Docker image access',
    evidence: [COMMERCIAL_POLICY],
  },

  // ── pricing-faq.ts (claims-ratchet 2, 2026-07-12) ───────────────────────
  {
    file: 'pricing-faq.ts',
    exportPath: 'PRICING_FAQS[0].question',
    text: 'Can I use the Free tier for commercial projects?',
    evidence: [
      { kind: 'code', ref: 'LICENSE', note: 'question copy; the answer carries the claims' },
    ],
  },
  {
    file: 'pricing-faq.ts',
    exportPath: 'PRICING_FAQS[0].answer',
    text: 'Yes. The Free tier is fully open-source (MIT) and can be used for commercial projects. You get full source code access and can deploy it anywhere you like.',
    evidence: [LICENSE_MIT, SELF_HOST],
  },
  {
    file: 'pricing-faq.ts',
    exportPath: 'PRICING_FAQS[1].question',
    text: 'What happens after the free trial ends?',
    evidence: [TRIAL],
  },
  {
    file: 'pricing-faq.ts',
    exportPath: 'PRICING_FAQS[1].answer',
    text: "Pro and Max tiers include a 7-day free trial. After the trial ends, you'll be charged the monthly rate. You can cancel anytime during the trial without being charged.",
    evidence: [TRIAL, BILLING],
  },
  {
    file: 'pricing-faq.ts',
    exportPath: 'PRICING_FAQS[2].question',
    text: 'How does agent task billing work?',
    evidence: [TASK_QUOTA],
  },
  {
    file: 'pricing-faq.ts',
    exportPath: 'PRICING_FAQS[2].answer',
    text: 'Every paid subscription includes a monthly task allowance: 10,000 tasks on Pro, 50,000 on Max, unlimited on Enterprise. Metered overage billing ships later; nothing is charged beyond the allowance today.',
    evidence: [TIER_LIMITS, TASK_QUOTA],
  },
  {
    file: 'pricing-faq.ts',
    exportPath: 'PRICING_FAQS[3].question',
    text: 'What are perpetual licenses?',
    evidence: [PERPETUAL],
  },
  {
    file: 'pricing-faq.ts',
    exportPath: 'PRICING_FAQS[3].answer',
    text: 'A perpetual license is a one-time purchase that gives you a license key for the corresponding tier, forever, with no monthly subscription required. Support and updates are included for 1 year; after that, renew your support contract or keep using the version you have.',
    evidence: [PERPETUAL, COMMERCIAL_POLICY],
  },
  {
    file: 'pricing-faq.ts',
    exportPath: 'PRICING_FAQS[4].question',
    text: 'Can I upgrade or downgrade my plan?',
    evidence: [BILLING],
  },
  {
    file: 'pricing-faq.ts',
    exportPath: 'PRICING_FAQS[4].answer',
    text: "Yes, you can upgrade your plan at any time. You'll be charged the prorated amount immediately. To downgrade, visit your billing portal or contact support. (interpolated: SITE.emails.support)",
    match: 'path',
    evidence: [BILLING],
  },
  {
    file: 'pricing-faq.ts',
    exportPath: 'PRICING_FAQS[5].question',
    text: 'How does AI inference work?',
    evidence: [OPEN_WEIGHT],
  },
  {
    file: 'pricing-faq.ts',
    exportPath: 'PRICING_FAQS[5].answer',
    text: 'Bring your own model. The default ships open-weight (Gemma-family and other open-weight models) via Ollama or Ubuntu Inference Snaps from Canonical (canonical default, Studio lifecycle pending), so your bill does not scale with usage. Switch to Claude, GPT, or any OpenAI-compatible provider in one config line. The runtime is provider-agnostic; the default is sovereignty-friendly.',
    evidence: [OPEN_WEIGHT, PROVIDERS],
  },
  {
    file: 'pricing-faq.ts',
    exportPath: 'PRICING_FAQS[6].question',
    text: 'What does "full source code access" mean?',
    evidence: [LICENSE_MIT],
  },
  {
    file: 'pricing-faq.ts',
    exportPath: 'PRICING_FAQS[6].answer',
    text: 'You get the complete RevealUI source code: every app and package is published in the public monorepo. Infrastructure packages (@revealui/core, auth, db, contracts, security, utils, config, cache, resilience, openapi, sync) are MIT-licensed. The five Pro packages (@revealui/ai, @revealui/engines, @revealui/harnesses, @revealui/mcp, @revealui/services) ship under Fair Source (FSL-1.1-MIT): source is visible, commercial use is permitted except for building a directly competing developer platform, and each release automatically converts to plain MIT two years after publication. All paid tiers add runtime entitlements (license validation, feature gates, priority updates) on top of that source access, and nothing is hidden behind a closed binary.',
    evidence: [LICENSE_SPLIT, LICENSE_MIT, REPO, TIER_GATES],
  },
  {
    file: 'pricing-faq.ts',
    exportPath: 'PRICING_FAQS[7].question',
    text: 'What is Fair Source (FSL-1.1-MIT)?',
    evidence: [FAIR_SOURCE_PAGE],
  },
  {
    file: 'pricing-faq.ts',
    exportPath: 'PRICING_FAQS[7].answer',
    text: "Fair Source is a middle path between closed commercial and plain open-source. Our five Pro packages (@revealui/ai, @revealui/engines, @revealui/harnesses, @revealui/mcp, @revealui/services) are source-visible on GitHub, installable from npm, and legally usable in commercial products, with one non-compete clause: you can't ship a substantially similar developer platform that competes with RevealUI on top of them. Two years after each release, that release automatically converts to MIT. Same license model used by Sentry, GitButler, and Keygen. Source-available under FSL: free for everyone except SaaS competitors. Pro plan = hosted infra + support, not npm-level enforcement. Full explainer at /fair-source.",
    evidence: [LICENSE_SPLIT, FAIR_SOURCE_PAGE, REPO],
  },
  {
    file: 'pricing-faq.ts',
    exportPath: 'PRICING_FAQS[8].question',
    text: 'Do you offer custom pricing for large teams?',
    evidence: [COMMERCIAL_POLICY],
  },
  {
    file: 'pricing-faq.ts',
    exportPath: 'PRICING_FAQS[8].answer',
    text: 'Yes. If you need more than what the Enterprise tier offers, contact us to discuss custom pricing and SLAs. (interpolated: SITE.emails.support)',
    match: 'path',
    evidence: [COMMERCIAL_POLICY],
  },
  {
    file: 'pricing-faq.ts',
    exportPath: 'PRICING_FAQS[9].answer',
    text: 'RevFleet is the RevealUI Studio product family: seven products that compose around the RevealUI runtime. RevealUI is the agentic business runtime. RevVault encrypts secrets (CLI MIT, desktop Pro). RevDev is the engineering harness for multi-agent coordination across Claude, Cursor, and Copilot (Studio + Console MIT, Daemon Fair Source). RevCon syncs editor configs (MIT). RevSkills is the Claude Code skills library (MIT). RevForge is the operator-side stamping tool that produces white-label trial kits (operator-only). RevMarket is the agent tool marketplace (bundled with the runtime, on the way). Use RevealUI standalone, or compose what you need.',
    evidence: [
      REVVAULT_REPO,
      REVDEV_REPO,
      REVCON_REPO,
      REVSKILLS_REPO,
      REVFORGE_REF,
      ROADMAP,
      REPO,
    ],
  },
  {
    file: 'pricing-faq.ts',
    exportPath: 'PRICING_FAQ_SECTION.heading',
    text: 'Frequently Asked Questions',
    evidence: [
      {
        kind: 'url',
        ref: 'https://revealui.com/pricing',
        note: 'section framing only; individual FAQ answers below carry the claims',
      },
    ],
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
