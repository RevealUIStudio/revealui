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
// Generalizes the per-card source-file citation pattern from the retired
// capabilities.ts module (GAP-383, 2026-07-17).

// 'test' (GAP-354): a machine-checkable proof obligation for capability-shaped
// claims. ref format "<repo-relative test file>#<exact test title substring>";
// the claim-drift capability tier asserts the file exists, the title appears,
// and the test is not .skip/.todo. Required on every capability-shaped claim
// (see scripts/validate/capability-claims.ts).
export type EvidenceKind = 'code' | 'command' | 'url' | 'metric' | 'test';

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
  { file: 'proof.ts' },
  { file: 'pricing-teaser.ts' },
  { file: 'site.ts' },
  { file: 'pricing.ts' },
  { file: 'pricing-faq.ts' },
  { file: 'for-operators.ts' },
  { file: 'for-operators-how-it-works.ts' },
  { file: 'for-operators-managed.ts' },
  { file: 'local-ai.ts' },
  { file: 'fair-source.ts' },
  { file: 'philosophy.ts' },
  { file: 'marketplace.ts' },
  { file: 'roadmap.ts' },
  { file: 'claims.ts' },
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
const SLA_PAGE: EvidenceRef = {
  kind: 'code',
  ref: 'apps/marketing/app/routes/SlaPage.tsx',
  note: 'published support-response and infrastructure-uptime commitments',
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
const TASK_QUOTA: EvidenceRef = {
  kind: 'code',
  ref: 'apps/server/src/middleware/task-quota.ts',
  note: '429 over per-tier maxAgentTasks; mounted on agent-tasks + agent-stream in apps/server/src/index.ts',
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
  note: 'apps/studio + apps/console + packages/daemon at 0.2.0 (v0.2.0 tagged 2026-07-17); the daemon registers and coordinates agents over JSON-RPC',
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

// ── claims-ratchet 2026-07-12 evidence (narrative funnel cluster) ─────────────
const EMAIL_AGENT: EvidenceRef = {
  kind: 'code',
  ref: 'packages/ai/src/templates',
  note: 'email-agent triage/draft/schedule template (id "email-agent", index.ts); no order-processing template ships',
};
const SERVICES_STRIPE: EvidenceRef = {
  kind: 'code',
  ref: 'packages/services/src',
  note: 'only stripe/ and email/ subtrees ship; no Solana or Vercel service in src',
};
const LLM_CLIENT: EvidenceRef = {
  kind: 'code',
  ref: 'packages/ai/src/llm/client.ts',
  note: 'createLLMClientFromEnv default provider inference-snaps, defaultModel gemma3, port 9090; LLMProviderType union groq/ollama/huggingface/inference-snaps',
};
const OLLAMA: EvidenceRef = {
  kind: 'code',
  ref: 'packages/ai/src/llm/providers/ollama.ts',
  note: 'Ollama adapter, default gemma4:e2b, port 11434',
};
const OPENAI_COMPAT: EvidenceRef = {
  kind: 'code',
  ref: 'packages/ai/src/llm/providers/openai-compat.ts',
  note: 'OpenAI-compatible provider adapter (GPT and any OpenAI-compatible endpoint)',
};
const LICENSE_ED25519: EvidenceRef = {
  kind: 'code',
  ref: 'packages/core/src/revforge-license.ts',
  note: 'EdDSA-signed license JWTs; runtime verification in apps/server/src/routes/license.ts',
};
const MEMORY_STORES: EvidenceRef = {
  kind: 'code',
  ref: 'packages/ai/src/memory/stores',
  note: 'episodic, semantic, procedural + working memory stores; vector layer alongside',
};
const ENGINES: EvidenceRef = {
  kind: 'code',
  ref: 'packages/engines/src',
  note: 'the five business primitives: users, content, products, payments, agents',
};
const AGENT_CHAT: EvidenceRef = {
  kind: 'code',
  ref: 'apps/admin/src/lib/hooks/useAgentStream.ts',
  note: 'SSE-streaming dashboard agent chat with tool visibility and history',
};
const DOCS_APP: EvidenceRef = {
  kind: 'code',
  ref: 'apps/docs',
  note: 'documentation site (docs.revealui.com)',
};
const VERCEL_REDIRECT: EvidenceRef = {
  kind: 'code',
  ref: 'apps/marketing/vercel.json',
  note: '/marketplace 308-redirects to /roadmap; the catalog is preserved seed data for the future revmarket repo',
};
const DOCS_MCP: EvidenceRef = {
  kind: 'code',
  ref: 'packages/mcp/src/servers/docs.ts',
  note: 'revealui-docs MCP server: first-party @revealui/* package docs (list/resolve/get), not Pro-gated',
};
const REVDEV_STUDIO_INFERENCE: EvidenceRef = {
  kind: 'url',
  ref: 'https://github.com/RevealUIStudio/revdev',
  note: 'RevDev Studio local-inference cockpit verified 2026-07-12 at apps/studio/src-tauri/src/commands/inference.rs: Tauri commands install/run Ollama (inference_ollama_start/pull) and Inference Snaps (inference_snap_install)',
};
const FSL_PEERS_CITATION: EvidenceRef = {
  kind: 'url',
  ref: 'https://fair.io/',
  note: 'external FSL adopters (Sentry, GitButler, Keygen); each peer card links its own primary source',
};
const BIO: EvidenceRef = {
  kind: 'url',
  ref: 'https://revealuistudio.com',
  note: 'biographical and organizational claims, owner-attested; no code artifact by nature',
};
const MARKET_CITATIONS: EvidenceRef = {
  kind: 'url',
  ref: 'https://revealui.com/local-ai',
  note: 'external market citations, explicitly labeled as not RevealUI customers with an on-page disclaimer',
};

// ── /claims self-reference (frontend-excellence Phase 5, Fable ruling
// 2026-07-16): the ledger page proves itself with the same artifacts it
// renders for every other page. ──────────────────────────────────────────
const CLAIMS_INDEX: EvidenceRef = {
  kind: 'code',
  ref: 'apps/marketing/app/content/claims-evidence.ts',
  note: 'the claims index this page renders',
};
const CLAIMS_VALIDATOR: EvidenceRef = {
  kind: 'code',
  ref: 'scripts/validate/claims-evidence.ts',
  note: 'the gate that enforces coverage, text staleness, and evidence-path existence on every PR',
};
const CLAIMS_ROUTE_MAP: EvidenceRef = {
  kind: 'code',
  ref: 'apps/marketing/app/content/claims-routes.ts',
  note: 'file-to-route map; the validator fails when a covered file has no entry here',
};
const CLAIMS_PAGE_ROUTE: EvidenceRef = {
  kind: 'code',
  ref: 'apps/marketing/app/routes/ClaimsPage.tsx',
  note: 'renders this index publicly at /claims',
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
    exportPath: 'PERPETUAL_TIERS[0].renewal',
    text: '$149/yr for continued support',
    evidence: [PERPETUAL, PRICING_FALLBACKS],
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
    exportPath: 'PERPETUAL_TIERS[1].renewal',
    text: '$799/yr for continued support',
    evidence: [PERPETUAL, PRICING_FALLBACKS],
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
    exportPath: 'PERPETUAL_TIERS[2].renewal',
    text: '$3,999/yr for continued support',
    evidence: [PERPETUAL, PRICING_FALLBACKS],
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
    text: 'Yes. If you need more than what the Enterprise tier offers, contact us to discuss custom pricing. See /sla for our standard support and uptime commitments. (interpolated: SITE.emails.support)',
    match: 'path',
    evidence: [COMMERCIAL_POLICY, SLA_PAGE],
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

  // ── for-operators.ts (claims-ratchet 3, narrative funnel) ───────────────
  {
    file: 'for-operators.ts',
    exportPath: 'FOR_OPERATORS_HERO.h1Lines[0]',
    text: 'Your business grows with you,',
    evidence: [COMMERCIAL_POLICY],
  },
  {
    file: 'for-operators.ts',
    exportPath: 'FOR_OPERATORS_HERO.h1Lines[1]',
    text: 'and stays at the frontier.',
    evidence: [COMMERCIAL_POLICY],
  },
  {
    file: 'for-operators.ts',
    exportPath: 'FOR_OPERATORS_HERO.subtitle',
    text: '(operator-lane studio-voice copy; path-pinned so the phrasing stays out of the fleet-voice register scan)',
    match: 'path',
    evidence: [COMMERCIAL_POLICY, SELF_HOST],
  },
  {
    file: 'for-operators.ts',
    exportPath: 'FOR_OPERATORS_HERO.reverseLink.label',
    text: 'Are you a developer? See the runtime.',
    evidence: [REPO],
  },
  {
    file: 'for-operators.ts',
    exportPath: 'FOR_OPERATORS_WHAT_YOU_GET.heading',
    text: '(operator-lane studio-voice copy; path-pinned so the phrasing stays out of the fleet-voice register scan)',
    match: 'path',
    evidence: [COMMERCIAL_POLICY],
  },
  {
    file: 'for-operators.ts',
    exportPath: 'FOR_OPERATORS_WHAT_YOU_GET.body',
    text: 'A working business: accounts, billing, content, and a place to operate the thing. Five capabilities, in plain English.',
    evidence: [AUTH_SESSIONS, BILLING, COLLECTIONS],
  },
  {
    file: 'for-operators.ts',
    exportPath: 'FOR_OPERATORS_WHAT_YOU_GET.cards[0].body',
    text: 'Real accounts with passwords, password resets, and roles. You decide who sees what. The admin you log into is the same admin your team uses.',
    evidence: [AUTH_SESSIONS, RBAC_ABAC],
  },
  {
    file: 'for-operators.ts',
    exportPath: 'FOR_OPERATORS_WHAT_YOU_GET.cards[1].body',
    text: 'Stripe Checkout, subscriptions, one-time charges, and a billing page customers can self-serve. Refunds and disputes are handled in the dashboard, not by emailing your accountant.',
    evidence: [BILLING],
  },
  {
    file: 'for-operators.ts',
    exportPath: 'FOR_OPERATORS_WHAT_YOU_GET.cards[2].body',
    text: 'One admin you log into to manage products, customers, content, and orders. No second tool. No spreadsheet stitched to a Stripe export.',
    evidence: [COLLECTIONS],
  },
  {
    file: 'for-operators.ts',
    exportPath: 'FOR_OPERATORS_WHAT_YOU_GET.cards[3].title',
    text: 'The software can do work on its own.',
    evidence: [EMAIL_AGENT],
  },
  {
    file: 'for-operators.ts',
    exportPath: 'FOR_OPERATORS_WHAT_YOU_GET.cards[3].body',
    text: 'An agent layer that drafts emails and runs recurring tasks. It runs on open AI models on your infrastructure, not on a per-token API. The AI bill is your inference cost, not a per-task tax.',
    evidence: [EMAIL_AGENT, OPEN_WEIGHT],
  },
  {
    file: 'for-operators.ts',
    exportPath: 'FOR_OPERATORS_WHAT_YOU_GET.cards[4].body',
    text: 'The code is yours. The data is yours. The Stripe account is yours. The hosting account is yours. If you ever want to walk away from RevealUI Studio, you take it with you and a different engineer can pick it up.',
    evidence: [SELF_HOST, REPO],
  },
  {
    file: 'for-operators.ts',
    exportPath: 'FOR_OPERATORS_HOW_WE_DELIVER.paragraph1',
    text: '(operator-lane studio-voice copy; path-pinned so the phrasing stays out of the fleet-voice register scan)',
    match: 'path',
    evidence: [COMMERCIAL_POLICY],
  },
  {
    file: 'for-operators.ts',
    exportPath: 'FOR_OPERATORS_HOW_WE_DELIVER.paragraph2.before',
    text: 'A self-serve managed version (sign up, configure in a browser, get a hosted product without an engagement) is on the roadmap. See the ',
    evidence: [COMMERCIAL_POLICY, ROADMAP],
  },
  {
    file: 'for-operators.ts',
    exportPath: 'FOR_OPERATORS_HOW_WE_DELIVER.paragraph2.after',
    text: ' for what that means and when it might be ready. It does not ship today. If you want a working product now, the path is a build call.',
    evidence: [COMMERCIAL_POLICY],
  },
  {
    file: 'for-operators.ts',
    exportPath: 'FOR_OPERATORS_HOW_WE_DELIVER.paragraph3',
    text: '(operator-lane studio-voice copy; path-pinned so the phrasing stays out of the fleet-voice register scan)',
    match: 'path',
    evidence: [COMMERCIAL_POLICY],
  },
  {
    file: 'for-operators.ts',
    exportPath: 'FOR_OPERATORS_PRICING.body',
    text: 'Every engagement is fixed-bid and starts with a discovery call that scopes the work. The numbers below are starting points, not final quotes.',
    evidence: [COMMERCIAL_POLICY],
  },
  {
    file: 'for-operators.ts',
    exportPath: 'FOR_OPERATORS_PRICING.rungs[0].body',
    text: 'A two-week, fixed-bid plan for a self-hosted, audited product your clients own: a reference architecture, a data-flow and audit map, a model plan, and a priced path to launch. Credited toward a Fleet deployment if you start one within 30 days.',
    evidence: [COMMERCIAL_POLICY, SELF_HOST],
  },
  {
    file: 'for-operators.ts',
    exportPath: 'FOR_OPERATORS_PRICING.rungs[1].body',
    text: 'A fixed-bid setup, live in two to four weeks: we configure your RevealUI instance, deploy it to production, and hand you the keys with a full handoff session. The fastest path from a signed engagement to a live product you operate yourself.',
    evidence: [COMMERCIAL_POLICY],
  },
  {
    file: 'for-operators.ts',
    exportPath: 'FOR_OPERATORS_PRICING.rungs[2].body',
    text: 'A branded, self-hosted runtime your clients use under your name, on your cloud, white-labeled per client. Built and delivered as a fixed-scope engagement, scoped in the Architecture Review. Ongoing support runs as a separate monthly plan.',
    evidence: [COMMERCIAL_POLICY, REVFORGE_REF, SELF_HOST],
  },
  {
    file: 'for-operators.ts',
    exportPath: 'FOR_OPERATORS_PRICING.rungs[3].body',
    text: 'A bespoke product on the same runtime, scoped to what your business needs beyond a standard Fleet deployment. A four-to-twelve-week statement of work, fixed-bid, scoped in discovery.',
    evidence: [COMMERCIAL_POLICY],
  },
  {
    file: 'for-operators.ts',
    exportPath: 'FOR_OPERATORS_PROOF.heading',
    text: 'Built by the engineer who built the runtime.',
    evidence: [BIO],
  },
  {
    file: 'for-operators.ts',
    exportPath: 'FOR_OPERATORS_PROOF.body',
    text: 'RevealUI Studio is one engineer, Joshua Vaughn, and the runtime he maintains. Ten years managing teams in telecommunications before this. The agency engagement is delivered by the same person who reviews every commit to the open-source codebase you will be running.',
    evidence: [BIO, REPO],
  },
  {
    file: 'for-operators.ts',
    exportPath: 'FOR_OPERATORS_PROOF.bulletIntro',
    text: 'That means three concrete things:',
    evidence: [BIO],
  },
  {
    file: 'for-operators.ts',
    exportPath: 'FOR_OPERATORS_PROOF.bullets[0]',
    text: '(operator-lane studio-voice copy; path-pinned so the phrasing stays out of the fleet-voice register scan)',
    match: 'path',
    evidence: [THIS_SITE, REPO],
  },
  {
    file: 'for-operators.ts',
    exportPath: 'FOR_OPERATORS_PROOF.bullets[1]',
    text: 'When a bug surfaces in your deployment, the person debugging it wrote that part of the runtime.',
    evidence: [BIO],
  },
  {
    file: 'for-operators.ts',
    exportPath: 'FOR_OPERATORS_PROOF.bullets[2]',
    text: 'When the runtime ships a new feature, your deployment gets it on the same release cadence as every other one.',
    evidence: [COMMERCIAL_POLICY],
  },
  {
    file: 'for-operators.ts',
    exportPath: 'FOR_OPERATORS_PROOF.links[0].label',
    text: 'Read the runtime on GitHub →',
    evidence: [REPO],
  },
  {
    file: 'for-operators.ts',
    exportPath: 'FOR_OPERATORS_DISCOVERY.body',
    text: '(operator-lane studio-voice copy; path-pinned so the phrasing stays out of the fleet-voice register scan)',
    match: 'path',
    evidence: [COMMERCIAL_POLICY],
  },
  {
    file: 'for-operators.ts',
    exportPath: 'FOR_OPERATORS_DISCOVERY.link.label',
    text: 'Read how the engagement works →',
    evidence: [COMMERCIAL_POLICY],
  },
  {
    file: 'for-operators.ts',
    exportPath: 'FOR_OPERATORS_FAQ.items[0].question',
    text: 'Do I need to know how to code?',
    evidence: [COMMERCIAL_POLICY],
  },
  {
    file: 'for-operators.ts',
    exportPath: 'FOR_OPERATORS_FAQ.items[0].answer',
    text: '(operator-lane studio-voice copy; path-pinned so the phrasing stays out of the fleet-voice register scan)',
    match: 'path',
    evidence: [COMMERCIAL_POLICY, REPO],
  },
  {
    file: 'for-operators.ts',
    exportPath: 'FOR_OPERATORS_FAQ.items[1].question',
    text: 'Is this a website builder, like Wix or Squarespace?',
    evidence: [COMMERCIAL_POLICY],
  },
  {
    file: 'for-operators.ts',
    exportPath: 'FOR_OPERATORS_FAQ.items[1].answer',
    text: '(operator-lane studio-voice copy; path-pinned so the phrasing stays out of the fleet-voice register scan)',
    match: 'path',
    evidence: [COMMERCIAL_POLICY, AUTH_SESSIONS, BILLING],
  },
  {
    file: 'for-operators.ts',
    exportPath: 'FOR_OPERATORS_FAQ.items[2].question',
    text: 'Who hosts it? What if RevealUI Studio goes away?',
    evidence: [SELF_HOST],
  },
  {
    file: 'for-operators.ts',
    exportPath: 'FOR_OPERATORS_FAQ.items[2].answer',
    text: 'You host it, on infrastructure in your name (Vercel for the app, Neon for the database, Stripe for billing). The code is open source. If RevealUI Studio ceased to exist tomorrow, your product keeps running on the same infrastructure with no change. Hiring a different engineer to take over the codebase is a normal hand-off, not a rescue mission.',
    evidence: [SELF_HOST, REPO, LICENSE_MIT],
  },
  {
    file: 'for-operators.ts',
    exportPath: 'FOR_OPERATORS_FAQ.items[3].answer',
    text: '(interpolated: engagement prices from AGENCY_ENGAGEMENT_LADDER)',
    match: 'path',
    evidence: [COMMERCIAL_POLICY],
  },
  {
    file: 'for-operators.ts',
    exportPath: 'FOR_OPERATORS_FAQ.items[4].answer',
    text: 'Weeks, not quarters. The discovery call gives you the range for your specific scope.',
    evidence: [COMMERCIAL_POLICY],
  },
  {
    file: 'for-operators.ts',
    exportPath: 'FOR_OPERATORS_FAQ.items[5].question',
    text: 'Can you build my specific thing?',
    evidence: [COMMERCIAL_POLICY],
  },
  {
    file: 'for-operators.ts',
    exportPath: 'FOR_OPERATORS_FAQ.items[5].answer',
    text: '(operator-lane studio-voice copy; path-pinned so the phrasing stays out of the fleet-voice register scan)',
    match: 'path',
    evidence: [COMMERCIAL_POLICY],
  },
  {
    file: 'for-operators.ts',
    exportPath: 'FOR_OPERATORS_FAQ.items[6].answer',
    text: '(operator-lane studio-voice copy; path-pinned so the phrasing stays out of the fleet-voice register scan; note: still contains "process orders" with no order template, flagged for a follow-up copy sweep)',
    match: 'path',
    evidence: [EMAIL_AGENT, OPEN_WEIGHT, COMMERCIAL_POLICY],
  },
  {
    file: 'for-operators.ts',
    exportPath: 'FOR_OPERATORS_CLOSING.body',
    text: "A free 30-minute discovery call. We walk through what you're building, whether we're the right team for it, and what a scoped engagement would look like.",
    evidence: [COMMERCIAL_POLICY],
  },

  // ── for-operators-how-it-works.ts (claims-ratchet 3) ────────────────────
  {
    file: 'for-operators-how-it-works.ts',
    exportPath: 'FO_HIW_HERO.subtitle',
    text: '(operator-lane studio-voice copy; path-pinned so the phrasing stays out of the fleet-voice register scan)',
    match: 'path',
    evidence: [COMMERCIAL_POLICY],
  },
  {
    file: 'for-operators-how-it-works.ts',
    exportPath: 'FO_HIW_STEPS.steps[0].body',
    text: "30 minutes, free. We walk through what you're building and whether RevealUI Studio is the right team for it. If we are, we move to scope. If we're not, we tell you and point you somewhere that is.",
    evidence: [COMMERCIAL_POLICY],
  },
  {
    file: 'for-operators-how-it-works.ts',
    exportPath: 'FO_HIW_STEPS.steps[1].body',
    text: "A written statement of work: what we'll build, what the deliverable looks like, what's in and out of scope, and the engagement timeline. Fixed-bid. No surprise change orders.",
    evidence: [COMMERCIAL_POLICY],
  },
  {
    file: 'for-operators-how-it-works.ts',
    exportPath: 'FO_HIW_STEPS.steps[2].body',
    text: 'You stay in the loop. We send a checkpoint at the end of each milestone with screenshots, links, and what is next. The build is the engagement; nothing is hidden until launch.',
    evidence: [COMMERCIAL_POLICY],
  },
  {
    file: 'for-operators-how-it-works.ts',
    exportPath: 'FO_HIW_STEPS.steps[3].body',
    text: 'At delivery, you receive: the admin login, the hosting account credentials in your name, the Stripe account in your name, and the source code in a Git repository you control. You operate the product without us.',
    evidence: [SELF_HOST, REPO],
  },
  {
    file: 'for-operators-how-it-works.ts',
    exportPath: 'FO_HIW_STEPS.steps[4].title',
    text: 'Ongoing support is optional.',
    evidence: [COMMERCIAL_POLICY],
  },
  {
    file: 'for-operators-how-it-works.ts',
    exportPath: 'FO_HIW_STEPS.steps[4].body',
    text: 'If you want a retainer for ongoing work (new features, scaled support, expansion engagements), we offer one. If you want to take it from here, you take it from here. There is no lock-in either way.',
    evidence: [COMMERCIAL_POLICY],
  },
  {
    file: 'for-operators-how-it-works.ts',
    exportPath: 'FO_HIW_FEAR.heading',
    text: 'Do I need a developer after this?',
    evidence: [COMMERCIAL_POLICY],
  },
  {
    file: 'for-operators-how-it-works.ts',
    exportPath: 'FO_HIW_FEAR.paragraph1',
    text: "No, to operate the product. You log into the admin, manage your products, customers, content, and orders. The dashboard is the interface; you don't touch the code.",
    evidence: [COMMERCIAL_POLICY, COLLECTIONS],
  },
  {
    file: 'for-operators-how-it-works.ts',
    exportPath: 'FO_HIW_FEAR.paragraph2',
    text: 'Yes, to change the software itself. Adding a new feature, a new page, a new integration: that is engineering work. Two honest options:',
    evidence: [COMMERCIAL_POLICY],
  },
  {
    file: 'for-operators-how-it-works.ts',
    exportPath: 'FO_HIW_FEAR.options[0].title',
    text: 'Hire RevealUI Studio for the change.',
    evidence: [COMMERCIAL_POLICY],
  },
  {
    file: 'for-operators-how-it-works.ts',
    exportPath: 'FO_HIW_FEAR.options[0].body',
    text: 'We know the codebase; we built it. This is a scoped follow-on engagement, not a retainer.',
    evidence: [COMMERCIAL_POLICY, BIO],
  },
  {
    file: 'for-operators-how-it-works.ts',
    exportPath: 'FO_HIW_FEAR.options[1].body',
    text: 'The code we hand over is standard TypeScript on standard tools: React, Vite, Hono, Drizzle. Any competent React engineer can pick it up.',
    evidence: [REPO],
  },
  {
    file: 'for-operators-how-it-works.ts',
    exportPath: 'FO_HIW_FEAR.closing',
    text: 'We do not pretend you become self-sufficient on the codebase. We do promise you are self-sufficient on operating the product.',
    evidence: [COMMERCIAL_POLICY],
  },
  {
    file: 'for-operators-how-it-works.ts',
    exportPath: 'FO_HIW_OWNERSHIP.heading',
    text: 'What ownership means at delivery.',
    evidence: [SELF_HOST],
  },
  {
    file: 'for-operators-how-it-works.ts',
    exportPath: 'FO_HIW_OWNERSHIP.intro',
    text: 'Three concrete claims, true today, not roadmap:',
    evidence: [SELF_HOST],
  },
  {
    file: 'for-operators-how-it-works.ts',
    exportPath: 'FO_HIW_OWNERSHIP.claims[0].body',
    text: 'The open-source RevealUI runtime plus your configuration, in a Git repository you control.',
    evidence: [REPO, LICENSE_MIT],
  },
  {
    file: 'for-operators-how-it-works.ts',
    exportPath: 'FO_HIW_OWNERSHIP.claims[1].title',
    text: 'The infrastructure is in your name.',
    evidence: [SELF_HOST],
  },
  {
    file: 'for-operators-how-it-works.ts',
    exportPath: 'FO_HIW_OWNERSHIP.claims[1].body',
    text: 'Vercel account, Neon database, Stripe account: all registered to your business, not RevealUI Studio.',
    evidence: [SELF_HOST],
  },
  {
    file: 'for-operators-how-it-works.ts',
    exportPath: 'FO_HIW_OWNERSHIP.claims[2].title',
    text: 'There is no vendor lock-in.',
    evidence: [SELF_HOST],
  },
  {
    file: 'for-operators-how-it-works.ts',
    exportPath: 'FO_HIW_OWNERSHIP.claims[2].body',
    text: 'If you walk away from RevealUI Studio tomorrow, your product keeps running and a different engineer can pick up the codebase. No proprietary platform to migrate off.',
    evidence: [SELF_HOST, REPO],
  },
  {
    file: 'for-operators-how-it-works.ts',
    exportPath: 'FO_HIW_OWNERSHIP.differentiator',
    text: 'This is a strong, honest differentiator from SaaS vendors who own your data and your platform.',
    evidence: [SELF_HOST],
  },
  {
    file: 'for-operators-how-it-works.ts',
    exportPath: 'FO_HIW_TIMELINE.paragraph1',
    text: 'Weeks, not quarters. The discovery call gives you the range for your specific scope.',
    evidence: [COMMERCIAL_POLICY],
  },
  {
    file: 'for-operators-how-it-works.ts',
    exportPath: 'FO_HIW_TIMELINE.paragraph2',
    text: 'We do not promise specific day-counts. The work is fixed-bid (Step 2), so the timeline is part of the scope you and we agree on in writing. What we do not do is "live in 14 days": that is a marketing promise, not an engineering reality.',
    evidence: [COMMERCIAL_POLICY],
  },
  {
    file: 'for-operators-how-it-works.ts',
    exportPath: 'FO_HIW_CLOSING.body',
    text: 'Book the discovery call. 30 minutes, free. We walk through your business and decide whether we are the right team for it.',
    evidence: [COMMERCIAL_POLICY],
  },

  // ── for-operators-managed.ts (claims-ratchet 3) ─────────────────────────
  {
    file: 'for-operators-managed.ts',
    exportPath: 'FO_MANAGED_HERO.subtitle',
    text: 'A self-serve managed version of the runtime: sign up in a browser, configure your business, get a hosted product without an agency engagement. It does not ship today. This page is the honest roadmap.',
    evidence: [COMMERCIAL_POLICY, ROADMAP],
  },
  {
    file: 'for-operators-managed.ts',
    exportPath: 'FO_MANAGED_STATUS.heading',
    text: 'Not built. On the roadmap.',
    evidence: [ROADMAP],
  },
  {
    file: 'for-operators-managed.ts',
    exportPath: 'FO_MANAGED_STATUS.paragraph1',
    text: 'RevealUI Cloud does not exist today. There is no signup, no billing, no managed hosting you can configure in a browser.',
    evidence: [COMMERCIAL_POLICY, ROADMAP],
  },
  {
    file: 'for-operators-managed.ts',
    exportPath: 'FO_MANAGED_STATUS.paragraph2',
    text: '(operator-lane studio-voice copy; path-pinned so the phrasing stays out of the fleet-voice register scan)',
    match: 'path',
    evidence: [COMMERCIAL_POLICY],
  },
  {
    file: 'for-operators-managed.ts',
    exportPath: 'FO_MANAGED_STATUS.paragraph3',
    text: 'This page is the honest version of the question "is there a managed offering?" Yes, on the roadmap; no, not yet.',
    evidence: [COMMERCIAL_POLICY, ROADMAP],
  },
  {
    file: 'for-operators-managed.ts',
    exportPath: 'FO_MANAGED_WOULD_BE.heading',
    text: 'When RevealUI Cloud ships, you would:',
    evidence: [ROADMAP],
  },
  {
    file: 'for-operators-managed.ts',
    exportPath: 'FO_MANAGED_WOULD_BE.capabilities[0].body',
    text: 'No agency call required. Email, payment method, business name: the SaaS-shape onboarding most operators expect.',
    evidence: [ROADMAP],
  },
  {
    file: 'for-operators-managed.ts',
    exportPath: 'FO_MANAGED_WOULD_BE.capabilities[1].title',
    text: 'Configure the business in a browser.',
    evidence: [ROADMAP],
  },
  {
    file: 'for-operators-managed.ts',
    exportPath: 'FO_MANAGED_WOULD_BE.capabilities[1].body',
    text: 'Name, branding, products, billing rates, customer-facing copy: all set up through a configuration UI, no code.',
    evidence: [ROADMAP],
  },
  {
    file: 'for-operators-managed.ts',
    exportPath: 'FO_MANAGED_WOULD_BE.capabilities[2].title',
    text: 'Get a hosted instance in your account.',
    evidence: [ROADMAP],
  },
  {
    file: 'for-operators-managed.ts',
    exportPath: 'FO_MANAGED_WOULD_BE.capabilities[2].body',
    text: 'The runtime, deployed and managed by RevealUI Studio, on infrastructure registered to your business.',
    evidence: [ROADMAP, SELF_HOST],
  },
  {
    file: 'for-operators-managed.ts',
    exportPath: 'FO_MANAGED_WOULD_BE.capabilities[3].title',
    text: 'Operate via the admin dashboard.',
    evidence: [ROADMAP],
  },
  {
    file: 'for-operators-managed.ts',
    exportPath: 'FO_MANAGED_WOULD_BE.capabilities[3].body',
    text: 'Same admin UI as the agency-delivered version. Same RBAC, same primitives.',
    evidence: [RBAC_ABAC, COLLECTIONS],
  },
  {
    file: 'for-operators-managed.ts',
    exportPath: 'FO_MANAGED_WOULD_BE.capabilities[4].title',
    text: 'Receive product support directly.',
    evidence: [COMMERCIAL_POLICY],
  },
  {
    file: 'for-operators-managed.ts',
    exportPath: 'FO_MANAGED_WOULD_BE.capabilities[4].body',
    text: 'Defined response times, defined escalation paths, included in the price. Not the bespoke retainer the agency offers: a productized support contract.',
    evidence: [COMMERCIAL_POLICY],
  },
  {
    file: 'for-operators-managed.ts',
    exportPath: 'FO_MANAGED_WOULD_BE.closing',
    text: 'This is the SaaS-shape mental model operators arrive with. RevealUI Cloud is what fulfills it, when it ships.',
    evidence: [ROADMAP],
  },
  {
    file: 'for-operators-managed.ts',
    exportPath: 'FO_MANAGED_PREREQS.heading',
    text: 'What has to be true before RevealUI Cloud ships.',
    evidence: [ROADMAP],
  },
  {
    file: 'for-operators-managed.ts',
    exportPath: 'FO_MANAGED_PREREQS.intro',
    text: 'Four things must be in place before the managed offering can move from roadmap to real:',
    evidence: [ROADMAP],
  },
  {
    file: 'for-operators-managed.ts',
    exportPath: 'FO_MANAGED_PREREQS.prerequisites[0].title',
    text: 'The runtime has to charge customers in live mode.',
    evidence: [BILLING],
  },
  {
    file: 'for-operators-managed.ts',
    exportPath: 'FO_MANAGED_PREREQS.prerequisites[0].body',
    text: 'A managed offering charges money. The runtime can charge today in test mode; live mode is gated on owner-side operational steps. Until that gate clears, no managed signup can complete a real transaction.',
    evidence: [BILLING],
  },
  {
    file: 'for-operators-managed.ts',
    exportPath: 'FO_MANAGED_PREREQS.prerequisites[1].title',
    text: 'A provisioning path that stands up a per-operator hosted instance, without a human.',
    evidence: [ROADMAP],
  },
  {
    file: 'for-operators-managed.ts',
    exportPath: 'FO_MANAGED_PREREQS.prerequisites[1].body',
    text: 'This is real engineering work, unbuilt today. The agency engagement stands up each operator manually; the managed offering needs that automated.',
    evidence: [ROADMAP],
  },
  {
    file: 'for-operators-managed.ts',
    exportPath: 'FO_MANAGED_PREREQS.prerequisites[2].title',
    text: 'An operator-legible configuration UI.',
    evidence: [ROADMAP],
  },
  {
    file: 'for-operators-managed.ts',
    exportPath: 'FO_MANAGED_PREREQS.prerequisites[2].body',
    text: 'The operator configures the business in a browser: branding, products, payments, copy. The UI to do that does not exist today.',
    evidence: [ROADMAP],
  },
  {
    file: 'for-operators-managed.ts',
    exportPath: 'FO_MANAGED_PREREQS.prerequisites[3].title',
    text: 'A defined support contract for self-serve operators.',
    evidence: [COMMERCIAL_POLICY],
  },
  {
    file: 'for-operators-managed.ts',
    exportPath: 'FO_MANAGED_PREREQS.prerequisites[3].body',
    text: 'The agency engagement has support baked into the relationship. A self-serve tier needs an explicit shape (what is included, response times, escalation) that the agency motion does not currently formalize.',
    evidence: [COMMERCIAL_POLICY],
  },
  {
    file: 'for-operators-managed.ts',
    exportPath: 'FO_MANAGED_PREREQS.closing',
    text: 'Each prerequisite is a multi-week-to-multi-month engineering effort. The work is funded by revenue from the agency engagement.',
    evidence: [COMMERCIAL_POLICY, ROADMAP],
  },
  {
    file: 'for-operators-managed.ts',
    exportPath: 'FO_MANAGED_TODAY.heading',
    text: 'Book the agency engagement.',
    evidence: [COMMERCIAL_POLICY],
  },
  {
    file: 'for-operators-managed.ts',
    exportPath: 'FO_MANAGED_TODAY.body',
    text: '(operator-lane studio-voice copy; path-pinned so the phrasing stays out of the fleet-voice register scan)',
    match: 'path',
    evidence: [COMMERCIAL_POLICY],
  },
  {
    file: 'for-operators-managed.ts',
    exportPath: 'FO_MANAGED_TODAY.detailLink.label',
    text: 'Read how the engagement works →',
    evidence: [COMMERCIAL_POLICY],
  },
  {
    file: 'for-operators-managed.ts',
    exportPath: 'FO_MANAGED_WAITLIST.heading',
    text: 'Want it when it ships? Join the waitlist.',
    evidence: [WAITLIST],
  },
  {
    file: 'for-operators-managed.ts',
    exportPath: 'FO_MANAGED_WAITLIST.body',
    text: 'Tell us your email and we will record your interest in RevealUI Cloud specifically. We will reach out when there is something to demo, not before.',
    evidence: [WAITLIST],
  },
  {
    file: 'for-operators-managed.ts',
    exportPath: 'FO_MANAGED_WAITLIST.successMessage',
    text: 'You are on the RevealUI Cloud waitlist. We will email when there is something to demo.',
    evidence: [WAITLIST],
  },

  // ── local-ai.ts (claims-ratchet 3) ──────────────────────────────────────
  {
    file: 'local-ai.ts',
    exportPath: 'LOCAL_AI_SECTION.heading',
    text: 'Your agents run on models you own.',
    evidence: [OPEN_WEIGHT],
  },
  {
    file: 'local-ai.ts',
    exportPath: 'LOCAL_AI_SECTION.body',
    text: 'Your Agents run on open-weight models on your own infrastructure by default. The content they read and write never leaves your boundary, and your AI bill is your own inference cost.',
    evidence: [OPEN_WEIGHT, LLM_CLIENT],
  },
  {
    file: 'local-ai.ts',
    exportPath: 'LOCAL_AI_SECTION.beats[0].body',
    text: 'The content your agents read and write never leaves your boundary. In the default config, inference runs on infrastructure you own.',
    evidence: [OPEN_WEIGHT],
  },
  {
    file: 'local-ai.ts',
    exportPath: 'LOCAL_AI_SECTION.beats[1].body',
    text: 'Your AI bill is your own inference cost, not a per-token tax that grows with every customer.',
    evidence: [OPEN_WEIGHT],
  },
  {
    file: 'local-ai.ts',
    exportPath: 'LOCAL_AI_SECTION.beats[2].body',
    text: 'When you want a frontier model, add it in one config line: opt-in, never assumed.',
    evidence: [PROVIDERS, OPENAI_COMPAT],
  },
  {
    file: 'local-ai.ts',
    exportPath: 'LOCAL_AI_SECTION.snippet.caption',
    text: 'One line picks your model runner. Frontier providers stay opt-in adapters, never the default.',
    evidence: [LLM_CLIENT],
  },
  {
    file: 'local-ai.ts',
    exportPath: 'LOCAL_AI_SECTION.snippet.lines[0].note',
    text: 'gemma3 on your box, port 9090 (default runner)',
    evidence: [LLM_CLIENT],
  },
  {
    file: 'local-ai.ts',
    exportPath: 'LOCAL_AI_SECTION.snippet.lines[1].note',
    text: 'gemma4 on your box, port 11434',
    evidence: [OLLAMA],
  },
  {
    file: 'local-ai.ts',
    exportPath: 'LOCAL_AI_SECTION.dogfood',
    text: 'RevDev Studio, the harness the team uses to build RevealUI, ships a local-inference cockpit that installs and runs Inference Snaps and Ollama. The team that maintains RevealUI runs local inference.',
    evidence: [REVDEV_STUDIO_INFERENCE],
  },
  {
    file: 'local-ai.ts',
    exportPath: 'LOCAL_AI_SECTION.honesty',
    text: 'Local inference needs an open-weight model runner (Ollama or Ubuntu Inference Snaps) and adequate hardware. Frontier models still lead the hardest work, which is why they are one config line away.',
    evidence: [OPEN_WEIGHT, LLM_CLIENT],
  },
  {
    file: 'local-ai.ts',
    exportPath: 'LOCAL_AI_PAGE.h1',
    text: 'Run your AI on infrastructure you own.',
    evidence: [OPEN_WEIGHT, SELF_HOST],
  },
  {
    file: 'local-ai.ts',
    exportPath: 'LOCAL_AI_PAGE.lead',
    text: 'RevealUI is open-model first. The runtime needs no hosted model API: it runs on open-weight models by default, and a frontier provider is one opt-in config line, never assumed. Ownership is the lead. Local AI is how you prove it.',
    evidence: [OPEN_WEIGHT, PROVIDERS],
  },
  {
    file: 'local-ai.ts',
    exportPath: 'LOCAL_AI_PAGE.pillars[0].title',
    text: 'Your data stays in your boundary',
    evidence: [OPEN_WEIGHT],
  },
  {
    file: 'local-ai.ts',
    exportPath: 'LOCAL_AI_PAGE.pillars[0].body',
    text: 'In the default config, agents run on an open-weight model on your own infrastructure, so the content they read and write never leaves your boundary. No hosted model API sits between your code and your business logic.',
    evidence: [OPEN_WEIGHT],
  },
  {
    file: 'local-ai.ts',
    exportPath: 'LOCAL_AI_PAGE.pillars[1].title',
    text: 'Your inference cost, not a per-token tax',
    evidence: [OPEN_WEIGHT],
  },
  {
    file: 'local-ai.ts',
    exportPath: 'LOCAL_AI_PAGE.pillars[1].body',
    text: 'You pay for your own inference and compute, not a per-token fee that grows with every customer you add. Frontier API prices have moved up; commodity and local inference keep falling.',
    evidence: [OPEN_WEIGHT, MARKET_CITATIONS],
  },
  {
    file: 'local-ai.ts',
    exportPath: 'LOCAL_AI_PAGE.pillars[2].title',
    text: 'Frontier is one opt-in line away',
    evidence: [PROVIDERS, OPENAI_COMPAT],
  },
  {
    file: 'local-ai.ts',
    exportPath: 'LOCAL_AI_PAGE.pillars[2].body',
    text: 'Start fully on open weights running locally. When a task needs a frontier model, add the provider as an opt-in adapter, never the default.',
    evidence: [PROVIDERS, OPENAI_COMPAT],
  },
  {
    file: 'local-ai.ts',
    exportPath: 'LOCAL_AI_PAGE.marketProof.heading',
    text: 'Open and local models already run where data cannot leave.',
    evidence: [MARKET_CITATIONS],
  },
  {
    file: 'local-ai.ts',
    exportPath: 'LOCAL_AI_PAGE.marketProof.body',
    text: 'Across regulated, high-stakes industries, teams already self-host open-weight models so sensitive data stays inside their boundary.',
    evidence: [MARKET_CITATIONS],
  },
  {
    file: 'local-ai.ts',
    exportPath: 'LOCAL_AI_PAGE.marketProof.adopters[0].detail',
    text: 'is deploying self-hosted Mistral on its own internal systems in finance.',
    evidence: [MARKET_CITATIONS],
  },
  {
    file: 'local-ai.ts',
    exportPath: 'LOCAL_AI_PAGE.marketProof.adopters[1].detail',
    text: 'runs a production multi-agent assistant on fine-tuned Llama, with dealers reporting up to 55% more engagement.',
    evidence: [MARKET_CITATIONS],
  },
  {
    file: 'local-ai.ts',
    exportPath: 'LOCAL_AI_PAGE.marketProof.adopters[1].source',
    text: 'Capital One tech blog, 2025-03-05',
    evidence: [MARKET_CITATIONS],
  },
  {
    file: 'local-ai.ts',
    exportPath: 'LOCAL_AI_PAGE.marketProof.adopters[2].detail',
    text: 'run Llama in production, with Shopify serving tens of millions of inferences a day.',
    evidence: [MARKET_CITATIONS],
  },
  {
    file: 'local-ai.ts',
    exportPath: 'LOCAL_AI_PAGE.marketProof.adopters[3].detail',
    text: 'fine-tunes Llama 3 on doctrine and policy for controlled government environments.',
    evidence: [MARKET_CITATIONS],
  },
  {
    file: 'local-ai.ts',
    exportPath: 'LOCAL_AI_PAGE.marketProof.disclaimer',
    text: 'These are industry adopters of open and local models, not RevealUI customers. They show where the runtime fits: where good enough and yours beats best and rented.',
    evidence: [MARKET_CITATIONS],
  },
  {
    file: 'local-ai.ts',
    exportPath: 'LOCAL_AI_PAGE.roadmap.body',
    text: 'An air-gapped, container-image deployment path for fully disconnected environments. Not shipped yet, tracked on the roadmap.',
    evidence: [ROADMAP],
  },
  {
    file: 'local-ai.ts',
    exportPath: 'PROVIDER_SWITCH.modes.local.cost',
    text: 'Your inference cost, no per-token fee',
    evidence: [OPEN_WEIGHT],
  },
  {
    file: 'local-ai.ts',
    exportPath: 'PROVIDER_SWITCH.modes.frontier.model',
    text: 'GPT or any OpenAI-compatible provider',
    evidence: [OPENAI_COMPAT, OLLAMA, LLM_CLIENT],
  },
  {
    file: 'local-ai.ts',
    exportPath: 'PROVIDER_SWITCH.modes.frontier.locus',
    text: 'Calls the vendor API you choose',
    evidence: [PROVIDERS],
  },
  {
    file: 'local-ai.ts',
    exportPath: 'PROVIDER_SWITCH.modes.frontier.config',
    text: 'add a frontier adapter, one config line',
    evidence: [OPENAI_COMPAT],
  },
  {
    file: 'local-ai.ts',
    exportPath: 'FRONTIER_PATHWAY.heading',
    text: 'Start local. Escalate on purpose.',
    evidence: [PROVIDERS],
  },
  {
    file: 'local-ai.ts',
    exportPath: 'FRONTIER_PATHWAY.steps[0].body',
    text: 'Agents run on an open-weight model on your own box. Zero config.',
    evidence: [OPEN_WEIGHT],
  },
  {
    file: 'local-ai.ts',
    exportPath: 'FRONTIER_PATHWAY.steps[1].body',
    text: 'When a task needs a frontier model, add the provider in one config line. Opt-in, never assumed.',
    evidence: [OPENAI_COMPAT, PROVIDERS],
  },

  // ── fair-source.ts (claims-ratchet 3) ───────────────────────────────────
  {
    file: 'fair-source.ts',
    exportPath: 'FAIR_SOURCE_HERO.eyebrow',
    text: 'License contract for the Pro packages',
    evidence: [LICENSE_SPLIT],
  },
  {
    file: 'fair-source.ts',
    exportPath: 'FAIR_SOURCE_HERO.subhead',
    text: '(interpolated: FSL count from METRICS.licenseSplit.fsl)',
    match: 'path',
    evidence: [LICENSE_SPLIT],
  },
  {
    file: 'fair-source.ts',
    exportPath: 'FAIR_SOURCE_HERO.body.prefix',
    text: '(interpolated: MIT + FSL counts from METRICS.licenseSplit)',
    match: 'path',
    evidence: [LICENSE_SPLIT, LICENSE_MIT],
  },
  {
    file: 'fair-source.ts',
    exportPath: 'FAIR_SOURCE_HERO.body.suffix',
    text: '(interpolated: internal-package count from METRICS.licenseSplit.internal)',
    match: 'path',
    evidence: [LICENSE_SPLIT, FSL_PEERS_CITATION],
  },
  {
    file: 'fair-source.ts',
    exportPath: 'FAIR_SOURCE_HERO.ogSubtitle',
    text: 'Source-visible. Commercially usable. MIT in two years.',
    evidence: [LICENSE_MIT],
  },
  {
    file: 'fair-source.ts',
    exportPath: 'FAIR_SOURCE_CONTRACT_SECTION.eyebrow',
    text: 'The contract, in plain English',
    evidence: [FAIR_SOURCE_PAGE],
  },
  {
    file: 'fair-source.ts',
    exportPath: 'FAIR_SOURCE_CONTRACT_CARDS[0].body',
    text: 'Ship Fair Source code in your product, charge customers, run it in production. No royalties, no per-seat fees, no usage caps.',
    evidence: [FAIR_SOURCE_PAGE, LICENSE_MIT],
  },
  {
    file: 'fair-source.ts',
    exportPath: 'FAIR_SOURCE_CONTRACT_CARDS[1].title',
    text: 'Read and modify the source',
    evidence: [REPO],
  },
  {
    file: 'fair-source.ts',
    exportPath: 'FAIR_SOURCE_CONTRACT_CARDS[1].body',
    text: 'Every line is on GitHub. Fork it, patch it, audit it for security. The source is the source of truth. There is no closed binary hiding behind it.',
    evidence: [REPO],
  },
  {
    file: 'fair-source.ts',
    exportPath: 'FAIR_SOURCE_CONTRACT_CARDS[2].title',
    text: 'Self-host on your own infra',
    evidence: [SELF_HOST],
  },
  {
    file: 'fair-source.ts',
    exportPath: 'FAIR_SOURCE_CONTRACT_CARDS[2].body',
    text: 'Run it in your VPC, on bare metal, or air-gapped. RevealUI does not phone home and does not depend on a vendor service to function.',
    evidence: [SELF_HOST, NO_TELEMETRY],
  },
  {
    file: 'fair-source.ts',
    exportPath: 'FAIR_SOURCE_CONTRACT_CARDS[3].title',
    text: 'Build a competing developer platform',
    evidence: [FAIR_SOURCE_PAGE],
  },
  {
    file: 'fair-source.ts',
    exportPath: 'FAIR_SOURCE_CONTRACT_CARDS[3].body',
    text: 'You cannot ship a substantially similar developer platform that competes with RevealUI on top of these packages. This is the only restriction. After two years, even this restriction lifts and the release becomes plain MIT.',
    evidence: [FAIR_SOURCE_PAGE, LICENSE_MIT],
  },
  {
    file: 'fair-source.ts',
    exportPath: 'FAIR_SOURCE_PACKAGES_SECTION.heading',
    text: 'Which RevealUI packages are Fair Source.',
    evidence: [LICENSE_SPLIT],
  },
  {
    file: 'fair-source.ts',
    exportPath: 'FAIR_SOURCE_PACKAGES_SECTION.body.prefix',
    text: 'Five packages carry FSL-1.1-MIT: the four published to npm are listed below, plus the private',
    evidence: [LICENSE_SPLIT],
  },
  {
    file: 'fair-source.ts',
    exportPath: 'FAIR_SOURCE_PACKAGES_SECTION.body.suffix',
    text: 'workspace package. Every other RevealUI package is plain MIT: no non-compete, no time limit, fully open source.',
    evidence: [LICENSE_MIT, LICENSE_SPLIT],
  },
  {
    file: 'fair-source.ts',
    exportPath: 'FAIR_SOURCE_PACKAGES_SECTION.footer.prefix',
    text: "Looking for a specific package's license? Run",
    evidence: [LICENSE_SPLIT],
  },
  {
    file: 'fair-source.ts',
    exportPath: 'FAIR_SOURCE_PACKAGES_SECTION.footer.suffix',
    text: ': npm always tells the truth.',
    evidence: [LICENSE_SPLIT],
  },
  {
    file: 'fair-source.ts',
    exportPath: 'FAIR_SOURCE_PACKAGES[0].purpose',
    text: 'AI agents, CRDT memory, LLM provider abstractions, orchestration',
    evidence: [MEMORY, PROVIDERS, ORCHESTRATOR],
  },
  {
    file: 'fair-source.ts',
    exportPath: 'FAIR_SOURCE_PACKAGES[1].purpose',
    text: 'AI harness adapters, workboard coordination, JSON-RPC primitives',
    evidence: [HARNESS_ADAPTER, HARNESS_WORKBOARD],
  },
  {
    file: 'fair-source.ts',
    exportPath: 'FAIR_SOURCE_PACKAGES[2].purpose',
    text: 'MCP framework: server hypervisor, adapter pattern, tool discovery',
    evidence: [HYPERVISOR, MCP_SERVERS],
  },
  {
    file: 'fair-source.ts',
    exportPath: 'FAIR_SOURCE_PACKAGES[3].purpose',
    text: 'External service integrations: Stripe billing and email delivery.',
    evidence: [SERVICES_STRIPE],
  },
  {
    file: 'fair-source.ts',
    exportPath: 'FAIR_SOURCE_CLOCK_SECTION.heading',
    text: 'Every release auto-converts to MIT.',
    evidence: [LICENSE_MIT],
  },
  {
    file: 'fair-source.ts',
    exportPath: 'FAIR_SOURCE_CLOCK_SECTION.body',
    text: "The 2-year timer starts on each release's publish date. Older releases reach MIT first; newer releases start their own clock from their own publish date. The clause does not require any action from RevealUI Studio. It is in the license text and self-executing.",
    evidence: [LICENSE_MIT, FAIR_SOURCE_PAGE],
  },
  {
    file: 'fair-source.ts',
    exportPath: 'FAIR_SOURCE_CLOCK_SECTION.steps[0].title',
    text: 'Release publishes under FSL-1.1-MIT',
    evidence: [FAIR_SOURCE_PAGE],
  },
  {
    file: 'fair-source.ts',
    exportPath: 'FAIR_SOURCE_CLOCK_SECTION.steps[0].body',
    text: 'Source on GitHub. Installable from npm. The 2-year clock starts ticking the moment the version tag lands.',
    evidence: [REPO, FAIR_SOURCE_PAGE],
  },
  {
    file: 'fair-source.ts',
    exportPath: 'FAIR_SOURCE_CLOCK_SECTION.steps[1].body',
    text: 'All freedoms apply (use commercially, modify, self-host) except the non-compete clause. You build on it, you ship products with it, you charge customers for those products.',
    evidence: [FAIR_SOURCE_PAGE],
  },
  {
    file: 'fair-source.ts',
    exportPath: 'FAIR_SOURCE_CLOCK_SECTION.steps[2].title',
    text: 'Two years later: plain MIT',
    evidence: [LICENSE_MIT],
  },
  {
    file: 'fair-source.ts',
    exportPath: 'FAIR_SOURCE_CLOCK_SECTION.steps[2].body',
    text: 'That specific release auto-converts to plain MIT. The non-compete clause lifts; the license becomes OSI-approved open source.',
    evidence: [LICENSE_MIT],
  },
  {
    file: 'fair-source.ts',
    exportPath: 'FAIR_SOURCE_PEERS_SECTION.heading',
    text: 'The same license model used by serious infrastructure projects.',
    evidence: [FSL_PEERS_CITATION],
  },
  {
    file: 'fair-source.ts',
    exportPath: 'FAIR_SOURCE_PEERS[0].note',
    text: 'Application monitoring; flagship FSL adopter (license they originally co-authored with FOSSA).',
    evidence: [FSL_PEERS_CITATION],
  },
  {
    file: 'fair-source.ts',
    exportPath: 'FAIR_SOURCE_PEERS[1].note',
    text: 'Git client for branch management. FSL across the stack.',
    evidence: [FSL_PEERS_CITATION],
  },
  {
    file: 'fair-source.ts',
    exportPath: 'FAIR_SOURCE_PEERS[2].note',
    text: 'License management infrastructure; FSL on their core engine.',
    evidence: [FSL_PEERS_CITATION],
  },
  {
    file: 'fair-source.ts',
    exportPath: 'FAIR_SOURCE_FAQ_SECTION.heading',
    text: 'Detailed answers, not lawyer-speak.',
    evidence: [FAIR_SOURCE_PAGE],
  },
  {
    file: 'fair-source.ts',
    exportPath: 'FAIR_SOURCE_FAQS[0].question',
    text: 'Is Fair Source open source?',
    evidence: [FAIR_SOURCE_PAGE],
  },
  {
    file: 'fair-source.ts',
    exportPath: 'FAIR_SOURCE_FAQS[0].answer',
    text: 'Not in the OSI-approved sense: the non-compete clause means it is "source-available" rather than "open source." But for almost every practical purpose (read, modify, deploy, charge for products built on top), the freedoms match what most builders need from open source. After two years per release, the clause lifts and the code becomes plain MIT, which IS OSI open source.',
    evidence: [FAIR_SOURCE_PAGE, LICENSE_MIT],
  },
  {
    file: 'fair-source.ts',
    exportPath: 'FAIR_SOURCE_FAQS[1].question',
    text: 'What counts as a "competing developer platform"?',
    evidence: [FAIR_SOURCE_PAGE],
  },
  {
    file: 'fair-source.ts',
    exportPath: 'FAIR_SOURCE_FAQS[1].answer',
    text: '(interpolated: SITE.emails.founder)',
    match: 'path',
    evidence: [FAIR_SOURCE_PAGE],
  },
  {
    file: 'fair-source.ts',
    exportPath: 'FAIR_SOURCE_FAQS[2].question',
    text: 'When exactly does each release convert to MIT?',
    evidence: [LICENSE_MIT],
  },
  {
    file: 'fair-source.ts',
    exportPath: 'FAIR_SOURCE_FAQS[2].answer',
    text: 'Two years after the publish date of that specific release. So each release of @revealui/ai becomes MIT on its own 2-year anniversary, and a newer release starts its own clock from its own publish date. Older releases reach MIT first; this is intentional.',
    evidence: [LICENSE_MIT, FAIR_SOURCE_PAGE],
  },
  {
    file: 'fair-source.ts',
    exportPath: 'FAIR_SOURCE_FAQS[3].question',
    text: 'Why not just use plain MIT for everything?',
    evidence: [FAIR_SOURCE_PAGE],
  },
  {
    file: 'fair-source.ts',
    exportPath: 'FAIR_SOURCE_FAQS[3].answer',
    text: 'The Pro packages represent meaningful R&D investment in agent runtimes and harness coordination. Plain MIT lets a competitor fork the entire stack on day one and undercut the project on price, leaving the studio with no path to sustain the work. Fair Source closes that specific risk while keeping every other freedom you need. It is a deliberate middle path between "everything free, no business model" and "closed proprietary."',
    evidence: [FAIR_SOURCE_PAGE],
  },
  {
    file: 'fair-source.ts',
    exportPath: 'FAIR_SOURCE_FAQS[4].question',
    text: 'How is the Pro tier enforced if the source is visible?',
    evidence: [LICENSE_ED25519],
  },
  {
    file: 'fair-source.ts',
    exportPath: 'FAIR_SOURCE_FAQS[4].answer',
    text: 'License enforcement is at runtime in the hosted product, not baked into the npm packages. The hosted RevealUI API checks Ed25519-signed license JWTs and gates Pro API routes; the packages themselves ship ungated, so self-hosters run them freely. FSL is the legal protection: the source is visible and you can run it, but shipping a competing developer platform on top of it is exactly what the non-compete clause prohibits, with civil remedies available. Two years after each release, that release becomes plain MIT.',
    evidence: [LICENSE_ED25519, FAIR_SOURCE_PAGE],
  },
  {
    file: 'fair-source.ts',
    exportPath: 'FAIR_SOURCE_FAQS[5].question',
    text: 'What about the rest of the RevealUI packages?',
    evidence: [LICENSE_MIT],
  },
  {
    file: 'fair-source.ts',
    exportPath: 'FAIR_SOURCE_FAQS[5].answer',
    text: 'Every other RevealUI package is plain MIT, no non-compete clause, no time limit, fully open source. That is the OSS substrate (auth, content, billing primitives, admin UI, presentation system, router, etc.). Fair Source applies to five packages: @revealui/ai, @revealui/engines, @revealui/harnesses, @revealui/mcp, and @revealui/services.',
    evidence: [LICENSE_MIT, LICENSE_SPLIT],
  },
  {
    file: 'fair-source.ts',
    exportPath: 'FAIR_SOURCE_CTA.body',
    text: 'FSL-1.1-MIT is short, plain English, and authored by the FOSSA legal team. Two pages. Read it before you ship.',
    evidence: [FAIR_SOURCE_PAGE],
  },

  // ── philosophy.ts (claims-ratchet 3) ────────────────────────────────────
  {
    file: 'philosophy.ts',
    exportPath: 'PHILOSOPHY.sections[0].body',
    text: "Human progress accelerates when the outputs of today's work become the inputs of tomorrow's work.",
    evidence: [BIO],
  },
  {
    file: 'philosophy.ts',
    exportPath: 'PHILOSOPHY.sections[1].body',
    text: 'Most software effort evaporates. The project ships, the lessons scatter, and the next project starts from zero. Tools that promise productivity make the work faster. They do not make the next project start further ahead.',
    evidence: [BIO],
  },
  {
    file: 'philosophy.ts',
    exportPath: 'PHILOSOPHY.sections[2].body',
    text: 'RevealUI is built for compounding. Five primitives, People, Content, Offers, Payments, and Agents, are a contract you implement once and reuse in every product you ship. A deployment that works can be stamped into a branded, domain-locked RevealUI Fleet kit through RevForge, today in private preview. An agent that works in your business keeps its memory in a store you own, so the record of your work is an asset, not an afterthought.',
    evidence: [ENGINES, REVFORGE_REF, MEMORY],
  },
  {
    file: 'philosophy.ts',
    exportPath: 'PHILOSOPHY.sections[3].body',
    text: "Large organizations buy this kind of accumulation with headcount. RevealUI packages it as software you self-host, so a small team can build on yesterday's work instead of repeating it.",
    evidence: [BIO, SELF_HOST],
  },
  {
    file: 'philosophy.ts',
    exportPath: 'PHILOSOPHY.sections[4].body',
    text: 'Used in production by the team that maintains it.',
    evidence: [THIS_SITE],
  },

  // ── marketplace.ts (claims-ratchet 3) ───────────────────────────────────
  {
    file: 'marketplace.ts',
    exportPath: 'MARKETPLACE_HERO.subtitle',
    text: '(interpolated: server count from METRICS.mcpServers)',
    match: 'path',
    evidence: [MCP_SERVERS, VERCEL_REDIRECT],
  },
  {
    file: 'marketplace.ts',
    exportPath: 'MARKETPLACE_DISCOVERY_SECTION.title',
    text: 'How agents discover and use tools',
    evidence: [HYPERVISOR],
  },
  {
    file: 'marketplace.ts',
    exportPath: 'MARKETPLACE_DISCOVERY_SECTION.subtitle',
    text: 'MCP (Model Context Protocol) is the open standard for connecting AI agents to tools and data sources. RevealUI implements MCP natively.',
    evidence: [HYPERVISOR, OPEN_STANDARDS],
  },
  {
    file: 'marketplace.ts',
    exportPath: 'MARKETPLACE_DISCOVERY_STEPS[0].description',
    text: 'Agents find available tools through the MCP hypervisor. Each server advertises its capabilities and required permissions.',
    evidence: [HYPERVISOR],
  },
  {
    file: 'marketplace.ts',
    exportPath: 'MARKETPLACE_DISCOVERY_STEPS[1].description',
    text: 'The MCP hypervisor routes the call to the right server.',
    evidence: [HYPERVISOR],
  },
  {
    file: 'marketplace.ts',
    exportPath: 'MARKETPLACE_DISCOVERY_STEPS[2].description',
    text: 'The agent calls the tool through a standardized, typed JSON-RPC interface.',
    evidence: [HYPERVISOR],
  },
  {
    file: 'marketplace.ts',
    exportPath: 'MARKETPLACE_SERVERS_SECTION.heading',
    text: '(interpolated: server count from METRICS.mcpServers)',
    match: 'path',
    evidence: [MCP_SERVERS],
  },
  {
    file: 'marketplace.ts',
    exportPath: 'MARKETPLACE_SERVERS_SECTION.body',
    text: 'MCP servers included with RevealUI.',
    evidence: [MCP_SERVERS],
  },
  {
    file: 'marketplace.ts',
    exportPath: 'MARKETPLACE_MCP_SERVERS[0].description',
    text: 'Manage products, prices, subscriptions, and payment intents through MCP.',
    evidence: [MCP_SERVERS],
  },
  {
    file: 'marketplace.ts',
    exportPath: 'MARKETPLACE_MCP_SERVERS[1].description',
    text: 'RevealUI-specific Stripe operations: billing portal, webhook management, tier enforcement.',
    evidence: [MCP_SERVERS, BILLING],
  },
  {
    file: 'marketplace.ts',
    exportPath: 'MARKETPLACE_MCP_SERVERS[2].description',
    text: 'Query and manage Neon PostgreSQL databases: branches, roles, and SQL execution.',
    evidence: [MCP_SERVERS],
  },
  {
    file: 'marketplace.ts',
    exportPath: 'MARKETPLACE_MCP_SERVERS[3].description',
    text: 'Interact with Supabase for vector storage, auth, and real-time subscriptions.',
    evidence: [MCP_SERVERS],
  },
  {
    file: 'marketplace.ts',
    exportPath: 'MARKETPLACE_MCP_SERVERS[4].description',
    text: 'Deploy, manage environment variables, inspect deployments, and view logs.',
    evidence: [MCP_SERVERS],
  },
  {
    file: 'marketplace.ts',
    exportPath: 'MARKETPLACE_MCP_SERVERS[5].description',
    text: 'Run browser automation, take screenshots, and execute end-to-end test flows.',
    evidence: [MCP_SERVERS],
  },
  {
    file: 'marketplace.ts',
    exportPath: 'MARKETPLACE_MCP_SERVERS[6].description',
    text: 'Inspect routes, middleware, server components, and build output in development.',
    evidence: [MCP_SERVERS],
  },
  {
    file: 'marketplace.ts',
    exportPath: 'MARKETPLACE_MCP_SERVERS[7].description',
    text: 'Create, query, and manage collections and documents through the content API.',
    evidence: [MCP_CONTENT],
  },
  {
    file: 'marketplace.ts',
    exportPath: 'MARKETPLACE_MCP_SERVERS[8].description',
    text: 'Send transactional emails, manage templates, and track delivery status.',
    evidence: [MCP_SERVERS],
  },
  {
    file: 'marketplace.ts',
    exportPath: 'MARKETPLACE_MCP_SERVERS[9].description',
    text: 'Validate TypeScript, lint with Biome, and run type checks on code snippets.',
    evidence: [MCP_SERVERS],
  },
  {
    file: 'marketplace.ts',
    exportPath: 'MARKETPLACE_MCP_SERVERS[10].description',
    text: 'Read and write the agent memory store (episodic, semantic, and procedural layers).',
    evidence: [MEMORY_STORES, MCP_SERVERS],
  },
  {
    file: 'marketplace.ts',
    exportPath: 'MARKETPLACE_MCP_SERVERS[11].description',
    text: 'Validate pricing contracts, check OpenAPI mirror drift, and inspect schema.',
    evidence: [MCP_SERVERS],
  },
  {
    file: 'marketplace.ts',
    exportPath: 'MARKETPLACE_MCP_SERVERS[12].description',
    text: 'Search and read first-party @revealui/* package docs: list libraries, resolve names, and fetch curated README and export metadata over MCP.',
    evidence: [DOCS_MCP],
  },
  {
    file: 'marketplace.ts',
    exportPath: 'MARKETPLACE_MCP_SERVERS[13].description',
    text: 'Base class plus concrete Vercel/Stripe/Neon adapters. Standardizes the MCP server contract (error handling, idempotency, observability) across every first-party server above. Source: packages/mcp/src/servers/adapter.ts.',
    evidence: [MCP_SERVERS],
  },
  {
    file: 'marketplace.ts',
    exportPath: 'MARKETPLACE_COMING_SOON.badge',
    text: 'Coming after marketplace v1',
    evidence: [ROADMAP],
  },
  {
    file: 'marketplace.ts',
    exportPath: 'MARKETPLACE_COMING_SOON.heading',
    text: 'Publishing and monetization',
    evidence: [ROADMAP],
  },
  {
    file: 'marketplace.ts',
    exportPath: 'MARKETPLACE_COMING_SOON.body.prefix',
    text: 'Third-party MCP server publishing, developer earnings, and marketplace discovery are planned for a future release. See the',
    evidence: [ROADMAP],
  },
  {
    file: 'marketplace.ts',
    exportPath: 'MARKETPLACE_COMING_SOON.body.suffix',
    text: 'for current status, listed under "Agent Marketplace" in the Mid-Term section.',
    evidence: [ROADMAP],
  },
  {
    file: 'marketplace.ts',
    exportPath: 'MARKETPLACE_CTA.heading',
    text: 'Start with the MCP server catalog',
    evidence: [MCP_SERVERS],
  },
  {
    file: 'marketplace.ts',
    exportPath: 'MARKETPLACE_CTA.body',
    text: '(interpolated: server count from METRICS.mcpServers)',
    match: 'path',
    evidence: [MCP_SERVERS, DOCS_APP],
  },

  // ── roadmap.ts (claims-ratchet 3) ───────────────────────────────────────
  {
    file: 'roadmap.ts',
    exportPath: 'ROADMAP_HERO.subtitle',
    text: 'What we have shipped and what we are building next.',
    evidence: [ROADMAP],
  },
  {
    file: 'roadmap.ts',
    exportPath: 'ROADMAP_SHIPPED[0].name',
    text: 'Perpetual Licenses (Track C)',
    evidence: [PERPETUAL],
  },
  {
    file: 'roadmap.ts',
    exportPath: 'ROADMAP_SHIPPED[0].description',
    text: 'Buy a license once and own Pro, Max, or Enterprise tier features for life, with no subscription required. Perpetual checkout is live today, and each license includes 1 year of priority support and updates.',
    evidence: [PERPETUAL],
  },
  {
    file: 'roadmap.ts',
    exportPath: 'ROADMAP_SHIPPED[1].description',
    text: 'Interact with an AI agent directly from the admin dashboard. Create content, query data, manage collections, and automate workflows through natural language, with streaming responses, tool visibility, and conversation history.',
    evidence: [AGENT_CHAT],
  },
  {
    file: 'roadmap.ts',
    exportPath: 'ROADMAP_SHIPPED[2].description',
    text: 'Documentation site live at docs.revealui.com with quick-start guides, API reference, architecture docs, and package reference. Video walkthroughs and collection cookbook coming soon.',
    evidence: [DOCS_APP],
  },
  {
    file: 'roadmap.ts',
    exportPath: 'ROADMAP_UPCOMING[0].description',
    text: 'A registry where developers publish and discover MCP servers and AI agent capabilities. Revenue share model for developers. Discoverable via Smithery, mcpt, and the RevealUI registry.',
    evidence: [ROADMAP],
  },
  {
    file: 'roadmap.ts',
    exportPath: 'ROADMAP_UPCOMING[1].name',
    text: 'Self-Hosted Docker Images (RevealUI Fleet)',
    evidence: [ROADMAP],
  },
  {
    file: 'roadmap.ts',
    exportPath: 'ROADMAP_UPCOMING[1].description',
    text: 'Official Docker images published to GitHub Container Registry for fully self-hosted deployment. Domain-locked licensing, air-gap capable.',
    evidence: [ROADMAP],
  },
  {
    file: 'roadmap.ts',
    exportPath: 'ROADMAP_UPCOMING[1].status',
    text: 'Planned: designed, not built',
    evidence: [ROADMAP],
  },
  {
    file: 'roadmap.ts',
    exportPath: 'ROADMAP_UPCOMING[2].description',
    text: 'A no-code visual builder for creating RevealUI sites. Drag-and-drop page building, component customization, and one-click deployment.',
    evidence: [ROADMAP],
  },
  {
    file: 'roadmap.ts',
    exportPath: 'ROADMAP_UPCOMING[3].description',
    text: 'Single sign-on via SAML for enterprise customers. Advanced audit logging, custom RBAC policy editor, and multi-region deployment support.',
    evidence: [ROADMAP, RBAC_ABAC],
  },
  {
    file: 'roadmap.ts',
    exportPath: 'ROADMAP_CTA.title',
    text: 'Want to influence what ships next?',
    evidence: [ROADMAP],
  },
  {
    file: 'roadmap.ts',
    exportPath: 'ROADMAP_CTA.subtitle',
    text: 'We prioritize based on customer impact, product readiness, and community demand.',
    evidence: [ROADMAP],
  },

  // ── claims.ts — /claims self-reference ───────────────────────────────────
  {
    file: 'claims.ts',
    exportPath: 'CLAIMS_HERO.subtitle',
    text: 'Every sentence on this site that makes a claim about the product carries an entry below. Each one links to the code, the command, or the page that proves it.',
    evidence: [
      { ...CLAIMS_INDEX, note: `${CLAIMS_INDEX.note}; sentence 1, "carries an entry below"` },
      {
        ...CLAIMS_PAGE_ROUTE,
        note: `${CLAIMS_PAGE_ROUTE.note}; sentence 2, renders the code/command/page link per entry`,
      },
    ],
  },
  {
    file: 'claims.ts',
    exportPath: 'CLAIMS_LEDGER_INTRO',
    text: 'The ledger below is grouped by page, starting with the homepage and moving outward through the site.',
    evidence: [CLAIMS_ROUTE_MAP],
  },
  {
    file: 'claims.ts',
    exportPath: 'CLAIMS_KIND_LEGEND[0].description',
    text: 'A file or directory in the public repository that implements the claim.',
    evidence: [CLAIMS_PAGE_ROUTE],
  },
  {
    file: 'claims.ts',
    exportPath: 'CLAIMS_KIND_LEGEND[1].description',
    text: 'A command you can run yourself to reproduce the claim.',
    evidence: [CLAIMS_PAGE_ROUTE],
  },
  {
    file: 'claims.ts',
    exportPath: 'CLAIMS_KIND_LEGEND[2].description',
    text: 'A live page or endpoint that demonstrates the claim in production.',
    evidence: [CLAIMS_PAGE_ROUTE],
  },
  {
    file: 'claims.ts',
    exportPath: 'CLAIMS_KIND_LEGEND[3].description',
    text: 'A number pinned to the codebase and checked by the claim-drift gate.',
    evidence: [CLAIMS_PAGE_ROUTE, LICENSE_SPLIT],
  },
  {
    file: 'claims.ts',
    exportPath: 'CLAIMS_KIND_LEGEND[4].description',
    text: 'A named, non-skipped test in the repository that proves the claim in code.',
    evidence: [
      CLAIMS_PAGE_ROUTE,
      {
        kind: 'code',
        ref: 'scripts/validate/capability-claims.ts',
        note: 'validateTestRef asserts the test file exists, the title appears, and the test is not skip/todo',
      },
    ],
  },
  {
    file: 'claims.ts',
    exportPath: 'CLAIMS_HONESTY_RAILS_SECTION.intro',
    text: 'The validator that generates this page runs on every pull request and checks the following.',
    evidence: [CLAIMS_VALIDATOR, CI_GATE],
  },
  {
    file: 'claims.ts',
    exportPath: 'CLAIMS_HONESTY_RAILS_SECTION.checks[0]',
    text: 'Every covered sentence on the site carries a matching entry in this index.',
    evidence: [CLAIMS_VALIDATOR, CLAIMS_INDEX],
  },
  {
    file: 'claims.ts',
    exportPath: 'CLAIMS_HONESTY_RAILS_SECTION.checks[1]',
    text: "Each entry's text still matches the live copy, word for word.",
    evidence: [CLAIMS_VALIDATOR],
  },
  {
    file: 'claims.ts',
    exportPath: 'CLAIMS_HONESTY_RAILS_SECTION.checks[2]',
    text: 'Every code path an entry cites still exists in the tracked repository.',
    evidence: [
      { ...CLAIMS_VALIDATOR, note: `${CLAIMS_VALIDATOR.note}; the redaction-rail assertion` },
      {
        kind: 'test',
        ref: 'scripts/validate/__tests__/claims-evidence.test.ts#flags a code-kind ref to a path not tracked in the repo (proves red)',
        note: 'the redaction-rail assertion fails on an untracked code ref (proven red and green)',
      },
    ],
  },
  {
    file: 'claims.ts',
    exportPath: 'CLAIMS_HONESTY_RAILS_SECTION.notCheckedHeading',
    text: 'What this page does not check',
    evidence: [CLAIMS_VALIDATOR],
  },
  {
    file: 'claims.ts',
    exportPath: 'CLAIMS_HONESTY_RAILS_SECTION.doesNotCheck[0]',
    text: 'The gate does not check that the cited code actually does what the sentence claims.',
    evidence: [
      {
        kind: 'url',
        ref: 'https://github.com/RevealUIStudio/revealui',
        note: 'negative claim: the gate cannot verify code behavior, only that cited paths exist and cited text matches; verify by reading the validator source',
      },
    ],
  },
  {
    file: 'claims.ts',
    exportPath: 'CLAIMS_HONESTY_RAILS_SECTION.doesNotCheck[1]',
    text: 'That judgment is a human review layer, not an automated one.',
    evidence: [
      {
        kind: 'url',
        ref: 'https://revealui.com/claims',
        note: 'positive claim about process, not code; the honesty-rails copy itself is the disclosure',
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
