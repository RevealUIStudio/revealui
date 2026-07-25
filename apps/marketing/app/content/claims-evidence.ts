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
  { file: 'roadmap.ts' },
  { file: 'claims.ts' },
  { file: 'receipt.ts' },
  // Legal / contact ratchet (claims-evidence audit 2026-07-22): live policy
  // pages were outside the index while product pages were gated.
  { file: 'contact.ts' },
  { file: 'legal/privacy.ts' },
  { file: 'legal/refund-policy.ts' },
  { file: 'legal/security.ts' },
  { file: 'legal/sla.ts' },
  { file: 'legal/subprocessors.ts' },
  { file: 'legal/support.ts' },
  { file: 'legal/terms.ts' },
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
  note: 'generic content tools; collections as MCP resources when mcpResource !== false',
};
const MCP_RESOURCE_DEFAULT: EvidenceRef = {
  kind: 'code',
  ref: 'apps/admin/src/lib/mcp/collections.ts',
  note: 'mcpResource defaults to true (collection.mcpResource !== false); opt out with false',
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
  note: 'licenseSplit 23 MIT + 5 FSL + 1 internal, pinned by the claim-drift gate',
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
  note: 'local 3-phase gate: Biome, typecheck, Vitest, build; CodeQL, Gitleaks, and Playwright e2e jobs in .github/workflows/ci.yml',
};
const AUDIT_SIGNING: EvidenceRef = {
  kind: 'code',
  ref: 'packages/security/src/audit-signing.ts',
  note: 'Ed25519AuditRowSigner signs each row over RFC 8785 canonical bytes',
};
const AUDIT_SIGNING_TEST: EvidenceRef = {
  kind: 'test',
  ref: 'apps/server/src/lib/__tests__/audit-signing-roundtrip.pglite.test.ts#a canonically-signed row verifies OFFLINE after the jsonb + timestamptz round trip',
  note: 'production-path proof: signed row verifies offline from jsonb + timestamptz readback using only the public key',
};
// Legal / contact pages: the published content module is the public policy
// artifact. Technical sentences below add code refs when they assert product
// behavior; the content ref always remains for the policy restatement.
const LEGAL_CONTACT_CONTENT: EvidenceRef = {
  kind: 'code',
  ref: 'apps/marketing/app/content/contact.ts',
  note: 'contact page copy; rendered by apps/marketing/app/routes/ContactPage.tsx',
};
const LEGAL_PRIVACY_CONTENT: EvidenceRef = {
  kind: 'code',
  ref: 'apps/marketing/app/content/legal/privacy.ts',
  note: 'published Privacy Policy; rendered by PrivacyPage.tsx',
};
const LEGAL_REFUND_CONTENT: EvidenceRef = {
  kind: 'code',
  ref: 'apps/marketing/app/content/legal/refund-policy.ts',
  note: 'published refund policy; sourced from .jv refund-window ADR; RefundPolicyPage.tsx',
};
const LEGAL_SECURITY_CONTENT: EvidenceRef = {
  kind: 'code',
  ref: 'apps/marketing/app/content/legal/security.ts',
  note: 'published security page; rendered by SecurityPage.tsx',
};
const LEGAL_SLA_CONTENT: EvidenceRef = {
  kind: 'code',
  ref: 'apps/marketing/app/content/legal/sla.ts',
  note: 'published SLA; sourced from .jv sla-target ADR; SlaPage.tsx',
};
const LEGAL_SUBPROCESSORS_CONTENT: EvidenceRef = {
  kind: 'code',
  ref: 'apps/marketing/app/content/legal/subprocessors.ts',
  note: 'published subprocessors list; SubprocessorsPage.tsx',
};
const LEGAL_SUPPORT_CONTENT: EvidenceRef = {
  kind: 'code',
  ref: 'apps/marketing/app/content/legal/support.ts',
  note: 'published support page; SupportPage.tsx',
};
const LEGAL_TERMS_CONTENT: EvidenceRef = {
  kind: 'code',
  ref: 'apps/marketing/app/content/legal/terms.ts',
  note: 'published Terms of Service; TermsPage.tsx',
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
const REFUND_ROUTE: EvidenceRef = {
  kind: 'code',
  ref: 'apps/server/src/routes/billing.ts',
  note: 'POST /api/billing/refund; admin-authenticated, full or partial refunds via Stripe',
};
const AUDIT_LOG_SCHEMA: EvidenceRef = {
  kind: 'code',
  ref: 'packages/db/src/schema/audit-log.ts',
  note: 'audit_log table; single-door write path enforced by validate:audit-one-door',
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
  note: 'createLLMClientFromEnv default provider inference-snaps, defaultModel nemotron-3-nano, port 9090; US-origin allowlist; LLMProviderType union groq/ollama/huggingface/inference-snaps',
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
// ── audit-log signing (GAP-355 Stage 3): the log is signed with a key anyone
// can check, verifiable offline without our secret. Scoped to the log, not
// "every agent action" (Stage 5). Stage 4 adds Merkle roots + offline anchor
// CLI (S4-5) for customers who hold a delivered root. ─────────────────────────
const AUDIT_ROW_SIGNER: EvidenceRef = {
  kind: 'code',
  ref: 'packages/security/src/audit-signing.ts',
  note: 'Ed25519AuditRowSigner signs each row over RFC 8785 canonical bytes; verify with the published SPKI public key (GET /api/audit/public-key), no secret needed',
};
const AUDIT_SIGN_ROUNDTRIP: EvidenceRef = {
  kind: 'test',
  ref: 'apps/server/src/lib/__tests__/audit-signing-roundtrip.pglite.test.ts#a canonically-signed row verifies OFFLINE after the jsonb + timestamptz round trip',
  note: 'a row written through the one door verifies offline from the jsonb + timestamptz readback using only the public key',
};
const AUDIT_MERKLE: EvidenceRef = {
  kind: 'code',
  ref: 'packages/security/src/audit-merkle.ts',
  note: 'Stage 4: per-tenant Merkle roots over row signature leaves; inclusion proofs recompute the root offline',
};
const AUDIT_ANCHOR_VERIFY: EvidenceRef = {
  kind: 'code',
  ref: 'packages/security/src/audit-anchor-verify.ts',
  note: 'Stage 4 S4-5: pure offline verify of root signature + optional inclusion proof (no network)',
};
const AUDIT_ANCHOR_VERIFY_CLI: EvidenceRef = {
  kind: 'command',
  ref: 'pnpm verify:audit-anchor -- --public-key <pem> --anchor <json> [--proof <json>]',
  note: 'Stage 4 offline CLI (scripts/security/verify-audit-anchor.ts); exit 0 iff checks pass',
};
const AUDIT_ANCHOR_SCHEMA: EvidenceRef = {
  kind: 'code',
  ref: 'packages/db/src/schema/audit-anchors.ts',
  note: 'audit_anchors stores delivered roots + root_signature for customer hold',
};
const AUDIT_ANCHOR_VERIFY_TEST: EvidenceRef = {
  kind: 'test',
  ref: 'packages/security/src/__tests__/audit-anchor-verify.test.ts#accepts root + inclusion proof for one leaf',
  note: 'root signature + inclusion path verify offline with only the public key',
};
const AUDIT_ANCHOR_API: EvidenceRef = {
  kind: 'code',
  ref: 'apps/server/src/routes/audit.ts',
  note: 'GET /api/audit/anchors and /proof (S4-4); Max+ auditLog gate + tenant lag in list response',
};
const AUDIT_LOG_FEATURE_MAX: EvidenceRef = {
  kind: 'code',
  ref: 'packages/core/src/features.ts',
  note: 'auditLog feature requires Max tier; Free/Pro cannot download roots (403)',
};
const AUDIT_RECEIPTS_DOC: EvidenceRef = {
  kind: 'code',
  ref: 'docs/security/AUDIT_RECEIPTS.md',
  note: 'Stage 4 honesty: what Free/Pro get vs Max root delivery; offline CLI; verification never paid',
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
    exportPath: 'HOME_HERO.subtitle.sentence2',
    text: 'Every agent is a governed and audited user that lives on your infrastructure.',
    evidence: [
      AGENT_ROUTES,
      RBAC_ABAC,
      TIER_GATES,
      AUDIT_LOG_SCHEMA,
      AUDIT_SIGNING,
      AUDIT_SIGNING_TEST,
      {
        kind: 'code',
        ref: 'packages/auth/src/server/auth.ts',
        note: 'agents authenticate as first-class principals under the same session/auth surface as human users',
      },
      {
        kind: 'test',
        ref: 'packages/core/src/collections/operations/__tests__/access-enforcement.test.ts#authenticated() allows when user is present',
        note: 'identity-gated access: a principal must authenticate before protected operations; agents use the same gate surface as human users',
      },
      SELF_HOST,
    ],
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
    text: 'Content tools over MCP; collections surface as resources unless you opt out',
    evidence: [MCP_CONTENT, MCP_RESOURCE_DEFAULT],
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
    text: 'Yes. 23 of 29 packages are MIT and stay MIT, forever. The 5 Pro packages are Fair Source (FSL-1.1-MIT) and auto-convert to MIT two years after each release. Self-host the entire stack on your own infrastructure at any tier, with no vendor-specific edge runtimes and no proprietary database.',
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
    text: 'Agents authenticate like users and pass the same tier gates your customers pass. The content MCP server ships discovery and read tools, collections surface as discoverable MCP resources by default (set mcpResource: false to opt out), and writes go through the same REST API your app uses.',
    evidence: [TIER_GATES, MCP_CONTENT, MCP_RESOURCE_DEFAULT, OPEN_STANDARDS],
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
  {
    file: 'proof.ts',
    exportPath: 'PROOF_DEPLOYERS.heading',
    text: 'Built for people who deploy, not only demo.',
    evidence: [
      {
        kind: 'url',
        ref: 'https://revealuistudio.com',
        note: 'Studio/agency is the reference forward-deploy practice (ADR 2026-07-21)',
      },
    ],
  },
  {
    file: 'proof.ts',
    exportPath: 'PROOF_DEPLOYERS.body',
    text: 'Some buyers install RevealUI themselves. Some hire us, or their own forward-deployed engineer, to stamp and hand over a fleet. Either way the outcome is the same: a self-hosted runtime where the business and its agents live under one roof, on infrastructure the customer owns.',
    evidence: [
      REPO,
      {
        kind: 'url',
        ref: 'https://revealuistudio.com',
        note: 'hire-us path; Fleet Stamp / Custom Build on agency services',
      },
      {
        kind: 'url',
        ref: 'https://revealui.com',
        note: 'self-install product path; canonical ownership sentence',
      },
    ],
  },
  {
    file: 'proof.ts',
    exportPath: 'PROOF_DEPLOYERS.foil',
    text: 'Cloud agent platforms rent you an outcome. A forward-deployed engagement leaves a runtime the customer runs.',
    evidence: [
      REPO,
      {
        kind: 'url',
        ref: 'https://revealuistudio.com',
        note: 'positioning foil: customer-owned runtime after handoff, not a rented outcome',
      },
    ],
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
    text: '23 of 29 packages are MIT, forever. The 5 Pro packages are Fair Source (FSL) and convert to MIT after two years. There is no telemetry.',
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
    exportPath: 'SUBSCRIPTION_TIERS[2].features[5]',
    text: 'Signed audit log plus downloadable Merkle roots you verify offline',
    evidence: [
      AUDIT_ROW_SIGNER,
      AUDIT_MERKLE,
      AUDIT_ANCHOR_API,
      AUDIT_ANCHOR_VERIFY_CLI,
      AUDIT_ANCHOR_VERIFY_TEST,
      AUDIT_SIGN_ROUNDTRIP,
      AUDIT_LOG_FEATURE_MAX,
      AUDIT_RECEIPTS_DOC,
    ],
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
    text: 'nemotron-3-nano on your box, port 9090 (default runner)',
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
    exportPath: 'PROVIDER_SWITCH.modes.local.model',
    text: 'nemotron-3-nano, open-weight (US-origin)',
    evidence: [LLM_CLIENT, OPEN_WEIGHT],
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
    exportPath: 'CLAIMS_SIGNED_LEDGER_NOTE.body',
    text: 'Every action in the audit log is signed with a key you can check yourself. Verifying a record does not require our secret.',
    evidence: [AUDIT_ROW_SIGNER, AUDIT_SIGN_ROUNDTRIP],
  },
  {
    file: 'claims.ts',
    exportPath: 'CLAIMS_RECEIPT_HOLD_NOTE.body',
    text: 'On Max, the worker seals ranges of your signed audit log into Merkle roots you can download. You verify those roots offline with the published public key, without calling us. Free and Pro still get a signed log. Root delivery is Max. Checking a receipt is free either way.',
    evidence: [
      AUDIT_MERKLE,
      AUDIT_ANCHOR_SCHEMA,
      AUDIT_ANCHOR_API,
      AUDIT_ANCHOR_VERIFY,
      AUDIT_ANCHOR_VERIFY_CLI,
      AUDIT_ANCHOR_VERIFY_TEST,
      AUDIT_LOG_FEATURE_MAX,
      AUDIT_RECEIPTS_DOC,
    ],
  },
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

  // ── receipt.ts — hero receipt-motif moment (Phase 5) ────────────────────
  {
    file: 'receipt.ts',
    exportPath: 'RECEIPT_HERO_TITLE',
    text: 'Refund, handled by an agent',
    evidence: [REFUND_ROUTE, AGENT_ROUTES],
  },
  {
    file: 'receipt.ts',
    exportPath: 'RECEIPT_HERO_CAPTION.text',
    text: "If an agent did it, there's a receipt.",
    evidence: [
      AUDIT_SIGNING,
      AUDIT_SIGNING_TEST,
      AUDIT_LOG_SCHEMA,
      REFUND_ROUTE,
      {
        ...AUDIT_RECEIPTS_DOC,
        note: 'Stage 4 S4-6: foil is positioning; sealed root download is Max (auditLog); verification never paid',
      },
      AUDIT_LOG_FEATURE_MAX,
    ],
  },

  // ── contact + legal/* ratchet (claims-evidence audit 2026-07-22) ─────────
  // Policy pages are the public restatement of owner decisions; each entry
  // pins the content module. Technical assertions add code refs where the
  // sentence asserts product behavior (auth, billing, RBAC, CI).
  {
    file: 'contact.ts',
    exportPath: 'CONTACT_HERO.subtitle',
    text: 'Questions about RevealUI? Interested in Enterprise or custom pricing? We would love to hear from you.',
    evidence: [
      LEGAL_CONTACT_CONTENT,
      { kind: 'url', ref: 'https://revealui.com/contact', note: 'public contact page' },
    ],
  },
  {
    file: 'legal/privacy.ts',
    exportPath: 'PRIVACY_META.intro',
    text: 'The RevealUI platform (revealui.com, admin.revealui.com, api.revealui.com, and docs.revealui.com, the "Service") is operated by REVEALUI STUDIO L.L.C., a Tennessee limited liability company ("we", "us", "our"). This Privacy Policy describes how we collect, use, and protect your personal information.',
    evidence: [LEGAL_PRIVACY_CONTENT],
  },
  {
    file: 'legal/privacy.ts',
    exportPath: 'PRIVACY_SECTIONS[0].subsections[0].paragraph',
    text: 'When you create an account, we collect your email address, name, and password (stored as a bcrypt hash). If you sign up via OAuth (Google, GitHub), we receive your provider profile information.',
    evidence: [LEGAL_PRIVACY_CONTENT, AUTH_SESSIONS],
  },
  {
    file: 'legal/privacy.ts',
    exportPath: 'PRIVACY_SECTIONS[0].subsections[1].paragraph',
    text: 'Payment processing is handled entirely by Stripe. We never store credit card numbers. We store your Stripe customer ID to link your account to your subscription.',
    evidence: [LEGAL_PRIVACY_CONTENT, BILLING],
  },
  {
    file: 'legal/privacy.ts',
    exportPath: 'PRIVACY_SECTIONS[0].subsections[2].paragraph',
    text: 'We collect server logs (IP address, request path, user agent) for security monitoring and debugging. See §4 below for retention windows.',
    evidence: [LEGAL_PRIVACY_CONTENT],
  },
  {
    file: 'legal/privacy.ts',
    exportPath: 'PRIVACY_SECTIONS[0].subsections[3].paragraph',
    text: 'Any content you create through the admin (posts, pages, media) is stored in your database. For hosted plans, this data is stored in NeonDB (PostgreSQL).',
    evidence: [LEGAL_PRIVACY_CONTENT, POSTGRES],
  },
  {
    file: 'legal/privacy.ts',
    exportPath: 'PRIVACY_SECTIONS[1].heading',
    text: '2. How We Use Your Information',
    evidence: [LEGAL_PRIVACY_CONTENT],
  },
  {
    file: 'legal/privacy.ts',
    exportPath: 'PRIVACY_SECTIONS[1].listItems[0]',
    text: 'To provide and maintain the Service',
    evidence: [LEGAL_PRIVACY_CONTENT],
  },
  {
    file: 'legal/privacy.ts',
    exportPath: 'PRIVACY_SECTIONS[1].listItems[1]',
    text: 'To process payments and manage subscriptions',
    evidence: [LEGAL_PRIVACY_CONTENT],
  },
  {
    file: 'legal/privacy.ts',
    exportPath: 'PRIVACY_SECTIONS[1].listItems[2]',
    text: 'To send transactional emails (password resets, billing notifications, license delivery)',
    evidence: [LEGAL_PRIVACY_CONTENT, AUTH_SESSIONS],
  },
  {
    file: 'legal/privacy.ts',
    exportPath: 'PRIVACY_SECTIONS[1].listItems[3]',
    text: 'To detect and prevent fraud, abuse, and security incidents',
    evidence: [LEGAL_PRIVACY_CONTENT],
  },
  {
    file: 'legal/privacy.ts',
    exportPath: 'PRIVACY_SECTIONS[1].listItems[4]',
    text: 'To diagnose application errors using error telemetry (Sentry). When an error occurs, a partial session recording of the moments preceding the crash may be captured to aid debugging. No proactive or continuous session recording is performed.',
    evidence: [LEGAL_PRIVACY_CONTENT],
  },
  {
    file: 'legal/privacy.ts',
    exportPath: 'PRIVACY_SECTIONS[1].listItems[5]',
    text: 'To respond to support requests',
    evidence: [LEGAL_PRIVACY_CONTENT],
  },
  {
    file: 'legal/privacy.ts',
    exportPath: 'PRIVACY_SECTIONS[1].paragraphs[0]',
    text: 'We do not sell your personal information. We do not use your data for advertising.',
    evidence: [LEGAL_PRIVACY_CONTENT],
  },
  {
    file: 'legal/privacy.ts',
    exportPath: 'PRIVACY_SECTIONS[2].thirdParties[3].description',
    text: 'object storage (media uploads, generated assets)',
    evidence: [LEGAL_PRIVACY_CONTENT],
  },
  {
    file: 'legal/privacy.ts',
    exportPath: 'PRIVACY_SECTIONS[2].thirdParties[4].description',
    text: 'transactional email delivery via Gmail API',
    evidence: [LEGAL_PRIVACY_CONTENT],
  },
  {
    file: 'legal/privacy.ts',
    exportPath: 'PRIVACY_SECTIONS[2].thirdParties[5].description',
    text: 'application error tracking and crash-replay diagnostics',
    evidence: [LEGAL_PRIVACY_CONTENT],
  },
  {
    file: 'legal/privacy.ts',
    exportPath: 'PRIVACY_SECTIONS[2].thirdParties[5].extra',
    text: 'Error data may include browser context, page URL, and a partial session recording captured at the time of an error. No continuous session recording is performed.',
    evidence: [LEGAL_PRIVACY_CONTENT],
  },
  {
    file: 'legal/privacy.ts',
    exportPath: 'PRIVACY_SECTIONS[2].paragraphs[0]',
    text: 'For the full dated list of subprocessors with regions, data categories, and DPA links, see our Subprocessors page at https://revealui.com/legal/subprocessors. The Subprocessors page is the authoritative source; this section is a summary kept in sync with it.',
    evidence: [LEGAL_PRIVACY_CONTENT],
  },
  {
    file: 'legal/privacy.ts',
    exportPath: 'PRIVACY_SECTIONS[3].heading',
    text: '4. Customer content and AI training',
    evidence: [LEGAL_PRIVACY_CONTENT],
  },
  {
    file: 'legal/privacy.ts',
    exportPath: 'PRIVACY_SECTIONS[3].paragraphs[0]',
    text: 'We do not use customer content (the data, prompts, files, and configurations you submit to the Service) to train any general-purpose model. This commitment applies to any model we operate and to any third-party model accessed through the Service via our infrastructure.',
    evidence: [LEGAL_PRIVACY_CONTENT],
  },
  {
    file: 'legal/privacy.ts',
    exportPath: 'PRIVACY_SECTIONS[3].paragraphs[1]',
    text: 'If you connect your own external LLM provider to RevealUI (your own OpenAI key, Anthropic key, or other provider), your data flows to that provider on terms you have agreed to with them. We do not intermediate those terms. You are responsible for understanding their training-data position.',
    evidence: [LEGAL_PRIVACY_CONTENT],
  },
  {
    file: 'legal/privacy.ts',
    exportPath: 'PRIVACY_SECTIONS[3].paragraphs[2]',
    text: 'The default RevealUI configuration uses local AI inference (Ollama or Inference Snaps) that runs entirely on your own infrastructure. In that configuration, customer content does not leave your boundary at all.',
    evidence: [LEGAL_PRIVACY_CONTENT],
  },
  {
    file: 'legal/privacy.ts',
    exportPath: 'PRIVACY_SECTIONS[4].paragraphs[0]',
    text: 'Account data is retained while your account is active. After account deletion, we permanently remove your personal data within 30 days. Application logs and error events are retained for 90 days. Infrastructure server logs (IP address, request path, user agent) are retained by our hosting provider per their policy. Billing records are retained as required by tax law (typically 7 years).',
    evidence: [LEGAL_PRIVACY_CONTENT],
  },
  {
    file: 'legal/privacy.ts',
    exportPath: 'PRIVACY_SECTIONS[5].heading',
    text: '6. Your Rights (GDPR / CCPA)',
    evidence: [LEGAL_PRIVACY_CONTENT],
  },
  {
    file: 'legal/privacy.ts',
    exportPath: 'PRIVACY_SECTIONS[5].listItems[0]',
    text: 'Access your personal data, available via your account settings or by contacting us',
    evidence: [LEGAL_PRIVACY_CONTENT],
  },
  {
    file: 'legal/privacy.ts',
    exportPath: 'PRIVACY_SECTIONS[5].listItems[1]',
    text: 'Export your data: use the GDPR export endpoint in the admin',
    evidence: [LEGAL_PRIVACY_CONTENT],
  },
  {
    file: 'legal/privacy.ts',
    exportPath: 'PRIVACY_SECTIONS[5].listItems[2]',
    text: 'Delete your account and all associated data: use the account deletion feature or contact us',
    evidence: [LEGAL_PRIVACY_CONTENT],
  },
  {
    file: 'legal/privacy.ts',
    exportPath: 'PRIVACY_SECTIONS[5].listItems[3]',
    text: 'Correct inaccurate data: update your profile in the admin dashboard',
    evidence: [LEGAL_PRIVACY_CONTENT],
  },
  {
    file: 'legal/privacy.ts',
    exportPath: 'PRIVACY_SECTIONS[5].listItems[4]',
    text: 'Object to processing: contact us at the email below',
    evidence: [LEGAL_PRIVACY_CONTENT],
  },
  {
    file: 'legal/privacy.ts',
    exportPath: 'PRIVACY_SECTIONS[5].paragraphs[0]',
    text: 'California residents: Under the CCPA, you have the right to know what personal information we collect and to request its deletion. We do not sell personal information.',
    evidence: [LEGAL_PRIVACY_CONTENT],
  },
  {
    file: 'legal/privacy.ts',
    exportPath: 'PRIVACY_SECTIONS[6].paragraphs[0]',
    text: 'We protect your data using: bcrypt password hashing, session-based authentication with secure cookies, rate limiting and brute-force protection, HTTPS/TLS encryption in transit, and encrypted database connections.',
    evidence: [LEGAL_PRIVACY_CONTENT, AUTH_SESSIONS, POSTGRES],
  },
  {
    file: 'legal/privacy.ts',
    exportPath: 'PRIVACY_SECTIONS[7].listPreamble',
    text: 'We use the following cookies and trackers across our public marketing site (revealui.com), the admin dashboard, and the API:',
    evidence: [LEGAL_PRIVACY_CONTENT],
  },
  {
    file: 'legal/privacy.ts',
    exportPath: 'PRIVACY_SECTIONS[7].listItems[0]',
    text: 'Session cookie (essential): set on sign-in to keep you authenticated. httpOnly, secure, sameSite=lax.',
    evidence: [LEGAL_PRIVACY_CONTENT],
  },
  {
    file: 'legal/privacy.ts',
    exportPath: 'PRIVACY_SECTIONS[7].listItems[1]',
    text: 'CSRF token cookie (essential): set on POST requests to prevent cross-site request forgery.',
    evidence: [LEGAL_PRIVACY_CONTENT],
  },
  {
    file: 'legal/privacy.ts',
    exportPath: 'PRIVACY_SECTIONS[7].listItems[2]',
    text: 'Vercel Speed Insights (performance telemetry, anonymous): loaded on the marketing site to measure Core Web Vitals (LCP, INP, CLS, etc.). Aggregated by Vercel; no personal identifiers; no cross-site tracking.',
    evidence: [LEGAL_PRIVACY_CONTENT],
  },
  {
    file: 'legal/privacy.ts',
    exportPath: 'PRIVACY_SECTIONS[7].paragraphs[0]',
    text: 'We do not use advertising cookies, third-party tracking cookies, or cross-site cookies. Vercel Speed Insights honors the `Do Not Track` browser signal and can be opted out at the browser level. We will surface any additional trackers (including Sentry, when wired) on this list in the same commit that adds them.',
    evidence: [LEGAL_PRIVACY_CONTENT],
  },
  {
    file: 'legal/privacy.ts',
    exportPath: 'PRIVACY_SECTIONS[8].paragraphs[0]',
    text: 'The Service is not intended for children under 13. We do not knowingly collect personal information from children under 13.',
    evidence: [LEGAL_PRIVACY_CONTENT],
  },
  {
    file: 'legal/privacy.ts',
    exportPath: 'PRIVACY_SECTIONS[9].paragraphs[0]',
    text: 'We may update this Privacy Policy from time to time. We will notify registered users of material changes via email.',
    evidence: [LEGAL_PRIVACY_CONTENT],
  },
  {
    file: 'legal/privacy.ts',
    exportPath: 'PRIVACY_SECTIONS[10].paragraphs[0]',
    text: '(interpolated: SITE email / domain embedded at runtime)',
    match: 'path',
    evidence: [LEGAL_PRIVACY_CONTENT],
  },
  {
    file: 'legal/refund-policy.ts',
    exportPath: 'REFUND_POLICY_META.intro',
    text: 'This page describes when you can get your money back from RevealUI Studio and how to ask for it. It applies to purchases made directly through revealui.com and admin.revealui.com.',
    evidence: [LEGAL_REFUND_CONTENT, REFUND_ROUTE],
  },
  {
    file: 'legal/refund-policy.ts',
    exportPath: 'REFUND_POLICY_SECTIONS[0].heading',
    text: '1. Perpetual licenses (Pro, Agency, and Enterprise Perpetual)',
    evidence: [LEGAL_REFUND_CONTENT, REFUND_ROUTE],
  },
  {
    file: 'legal/refund-policy.ts',
    exportPath: 'REFUND_POLICY_SECTIONS[0].paragraphs[0]',
    text: 'You may request a full refund within 14 days of purchase, for any reason, no questions asked. Refunds are processed within 5 business days. Your license key is revoked once the refund is issued.',
    evidence: [LEGAL_REFUND_CONTENT, REFUND_ROUTE],
  },
  {
    file: 'legal/refund-policy.ts',
    exportPath: 'REFUND_POLICY_SECTIONS[0].paragraphs[1]',
    text: 'After the 14-day window, refunds are available only for documented product defects, at our discretion.',
    evidence: [LEGAL_REFUND_CONTENT, REFUND_ROUTE],
  },
  {
    file: 'legal/refund-policy.ts',
    exportPath: 'REFUND_POLICY_SECTIONS[1].heading',
    text: '2. Subscriptions (Pro, Max, and Enterprise plans)',
    evidence: [LEGAL_REFUND_CONTENT, REFUND_ROUTE],
  },
  {
    file: 'legal/refund-policy.ts',
    exportPath: 'REFUND_POLICY_SECTIONS[1].paragraphs[0]',
    text: 'You can cancel a subscription at any time. Cancellation takes effect at the end of your current billing period, and there is no pro-rated refund for the unused portion of a billing cycle.',
    evidence: [LEGAL_REFUND_CONTENT, REFUND_ROUTE],
  },
  {
    file: 'legal/refund-policy.ts',
    exportPath: 'REFUND_POLICY_SECTIONS[1].paragraphs[1]',
    text: 'Your first month is refundable in full if you request it within 14 days of your initial paid charge.',
    evidence: [LEGAL_REFUND_CONTENT, REFUND_ROUTE],
  },
  {
    file: 'legal/refund-policy.ts',
    exportPath: 'REFUND_POLICY_SECTIONS[2].paragraphs[0]',
    text: 'Architecture Review, Fleet deployment, Custom Build, and other services sold by invoice are governed by the Master Service Agreement and Statement of Work for that engagement, not by this policy.',
    evidence: [LEGAL_REFUND_CONTENT, REFUND_ROUTE],
  },
  {
    file: 'legal/refund-policy.ts',
    exportPath: 'REFUND_POLICY_SECTIONS[3].heading',
    text: '4. How to request a refund',
    evidence: [LEGAL_REFUND_CONTENT, REFUND_ROUTE],
  },
  {
    file: 'legal/refund-policy.ts',
    exportPath: 'REFUND_POLICY_SECTIONS[3].listItems[0]',
    text: '(interpolated: SITE email / domain embedded at runtime)',
    match: 'path',
    evidence: [LEGAL_REFUND_CONTENT, REFUND_ROUTE],
  },
  {
    file: 'legal/refund-policy.ts',
    exportPath: 'REFUND_POLICY_SECTIONS[3].listItems[1]',
    text: 'We process eligible refunds within 5 business days of your request.',
    evidence: [LEGAL_REFUND_CONTENT, REFUND_ROUTE],
  },
  {
    file: 'legal/refund-policy.ts',
    exportPath: 'REFUND_POLICY_SECTIONS[3].listItems[2]',
    text: 'For a perpetual license, your license key is revoked once the refund is issued.',
    evidence: [LEGAL_REFUND_CONTENT, REFUND_ROUTE],
  },
  {
    file: 'legal/refund-policy.ts',
    exportPath: 'REFUND_POLICY_SECTIONS[4].paragraphs[0]',
    text: '(interpolated: SITE email / domain embedded at runtime)',
    match: 'path',
    evidence: [LEGAL_REFUND_CONTENT, REFUND_ROUTE],
  },
  {
    file: 'legal/security.ts',
    exportPath: 'SECURITY_META.intro',
    text: 'RevealUI Studio is a solo-operator company building production software. Security is not a marketing line for us. It is a discipline we apply every day, and it determines whether real customers can trust us with their data. This page describes how we accept vulnerability reports, what we commit to in return, and the security posture our customers inherit when they self-host.',
    evidence: [LEGAL_SECURITY_CONTENT],
  },
  {
    file: 'legal/security.ts',
    exportPath: 'SECURITY_SECTIONS[0].heading',
    text: '1. Reporting a vulnerability',
    evidence: [LEGAL_SECURITY_CONTENT],
  },
  {
    file: 'legal/security.ts',
    exportPath: 'SECURITY_SECTIONS[0].paragraphs[0]',
    text: '(interpolated: SITE email / domain embedded at runtime)',
    match: 'path',
    evidence: [LEGAL_SECURITY_CONTENT],
  },
  {
    file: 'legal/security.ts',
    exportPath: 'SECURITY_SECTIONS[0].paragraphs[1]',
    text: 'We do not currently publish a PGP key. If your report contains sensitive material (proof-of-concept payloads, user data exposure, exploit details), email us first and we will arrange an encrypted channel before you share specifics.',
    evidence: [
      LEGAL_SECURITY_CONTENT,
      {
        kind: 'code',
        ref: 'packages/security/src',
        note: 'crypto helpers; AES-256-GCM field encryption surface',
      },
    ],
  },
  {
    file: 'legal/security.ts',
    exportPath: 'SECURITY_SECTIONS[0].paragraphs[2]',
    text: 'We acknowledge receipt within 2 business days and aim to provide a substantive initial response within 5 business days. As a solo-operator company we cannot promise 24×7 triage, but we treat real security reports as our highest priority.',
    evidence: [LEGAL_SECURITY_CONTENT],
  },
  {
    file: 'legal/security.ts',
    exportPath: 'SECURITY_SECTIONS[1].heading',
    text: '2. Our commitment to good-faith researchers',
    evidence: [LEGAL_SECURITY_CONTENT],
  },
  {
    file: 'legal/security.ts',
    exportPath: 'SECURITY_SECTIONS[1].listPreamble',
    text: 'If you act in good faith and follow this policy, we commit to:',
    evidence: [LEGAL_SECURITY_CONTENT],
  },
  {
    file: 'legal/security.ts',
    exportPath: 'SECURITY_SECTIONS[1].listItems[0]',
    text: 'Not pursue or support legal action against you for your research.',
    evidence: [LEGAL_SECURITY_CONTENT],
  },
  {
    file: 'legal/security.ts',
    exportPath: 'SECURITY_SECTIONS[1].listItems[1]',
    text: 'Not contact law enforcement or your employer about your report.',
    evidence: [LEGAL_SECURITY_CONTENT],
  },
  {
    file: 'legal/security.ts',
    exportPath: 'SECURITY_SECTIONS[1].listItems[2]',
    text: 'Work with you to understand and resolve the issue without unnecessary delay.',
    evidence: [LEGAL_SECURITY_CONTENT],
  },
  {
    file: 'legal/security.ts',
    exportPath: 'SECURITY_SECTIONS[1].listItems[3]',
    text: 'Credit you publicly on this page when the issue is resolved, if you wish to be named. We will never publish your identity without your consent.',
    evidence: [LEGAL_SECURITY_CONTENT],
  },
  {
    file: 'legal/security.ts',
    exportPath: 'SECURITY_SECTIONS[1].paragraphs[0]',
    text: 'We do not currently run a paid bug-bounty program. We are pre-revenue and cannot honestly promise bounty payouts that we may not be able to fund. If you find a material issue we will discuss recognition, swag, or (once we are revenue-generating) a discretionary reward.',
    evidence: [LEGAL_SECURITY_CONTENT],
  },
  {
    file: 'legal/security.ts',
    exportPath: 'SECURITY_SECTIONS[2].listItems[0]',
    text: 'revealui.com (marketing site)',
    evidence: [LEGAL_SECURITY_CONTENT],
  },
  {
    file: 'legal/security.ts',
    exportPath: 'SECURITY_SECTIONS[2].listItems[1]',
    text: 'admin.revealui.com (admin dashboard)',
    evidence: [LEGAL_SECURITY_CONTENT],
  },
  {
    file: 'legal/security.ts',
    exportPath: 'SECURITY_SECTIONS[2].listItems[2]',
    text: 'api.revealui.com (REST API)',
    evidence: [LEGAL_SECURITY_CONTENT],
  },
  {
    file: 'legal/security.ts',
    exportPath: 'SECURITY_SECTIONS[2].listItems[3]',
    text: 'docs.revealui.com (documentation site)',
    evidence: [LEGAL_SECURITY_CONTENT],
  },
  {
    file: 'legal/security.ts',
    exportPath: 'SECURITY_SECTIONS[2].listItems[4]',
    text: 'The published source code in the RevealUIStudio organization on GitHub',
    evidence: [LEGAL_SECURITY_CONTENT],
  },
  {
    file: 'legal/security.ts',
    exportPath: 'SECURITY_SECTIONS[3].listItems[0]',
    text: 'Third-party services we use (Vercel, NeonDB, Stripe, Cloudflare, etc.): report directly to those vendors.',
    evidence: [LEGAL_SECURITY_CONTENT],
  },
  {
    file: 'legal/security.ts',
    exportPath: 'SECURITY_SECTIONS[3].listItems[1]',
    text: 'Social-engineering attacks against employees, contractors, or customers.',
    evidence: [LEGAL_SECURITY_CONTENT],
  },
  {
    file: 'legal/security.ts',
    exportPath: 'SECURITY_SECTIONS[3].listItems[2]',
    text: 'Denial-of-service attacks, traffic flooding, or any test that affects availability.',
    evidence: [LEGAL_SECURITY_CONTENT],
  },
  {
    file: 'legal/security.ts',
    exportPath: 'SECURITY_SECTIONS[3].listItems[3]',
    text: 'Vulnerabilities in software you have self-hosted using RevealUI but modified: please report against an unmodified build.',
    evidence: [LEGAL_SECURITY_CONTENT],
  },
  {
    file: 'legal/security.ts',
    exportPath: 'SECURITY_SECTIONS[3].listItems[4]',
    text: 'Findings that require physical access to a device we do not own.',
    evidence: [LEGAL_SECURITY_CONTENT],
  },
  {
    file: 'legal/security.ts',
    exportPath: 'SECURITY_SECTIONS[3].listItems[5]',
    text: 'Reports of missing security headers without a demonstrated exploit.',
    evidence: [LEGAL_SECURITY_CONTENT],
  },
  {
    file: 'legal/security.ts',
    exportPath: 'SECURITY_SECTIONS[3].listItems[6]',
    text: 'Reports based solely on automated-scanner output without manual verification.',
    evidence: [LEGAL_SECURITY_CONTENT],
  },
  {
    file: 'legal/security.ts',
    exportPath: 'SECURITY_SECTIONS[4].listItems[0]',
    text: 'We will not silently fix issues without notifying the reporter when a fix ships.',
    evidence: [LEGAL_SECURITY_CONTENT],
  },
  {
    file: 'legal/security.ts',
    exportPath: 'SECURITY_SECTIONS[4].listItems[1]',
    text: 'We will not delay disclosure indefinitely to avoid embarrassment. We aim to publish a brief notice within 90 days of resolution, or sooner if the issue has been independently disclosed.',
    evidence: [LEGAL_SECURITY_CONTENT],
  },
  {
    file: 'legal/security.ts',
    exportPath: 'SECURITY_SECTIONS[4].listItems[2]',
    text: 'We will not retaliate against researchers who follow this policy.',
    evidence: [LEGAL_SECURITY_CONTENT],
  },
  {
    file: 'legal/security.ts',
    exportPath: 'SECURITY_SECTIONS[5].heading',
    text: '6. Our security posture (summary)',
    evidence: [LEGAL_SECURITY_CONTENT],
  },
  {
    file: 'legal/security.ts',
    exportPath: 'SECURITY_SECTIONS[5].paragraphs[0]',
    text: 'Customers who run RevealUI inherit a security baseline we take seriously. The current posture, in plain English:',
    evidence: [LEGAL_SECURITY_CONTENT],
  },
  {
    file: 'legal/security.ts',
    exportPath: 'SECURITY_SECTIONS[5].listItems[0]',
    text: 'Authentication uses session cookies signed with a server-side secret, with bcrypt password hashing (cost factor 12), brute-force protection, and rate limiting.',
    evidence: [LEGAL_SECURITY_CONTENT, AUTH_SESSIONS],
  },
  {
    file: 'legal/security.ts',
    exportPath: 'SECURITY_SECTIONS[5].listItems[1]',
    text: 'Authorization is enforced by an RBAC + ABAC policy engine with database-level access checks on every collection operation.',
    evidence: [LEGAL_SECURITY_CONTENT, AUTH_SESSIONS, RBAC_ABAC],
  },
  {
    file: 'legal/security.ts',
    exportPath: 'SECURITY_SECTIONS[5].listItems[2]',
    text: 'Encryption for sensitive fields uses AES-256-GCM with non-extractable keys by default.',
    evidence: [
      LEGAL_SECURITY_CONTENT,
      {
        kind: 'code',
        ref: 'packages/security/src',
        note: 'crypto helpers; AES-256-GCM field encryption surface',
      },
    ],
  },
  {
    file: 'legal/security.ts',
    exportPath: 'SECURITY_SECTIONS[5].listItems[3]',
    text: 'Standard browser security headers (CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy) are configured on every deployed app.',
    evidence: [LEGAL_SECURITY_CONTENT],
  },
  {
    file: 'legal/security.ts',
    exportPath: 'SECURITY_SECTIONS[5].listItems[4]',
    text: 'Continuous integration runs CodeQL, Gitleaks, dependency auditing, and an AST-based code-pattern analyzer on every push.',
    evidence: [LEGAL_SECURITY_CONTENT, CI_GATE],
  },
  {
    file: 'legal/security.ts',
    exportPath: 'SECURITY_SECTIONS[5].listItems[5]',
    text: 'GitHub branch protection requires CI passage before merge to main; production deploys are gated on the deploy workflow, not direct pushes.',
    evidence: [LEGAL_SECURITY_CONTENT],
  },
  {
    file: 'legal/security.ts',
    exportPath: 'SECURITY_SECTIONS[5].listItems[6]',
    text: 'Internal security documentation (incident response runbook, information security policy, credential rotation runbook) is maintained alongside this site and available for customer review on request.',
    evidence: [LEGAL_SECURITY_CONTENT],
  },
  {
    file: 'legal/security.ts',
    exportPath: 'SECURITY_SECTIONS[6].paragraphs[0]',
    text: 'RevealUI Studio is a Tennessee LLC operating as a solo-operator company. We do not currently hold SOC 2, ISO 27001, or PCI DSS attestations. These are planned for later phases of the company; we will publish progress on this page when those audits begin.',
    evidence: [LEGAL_SECURITY_CONTENT],
  },
  {
    file: 'legal/security.ts',
    exportPath: 'SECURITY_SECTIONS[6].paragraphs[1]',
    text: 'For data protection: we are GDPR-aware in our framework design (consent, deletion, anonymization primitives are in the platform), but a Data Processing Agreement template is not yet finalized for EU B2B customers. If you require a DPA before purchase, contact us before signing up.',
    evidence: [LEGAL_SECURITY_CONTENT],
  },
  {
    file: 'legal/security.ts',
    exportPath: 'SECURITY_SECTIONS[7].heading',
    text: '8. Machine-readable policy',
    evidence: [LEGAL_SECURITY_CONTENT],
  },
  {
    file: 'legal/security.ts',
    exportPath: 'SECURITY_SECTIONS[7].paragraphs[0]',
    text: 'This policy is also published as an RFC 9116 security.txt file at https://revealui.com/.well-known/security.txt. Automated security tooling should read that file for contact and policy URLs.',
    evidence: [LEGAL_SECURITY_CONTENT],
  },
  {
    file: 'legal/security.ts',
    exportPath: 'SECURITY_SECTIONS[8].paragraphs[0]',
    text: 'We will list researchers here as they are credited. The list is empty today, pre-launch, but we plan to keep it updated as the program runs.',
    evidence: [LEGAL_SECURITY_CONTENT],
  },
  {
    file: 'legal/security.ts',
    exportPath: 'SECURITY_SECTIONS[9].paragraphs[0]',
    text: '(interpolated: SITE email / domain embedded at runtime)',
    match: 'path',
    evidence: [LEGAL_SECURITY_CONTENT],
  },
  {
    file: 'legal/sla.ts',
    exportPath: 'SLA_META.intro',
    text: 'RevealUI Studio is a solo-operated company. We would rather commit to numbers we can hit on our worst week than promise something impressive and miss it. This page states exactly what we commit to today, for whom, and what those commitments do not cover.',
    evidence: [LEGAL_SLA_CONTENT],
  },
  {
    file: 'legal/sla.ts',
    exportPath: 'SLA_SECTIONS[0].listItems[0]',
    text: 'Business hours: we respond within 24 hours, Monday through Friday, 9am to 5pm U.S. Central Time. This excludes weekends and U.S. federal holidays.',
    evidence: [LEGAL_SLA_CONTENT],
  },
  {
    file: 'legal/sla.ts',
    exportPath: 'SLA_SECTIONS[0].listItems[1]',
    text: 'Critical issues: we respond within 4 hours, any day of the week. A critical issue is one where your data is at risk or you are completely unable to use the product you purchased.',
    evidence: [LEGAL_SLA_CONTENT],
  },
  {
    file: 'legal/sla.ts',
    exportPath: 'SLA_SECTIONS[0].paragraphs[0]',
    text: '(interpolated: SITE email / domain embedded at runtime)',
    match: 'path',
    evidence: [LEGAL_SLA_CONTENT],
  },
  {
    file: 'legal/sla.ts',
    exportPath: 'SLA_SECTIONS[1].paragraphs[0]',
    text: 'For the license validation endpoint and the download and release endpoint, we target 99% uptime, measured monthly. That works out to as much as 7.3 hours of downtime in a month before we would consider ourselves out of this commitment. It is a generous floor on purpose: a solo operator needs room for a bad week without breaking a promise, and our actual uptime is typically well above this floor.',
    evidence: [LEGAL_SLA_CONTENT],
  },
  {
    file: 'legal/sla.ts',
    exportPath: 'SLA_SECTIONS[1].paragraphs[1]',
    text: 'If you self-host RevealUI, this uptime commitment covers our infrastructure (license validation, downloads, and updates), not your infrastructure. Your deployment runs on servers you control, and its uptime is your responsibility.',
    evidence: [LEGAL_SLA_CONTENT],
  },
  {
    file: 'legal/sla.ts',
    exportPath: 'SLA_SECTIONS[1].paragraphs[2]',
    text: 'A hosted RevealUI product beyond license and download infrastructure does not yet carry a published uptime commitment. When that changes, this page will say so.',
    evidence: [LEGAL_SLA_CONTENT],
  },
  {
    file: 'legal/sla.ts',
    exportPath: 'SLA_SECTIONS[2].paragraphs[0]',
    text: 'When we need to take infrastructure down for planned maintenance, we give at least 48 hours of advance notice by email to affected customers and on our status page.',
    evidence: [
      LEGAL_SLA_CONTENT,
      {
        kind: 'url',
        ref: 'https://status.revealui.com',
        note: 'public status page for hosted surfaces',
      },
    ],
  },
  {
    file: 'legal/sla.ts',
    exportPath: 'SLA_SECTIONS[3].heading',
    text: '4. What happens if our license service is down',
    evidence: [LEGAL_SLA_CONTENT],
  },
  {
    file: 'legal/sla.ts',
    exportPath: 'SLA_SECTIONS[3].paragraphs[0]',
    text: 'If a self-hosted installation cannot reach our license validation service, your previously validated license keeps working for 7 days while we fix the outage. Full detail on every license grace period lives in our Terms of Service.',
    evidence: [LEGAL_SLA_CONTENT],
  },
  {
    file: 'legal/sla.ts',
    exportPath: 'SLA_SECTIONS[4].heading',
    text: '5. Why these numbers and not bigger ones',
    evidence: [LEGAL_SLA_CONTENT],
  },
  {
    file: 'legal/sla.ts',
    exportPath: 'SLA_SECTIONS[4].paragraphs[0]',
    text: 'We are one person. There is no on-call rotation and no second engineer to page. A 24-hour response and a 99% uptime floor are numbers we can hold even through a sick week or a vacation. As the team grows, these commitments tighten, not the other way around. Being the solo-operated version of a promise you can trust is worth more to us than the impressive-sounding version we might quietly miss.',
    evidence: [LEGAL_SLA_CONTENT],
  },
  {
    file: 'legal/sla.ts',
    exportPath: 'SLA_SECTIONS[5].heading',
    text: '6. Status and live updates',
    evidence: [
      LEGAL_SLA_CONTENT,
      {
        kind: 'url',
        ref: 'https://status.revealui.com',
        note: 'public status page for hosted surfaces',
      },
    ],
  },
  {
    file: 'legal/sla.ts',
    exportPath: 'SLA_SECTIONS[5].paragraphs[0]',
    text: 'Real-time status for revealui.com, admin.revealui.com, api.revealui.com, and docs.revealui.com is published at https://revealui.com/status.',
    evidence: [
      LEGAL_SLA_CONTENT,
      {
        kind: 'url',
        ref: 'https://status.revealui.com',
        note: 'public status page for hosted surfaces',
      },
    ],
  },
  {
    file: 'legal/sla.ts',
    exportPath: 'SLA_SECTIONS[6].paragraphs[0]',
    text: '(interpolated: SITE email / domain embedded at runtime)',
    match: 'path',
    evidence: [LEGAL_SLA_CONTENT],
  },
  {
    file: 'legal/subprocessors.ts',
    exportPath: 'SUBPROCESSORS[0].role',
    text: 'Application hosting (marketing, admin, API, docs)',
    evidence: [LEGAL_SUBPROCESSORS_CONTENT],
  },
  {
    file: 'legal/subprocessors.ts',
    exportPath: 'SUBPROCESSORS[0].location',
    text: 'United States (primary: us-east-1)',
    evidence: [LEGAL_SUBPROCESSORS_CONTENT],
  },
  {
    file: 'legal/subprocessors.ts',
    exportPath: 'SUBPROCESSORS[0].dataCategories[2]',
    text: 'Edge logs (IP, user agent, request path)',
    evidence: [LEGAL_SUBPROCESSORS_CONTENT],
  },
  {
    file: 'legal/subprocessors.ts',
    exportPath: 'SUBPROCESSORS[0].dataCategories[3]',
    text: 'Speed Insights telemetry (anonymous)',
    evidence: [LEGAL_SUBPROCESSORS_CONTENT],
  },
  {
    file: 'legal/subprocessors.ts',
    exportPath: 'SUBPROCESSORS[1].role',
    text: 'PostgreSQL database (primary store)',
    evidence: [LEGAL_SUBPROCESSORS_CONTENT, POSTGRES],
  },
  {
    file: 'legal/subprocessors.ts',
    exportPath: 'SUBPROCESSORS[1].location',
    text: 'United States (primary: us-east-1)',
    evidence: [LEGAL_SUBPROCESSORS_CONTENT],
  },
  {
    file: 'legal/subprocessors.ts',
    exportPath: 'SUBPROCESSORS[2].role',
    text: 'Object storage (media uploads, generated assets)',
    evidence: [LEGAL_SUBPROCESSORS_CONTENT],
  },
  {
    file: 'legal/subprocessors.ts',
    exportPath: 'SUBPROCESSORS[3].role',
    text: 'Payment processing (subscriptions, perpetual licenses, refunds)',
    evidence: [LEGAL_SUBPROCESSORS_CONTENT],
  },
  {
    file: 'legal/subprocessors.ts',
    exportPath: 'SUBPROCESSORS[3].location',
    text: 'United States (PCI DSS Level 1)',
    evidence: [LEGAL_SUBPROCESSORS_CONTENT],
  },
  {
    file: 'legal/subprocessors.ts',
    exportPath: 'SUBPROCESSORS[3].dataCategories[0]',
    text: 'Billing identity (name, email, billing address)',
    evidence: [LEGAL_SUBPROCESSORS_CONTENT],
  },
  {
    file: 'legal/subprocessors.ts',
    exportPath: 'SUBPROCESSORS[4].role',
    text: 'Transactional email delivery (receipts, license keys, support)',
    evidence: [LEGAL_SUBPROCESSORS_CONTENT],
  },
  {
    file: 'legal/subprocessors.ts',
    exportPath: 'SUBPROCESSORS[4].dataCategories[1]',
    text: 'Message content for delivery',
    evidence: [LEGAL_SUBPROCESSORS_CONTENT],
  },
  {
    file: 'legal/subprocessors.ts',
    exportPath: 'SUBPROCESSORS_CHANGELOG[0].summary',
    text: "Corrected NeonDB's data categories: removed 'audit logs'. Production audit-log storage does not persist to Postgres today, so listing it as a stored data category was inaccurate.",
    evidence: [LEGAL_SUBPROCESSORS_CONTENT, POSTGRES, AUDIT_LOG_SCHEMA],
  },
  {
    file: 'legal/subprocessors.ts',
    exportPath: 'SUBPROCESSORS_CHANGELOG[1].summary',
    text: 'Initial published list: Vercel, NeonDB, Cloudflare R2, Stripe, Google Workspace. Sentry is listed in the Privacy Policy as an anticipated subprocessor for error tracking; it will appear here once the SDK is wired and a DSN is configured.',
    evidence: [LEGAL_SUBPROCESSORS_CONTENT, BILLING, POSTGRES],
  },
  {
    file: 'legal/subprocessors.ts',
    exportPath: 'SUBPROCESSORS_META.intro',
    text: 'A subprocessor is a third-party service we use to operate RevealUI on your behalf. Every entry below stores, processes, or transmits some category of customer data. The table is dated and we commit to updating it before adding a new subprocessor, not after. See the change-log at the bottom of this page.',
    evidence: [LEGAL_SUBPROCESSORS_CONTENT],
  },
  {
    file: 'legal/subprocessors.ts',
    exportPath: 'SUBPROCESSORS_NOTES.subscribeAdvice',
    text: 'There is no subscribe-to-changes channel for this page yet. Material customers can request notification by email and we will email them when an entry is added. Watch the RevealUI repository on GitHub to receive a notification when this file changes in source.',
    evidence: [LEGAL_SUBPROCESSORS_CONTENT],
  },
  {
    file: 'legal/subprocessors.ts',
    exportPath: 'SUBPROCESSORS_NOTES.contactPrefix',
    text: 'Questions about a specific subprocessor (including its DPA, regional data handling, or sub-processors of its own) should go to ',
    evidence: [LEGAL_SUBPROCESSORS_CONTENT],
  },
  {
    file: 'legal/support.ts',
    exportPath: 'SUPPORT_META.intro',
    text: 'RevealUI Studio is a solo-operator company. We want to help you succeed with RevealUI, and we want to be honest about what kind of help we can offer, on what timeline, and through which channels. This page covers all three.',
    evidence: [LEGAL_SUPPORT_CONTENT],
  },
  {
    file: 'legal/support.ts',
    exportPath: 'SUPPORT_SECTIONS[0].listPreamble',
    text: 'Different questions land best in different places. In rough order of speed:',
    evidence: [LEGAL_SUPPORT_CONTENT],
  },
  {
    file: 'legal/support.ts',
    exportPath: 'SUPPORT_SECTIONS[0].listItems[0]',
    text: '**Documentation** at https://docs.revealui.com: covers setup, configuration, the API surface, and most "how do I do X with RevealUI" questions. Always check here first; if the answer is there, you have it now instead of waiting on an email reply.',
    evidence: [LEGAL_SUPPORT_CONTENT],
  },
  {
    file: 'legal/support.ts',
    exportPath: 'SUPPORT_SECTIONS[0].listItems[1]',
    text: '**GitHub Discussions** at https://github.com/RevealUIStudio/revealui/discussions: community-friendly format for design questions, "is there a better way to do X", and ideas. Other users and the maintainer both watch this. Best for questions where a public answer benefits more than just you.',
    evidence: [LEGAL_SUPPORT_CONTENT],
  },
  {
    file: 'legal/support.ts',
    exportPath: 'SUPPORT_SECTIONS[0].listItems[2]',
    text: '**GitHub Issues** at https://github.com/RevealUIStudio/revealui/issues: for confirmed bugs and feature requests. Include reproduction steps. See §5 below for "bug vs support" guidance.',
    evidence: [LEGAL_SUPPORT_CONTENT],
  },
  {
    file: 'legal/support.ts',
    exportPath: 'SUPPORT_SECTIONS[0].listItems[3]',
    text: '(interpolated: SITE email / domain embedded at runtime)',
    match: 'path',
    evidence: [LEGAL_SUPPORT_CONTENT],
  },
  {
    file: 'legal/support.ts',
    exportPath: 'SUPPORT_SECTIONS[1].paragraphs[0]',
    text: '(interpolated: SITE email / domain embedded at runtime)',
    match: 'path',
    evidence: [LEGAL_SUPPORT_CONTENT, LEGAL_SLA_CONTENT],
  },
  {
    file: 'legal/support.ts',
    exportPath: 'SUPPORT_SECTIONS[1].paragraphs[1]',
    text: 'GitHub Issues and Discussions: best-effort. We read them, but we may not respond instantly. If something is urgent, email is the right channel.',
    evidence: [LEGAL_SUPPORT_CONTENT],
  },
  {
    file: 'legal/support.ts',
    exportPath: 'SUPPORT_SECTIONS[1].paragraphs[2]',
    text: 'Security reports: see the dedicated security policy at https://revealui.com/security. Those go to a separate address with a separate response commitment.',
    evidence: [LEGAL_SUPPORT_CONTENT],
  },
  {
    file: 'legal/support.ts',
    exportPath: 'SUPPORT_SECTIONS[2].listItems[0]',
    text: 'Setup and installation issues with `create-revealui` and the published packages',
    evidence: [LEGAL_SUPPORT_CONTENT],
  },
  {
    file: 'legal/support.ts',
    exportPath: 'SUPPORT_SECTIONS[2].listItems[1]',
    text: 'Configuration questions about the admin engine, auth, billing integration, or AI agents',
    evidence: [LEGAL_SUPPORT_CONTENT],
  },
  {
    file: 'legal/support.ts',
    exportPath: 'SUPPORT_SECTIONS[2].listItems[2]',
    text: 'License key issues (lost keys, transfer, downgrade, refund within window)',
    evidence: [LEGAL_SUPPORT_CONTENT],
  },
  {
    file: 'legal/support.ts',
    exportPath: 'SUPPORT_SECTIONS[2].listItems[3]',
    text: 'Bugs in the published RevealUI source code (OSS and Pro packages)',
    evidence: [LEGAL_SUPPORT_CONTENT],
  },
  {
    file: 'legal/support.ts',
    exportPath: 'SUPPORT_SECTIONS[2].listItems[4]',
    text: 'Questions about the documented API surface',
    evidence: [LEGAL_SUPPORT_CONTENT],
  },
  {
    file: 'legal/support.ts',
    exportPath: 'SUPPORT_SECTIONS[2].listItems[5]',
    text: 'Account changes, plan changes, and cancellations',
    evidence: [LEGAL_SUPPORT_CONTENT],
  },
  {
    file: 'legal/support.ts',
    exportPath: 'SUPPORT_SECTIONS[2].listItems[6]',
    text: 'Genuine "is RevealUI the right tool for X" pre-purchase questions',
    evidence: [LEGAL_SUPPORT_CONTENT],
  },
  {
    file: 'legal/support.ts',
    exportPath: 'SUPPORT_SECTIONS[3].heading',
    text: '4. What we cannot help with',
    evidence: [LEGAL_SUPPORT_CONTENT],
  },
  {
    file: 'legal/support.ts',
    exportPath: 'SUPPORT_SECTIONS[3].paragraphs[0]',
    text: 'We need to be honest about scope. A solo-operator support model only works if we say "no" to the things that would consume all our time without serving customers fairly.',
    evidence: [LEGAL_SUPPORT_CONTENT],
  },
  {
    file: 'legal/support.ts',
    exportPath: 'SUPPORT_SECTIONS[3].listItems[0]',
    text: 'We do not write your application code for you. RevealUI is a framework; you build with it.',
    evidence: [LEGAL_SUPPORT_CONTENT],
  },
  {
    file: 'legal/support.ts',
    exportPath: 'SUPPORT_SECTIONS[3].listItems[1]',
    text: 'We do not review private codebases line by line. Public GitHub repos we can sometimes glance at; private repos require an Enterprise engagement (see Pricing).',
    evidence: [LEGAL_SUPPORT_CONTENT],
  },
  {
    file: 'legal/support.ts',
    exportPath: 'SUPPORT_SECTIONS[3].listItems[2]',
    text: 'We do not debug deployments to specific hosting environments (Kubernetes clusters, exotic Docker setups, customer VPNs) beyond the documented Vercel / Fly / Hetzner / Docker paths.',
    evidence: [LEGAL_SUPPORT_CONTENT],
  },
  {
    file: 'legal/support.ts',
    exportPath: 'SUPPORT_SECTIONS[3].listItems[3]',
    text: 'We cannot recover data from a self-hosted instance that has been lost. We do not have access to your database. Always maintain your own backups.',
    evidence: [LEGAL_SUPPORT_CONTENT],
  },
  {
    file: 'legal/support.ts',
    exportPath: 'SUPPORT_SECTIONS[3].listItems[4]',
    text: 'We do not provide free architectural consulting outside the documented patterns. Track D professional services (when published) is the right channel for that.',
    evidence: [LEGAL_SUPPORT_CONTENT],
  },
  {
    file: 'legal/support.ts',
    exportPath: 'SUPPORT_SECTIONS[3].listItems[5]',
    text: 'We do not provide live phone or video support at the Pro tier. Email-and-async only.',
    evidence: [LEGAL_SUPPORT_CONTENT],
  },
  {
    file: 'legal/support.ts',
    exportPath: 'SUPPORT_SECTIONS[4].heading',
    text: '5. When to file a bug vs ask for support',
    evidence: [LEGAL_SUPPORT_CONTENT],
  },
  {
    file: 'legal/support.ts',
    exportPath: 'SUPPORT_SECTIONS[4].listPreamble',
    text: 'A useful rule of thumb when deciding where to take an issue:',
    evidence: [LEGAL_SUPPORT_CONTENT],
  },
  {
    file: 'legal/support.ts',
    exportPath: 'SUPPORT_SECTIONS[4].listItems[0]',
    text: '**File a bug** (GitHub Issue) when: the documented behavior does not match the actual behavior; you have a reliable reproduction; the issue would affect other users; the fix probably lives in the public source code.',
    evidence: [LEGAL_SUPPORT_CONTENT],
  },
  {
    file: 'legal/support.ts',
    exportPath: 'SUPPORT_SECTIONS[4].listItems[1]',
    text: '(interpolated: SITE email / domain embedded at runtime)',
    match: 'path',
    evidence: [LEGAL_SUPPORT_CONTENT],
  },
  {
    file: 'legal/support.ts',
    exportPath: 'SUPPORT_SECTIONS[4].listItems[2]',
    text: '**Open a Discussion** when: you are not sure if it is a bug; you want input from the community; you want to influence the roadmap.',
    evidence: [LEGAL_SUPPORT_CONTENT],
  },
  {
    file: 'legal/support.ts',
    exportPath: 'SUPPORT_SECTIONS[5].paragraphs[0]',
    text: 'Live status of revealui.com, admin.revealui.com, api.revealui.com, and docs.revealui.com is published at https://revealui.com/status with a live probe of the API health endpoint and an honest disclosure of our monitoring posture (we are a solo-operator company; we do not run 24×7 manned monitoring).',
    evidence: [
      LEGAL_SUPPORT_CONTENT,
      {
        kind: 'url',
        ref: 'https://status.revealui.com',
        note: 'public status page for hosted surfaces',
      },
    ],
  },
  {
    file: 'legal/support.ts',
    exportPath: 'SUPPORT_SECTIONS[5].paragraphs[1]',
    text: 'If you are experiencing an outage that the status page does not yet reflect, email support and include the surface you are hitting and the time you first saw the issue.',
    evidence: [
      LEGAL_SUPPORT_CONTENT,
      {
        kind: 'url',
        ref: 'https://status.revealui.com',
        note: 'public status page for hosted surfaces',
      },
    ],
  },
  {
    file: 'legal/support.ts',
    exportPath: 'SUPPORT_SECTIONS[6].paragraphs[0]',
    text: 'Today, every paid tier gets the same response commitment described in §2 and on our SLA page: 24 hours during business hours, 4 hours for a critical issue. We do not yet offer a faster tiered SLA, and we would rather tell you that plainly than promise a tier we cannot staff as a solo operator.',
    evidence: [LEGAL_SUPPORT_CONTENT, LEGAL_SLA_CONTENT],
  },
  {
    file: 'legal/support.ts',
    exportPath: 'SUPPORT_SECTIONS[6].paragraphs[1]',
    text: 'Enterprise customers who need a dedicated Slack channel, a named technical contact, or scheduled architecture reviews should contact us before purchase to confirm scope and timeline.',
    evidence: [LEGAL_SUPPORT_CONTENT, LEGAL_SLA_CONTENT],
  },
  {
    file: 'legal/support.ts',
    exportPath: 'SUPPORT_SECTIONS[7].paragraphs[0]',
    text: '(interpolated: SITE email / domain embedded at runtime)',
    match: 'path',
    evidence: [LEGAL_SUPPORT_CONTENT],
  },
  {
    file: 'legal/terms.ts',
    exportPath: 'TERMS_META.intro',
    text: 'These Terms of Service ("Terms") govern your use of the RevealUI platform provided by REVEALUI STUDIO L.L.C., a Tennessee limited liability company ("we", "us", "our"). By creating an account or using the Service, you agree to these Terms.',
    evidence: [LEGAL_TERMS_CONTENT],
  },
  {
    file: 'legal/terms.ts',
    exportPath: 'TERMS_SECTIONS[0].paragraphs[0]',
    text: 'RevealUI is an open-source agentic business runtime for software companies. It includes a content engine, authentication, billing integration, AI agents, and UI components. The Service is available in four tiers: Free (OSS), Pro, Max, and Enterprise.',
    evidence: [LEGAL_TERMS_CONTENT],
  },
  {
    file: 'legal/terms.ts',
    exportPath: 'TERMS_SECTIONS[1].listItems[0]',
    text: 'You must provide accurate information when creating an account.',
    evidence: [LEGAL_TERMS_CONTENT],
  },
  {
    file: 'legal/terms.ts',
    exportPath: 'TERMS_SECTIONS[1].listItems[1]',
    text: 'You are responsible for maintaining the security of your account credentials.',
    evidence: [LEGAL_TERMS_CONTENT],
  },
  {
    file: 'legal/terms.ts',
    exportPath: 'TERMS_SECTIONS[1].listItems[2]',
    text: 'You must be at least 13 years old to use the Service.',
    evidence: [LEGAL_TERMS_CONTENT],
  },
  {
    file: 'legal/terms.ts',
    exportPath: 'TERMS_SECTIONS[1].listItems[3]',
    text: 'One person or organization may not maintain more than one free account.',
    evidence: [LEGAL_TERMS_CONTENT],
  },
  {
    file: 'legal/terms.ts',
    exportPath: 'TERMS_SECTIONS[2].paragraphs[0]',
    text: 'The Free tier is licensed under the MIT License. You may use, modify, and distribute the open-source code freely, subject to the MIT License terms. The Free tier includes limited features (1 site, 3 users, community support).',
    evidence: [LEGAL_TERMS_CONTENT],
  },
  {
    file: 'legal/terms.ts',
    exportPath: 'TERMS_SECTIONS[3].heading',
    text: '4. Paid Tiers (Pro, Max & Enterprise)',
    evidence: [LEGAL_TERMS_CONTENT],
  },
  {
    file: 'legal/terms.ts',
    exportPath: 'TERMS_SECTIONS[3].subsections[0].listItems[0]',
    text: 'Subscription prices for Pro, Max, and Enterprise are as published at https://revealui.com/pricing at the time of purchase, in U.S. dollars and exclusive of applicable taxes. You will see the price you agree to before completing checkout.',
    evidence: [LEGAL_TERMS_CONTENT],
  },
  {
    file: 'legal/terms.ts',
    exportPath: 'TERMS_SECTIONS[3].subsections[0].listItems[1]',
    text: 'Pro and Max include a 7-day free trial. Enterprise pricing is published with the option to contact sales for annual rates.',
    evidence: [LEGAL_TERMS_CONTENT],
  },
  {
    file: 'legal/terms.ts',
    exportPath: 'TERMS_SECTIONS[3].subsections[0].listItems[2]',
    text: "Payment is processed by Stripe. You agree to Stripe's terms of service when you complete checkout.",
    evidence: [LEGAL_TERMS_CONTENT],
  },
  {
    file: 'legal/terms.ts',
    exportPath: 'TERMS_SECTIONS[3].subsections[1].paragraph',
    text: 'The Pro and Max tiers include a 7-day free trial. You will not be charged during the trial period. If you do not cancel before the trial ends, your subscription will automatically begin and you will be charged the applicable monthly rate.',
    evidence: [LEGAL_TERMS_CONTENT],
  },
  {
    file: 'legal/terms.ts',
    exportPath: 'TERMS_SECTIONS[3].subsections[2].paragraph',
    text: 'You may cancel your subscription at any time through the Stripe billing portal or by contacting us. Cancellation takes effect at the end of your current billing period. You retain access to paid features until then.',
    evidence: [LEGAL_TERMS_CONTENT],
  },
  {
    file: 'legal/terms.ts',
    exportPath: 'TERMS_SECTIONS[3].subsections[3].paragraph',
    text: '(interpolated: SITE email / domain embedded at runtime)',
    match: 'path',
    evidence: [LEGAL_TERMS_CONTENT, REFUND_ROUTE],
  },
  {
    file: 'legal/terms.ts',
    exportPath: 'TERMS_SECTIONS[3].subsections[4].heading',
    text: 'License continuity and grace periods',
    evidence: [LEGAL_TERMS_CONTENT],
  },
  {
    file: 'legal/terms.ts',
    exportPath: 'TERMS_SECTIONS[3].subsections[4].listItems[0]',
    text: 'If your subscription expires (Pro or Max): we grant a 3-day grace period during which paid features remain available. After the grace period, your account reverts to the free tier; your data is retained and your account is not deleted.',
    evidence: [LEGAL_TERMS_CONTENT],
  },
  {
    file: 'legal/terms.ts',
    exportPath: 'TERMS_SECTIONS[3].subsections[4].listItems[1]',
    text: 'If a perpetual-license support renewal lapses: we grant a 30-day grace period during which paid features remain available. After the grace period, your installation enters read-only mode: you keep full access to your existing data and content, but new Pro features and updates are paused until renewal. You will never lose access to your own data because a support renewal lapsed.',
    evidence: [LEGAL_TERMS_CONTENT],
  },
  {
    file: 'legal/terms.ts',
    exportPath: 'TERMS_SECTIONS[3].subsections[4].listItems[2]',
    text: 'If our license-verification service is unreachable from your installation (vendor-side outage on our end): we grant a 7-day grace period during which your previously-validated license remains in effect. After the grace period, your installation reverts to free-tier behavior until our service is reachable again. You will not be charged for the outage and you can reach out to support for a credit.',
    evidence: [LEGAL_TERMS_CONTENT],
  },
  {
    file: 'legal/terms.ts',
    exportPath: 'TERMS_SECTIONS[3].subsections[4].listItems[3]',
    text: 'License revocation (chargeback, terms violation): we will revoke immediately and the grace periods above do not apply.',
    evidence: [LEGAL_TERMS_CONTENT],
  },
  {
    file: 'legal/terms.ts',
    exportPath: 'TERMS_SECTIONS[3].subsections[4].listItems[4]',
    text: 'Invalid or missing license key: paid features remain unavailable until a valid key is configured; grace periods do not apply because no entitlement has been established.',
    evidence: [LEGAL_TERMS_CONTENT],
  },
  {
    file: 'legal/terms.ts',
    exportPath: 'TERMS_SECTIONS[4].paragraphs[0]',
    text: 'Pro packages (@revealui/ai, @revealui/engines, @revealui/harnesses, @revealui/mcp, @revealui/services) are commercially licensed. The license is granted per-subscription and is non-transferable. See LICENSE.commercial in the repository for full terms.',
    evidence: [LEGAL_TERMS_CONTENT],
  },
  {
    file: 'legal/terms.ts',
    exportPath: 'TERMS_SECTIONS[5].listItems[0]',
    text: 'Use the Service for any unlawful purpose',
    evidence: [LEGAL_TERMS_CONTENT],
  },
  {
    file: 'legal/terms.ts',
    exportPath: 'TERMS_SECTIONS[5].listItems[1]',
    text: 'Attempt to gain unauthorized access to the Service or its infrastructure',
    evidence: [LEGAL_TERMS_CONTENT],
  },
  {
    file: 'legal/terms.ts',
    exportPath: 'TERMS_SECTIONS[5].listItems[2]',
    text: 'Distribute malware, spam, or harmful content through the Service',
    evidence: [LEGAL_TERMS_CONTENT],
  },
  {
    file: 'legal/terms.ts',
    exportPath: 'TERMS_SECTIONS[5].listItems[3]',
    text: 'Exceed reasonable usage limits or abuse API rate limits',
    evidence: [LEGAL_TERMS_CONTENT],
  },
  {
    file: 'legal/terms.ts',
    exportPath: 'TERMS_SECTIONS[5].listItems[4]',
    text: 'Resell Pro/Max/Enterprise features without a valid license',
    evidence: [LEGAL_TERMS_CONTENT],
  },
  {
    file: 'legal/terms.ts',
    exportPath: 'TERMS_SECTIONS[5].listItems[5]',
    text: 'Reverse-engineer, decompile, or circumvent license key validation',
    evidence: [LEGAL_TERMS_CONTENT],
  },
  {
    file: 'legal/terms.ts',
    exportPath: 'TERMS_SECTIONS[5].paragraphs[0]',
    text: 'We reserve the right to suspend or terminate accounts that violate these terms.',
    evidence: [LEGAL_TERMS_CONTENT],
  },
  {
    file: 'legal/terms.ts',
    exportPath: 'TERMS_SECTIONS[6].listItems[0]',
    text: 'You retain ownership of all content you create using the Service.',
    evidence: [LEGAL_TERMS_CONTENT],
  },
  {
    file: 'legal/terms.ts',
    exportPath: 'TERMS_SECTIONS[6].listItems[1]',
    text: 'We do not claim any intellectual property rights over your content.',
    evidence: [LEGAL_TERMS_CONTENT],
  },
  {
    file: 'legal/terms.ts',
    exportPath: 'TERMS_SECTIONS[6].listItems[2]',
    text: 'You are responsible for maintaining backups of your data. While we use reliable hosting providers, we do not guarantee against data loss.',
    evidence: [LEGAL_TERMS_CONTENT],
  },
  {
    file: 'legal/terms.ts',
    exportPath: 'TERMS_SECTIONS[6].listItems[3]',
    text: 'For self-hosted deployments, you are responsible for your own data security and compliance.',
    evidence: [LEGAL_TERMS_CONTENT],
  },
  {
    file: 'legal/terms.ts',
    exportPath: 'TERMS_SECTIONS[7].paragraphs[0]',
    text: 'We strive for high availability but do not guarantee uninterrupted service. The Service is provided "as is" without warranty of any kind, express or implied. We are not liable for any downtime, data loss, or damages resulting from use of the Service.',
    evidence: [LEGAL_TERMS_CONTENT],
  },
  {
    file: 'legal/terms.ts',
    exportPath: 'TERMS_SECTIONS[8].heading',
    text: '9. Limitation of Liability',
    evidence: [LEGAL_TERMS_CONTENT],
  },
  {
    file: 'legal/terms.ts',
    exportPath: 'TERMS_SECTIONS[8].paragraphs[0]',
    text: 'To the maximum extent permitted by law, REVEALUI STUDIO L.L.C. shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, data, or business opportunities. Our total liability under these Terms shall not exceed the amount paid by you to us in the 12 months preceding the claim.',
    evidence: [LEGAL_TERMS_CONTENT],
  },
  {
    file: 'legal/terms.ts',
    exportPath: 'TERMS_SECTIONS[9].paragraphs[0]',
    text: 'We may update these Terms from time to time. We will notify registered users of material changes via email at least 30 days before they take effect. Continued use of the Service after changes take effect constitutes acceptance of the new Terms.',
    evidence: [LEGAL_TERMS_CONTENT],
  },
  {
    file: 'legal/terms.ts',
    exportPath: 'TERMS_SECTIONS[10].paragraphs[0]',
    text: 'These Terms are governed by the laws of the State of Tennessee, United States, without regard to its conflict-of-laws provisions. Any disputes shall be resolved in the state or federal courts located in Tennessee.',
    evidence: [LEGAL_TERMS_CONTENT],
  },
  {
    file: 'legal/terms.ts',
    exportPath: 'TERMS_SECTIONS[11].paragraphs[0]',
    text: '(interpolated: SITE email / domain embedded at runtime)',
    match: 'path',
    evidence: [LEGAL_TERMS_CONTENT],
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
