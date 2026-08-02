import type { EvidenceRef } from './types.js';

export const AUTH_SESSIONS: EvidenceRef = {
  kind: 'code',
  ref: 'packages/auth/src/server/auth.ts',
  note: 'session creation + sign-in/sign-up flows',
};
export const RBAC_ABAC: EvidenceRef = {
  kind: 'code',
  ref: 'packages/security/src/authorization.ts',
  note: 'RBAC + ABAC policy engine; enforcement tests at packages/core/src/__tests__/auth/',
};
export const COLLECTIONS: EvidenceRef = {
  kind: 'code',
  ref: 'apps/admin/src/lib/collections',
  note: 'collection definitions drive the admin UI + REST API; engine at packages/core/src/collections',
};
export const BILLING: EvidenceRef = {
  kind: 'code',
  ref: 'apps/server/src/routes/billing.ts',
  note: 'Stripe checkout, subscription, portal routes',
};
export const WEBHOOKS: EvidenceRef = {
  kind: 'code',
  ref: 'apps/server/src/routes/webhooks.ts',
  note: 'signature-verified Stripe webhook processing',
};
export const RECONCILE: EvidenceRef = {
  kind: 'code',
  ref: 'apps/server/src/routes/cron/reconcile-subscriptions.ts',
  note: 'reconciliation crons; siblings reconcile-stripe-subscriptions.ts + drain-unreconciled.ts',
};
export const MCP_CONTENT: EvidenceRef = {
  kind: 'code',
  ref: 'packages/mcp/src/servers/factories/revealui-content.ts',
  note: 'generic content tools; collections as MCP resources when mcpResource !== false',
};
export const MCP_RESOURCE_DEFAULT: EvidenceRef = {
  kind: 'code',
  ref: 'apps/admin/src/lib/mcp/collections.ts',
  note: 'mcpResource defaults to true (collection.mcpResource !== false); opt out with false',
};
export const TIER_GATES: EvidenceRef = {
  kind: 'code',
  ref: 'apps/server/src/middleware/entitlements.ts',
  note: 'per-account tier resolution; AI routes gated in entitlements mode in apps/server/src/index.ts',
};
export const OPEN_WEIGHT: EvidenceRef = {
  kind: 'code',
  ref: 'apps/server/src/middleware/license.ts',
  note: 'requireAIAccess free-tier local-inference path (OLLAMA_BASE_URL / INFERENCE_SNAPS_BASE_URL)',
};
export const PROVIDERS: EvidenceRef = {
  kind: 'code',
  ref: 'packages/ai/src/llm/providers',
  note: 'provider adapters; open-weight default via ollama.ts + inference/',
};
export const CLI_CREATE: EvidenceRef = {
  kind: 'command',
  ref: 'npx create-revealui@latest my-app',
  note: 'scaffolder at packages/cli; the 60-second figure is a timed claim, re-verify per release',
};
export const LICENSE_MIT: EvidenceRef = {
  kind: 'code',
  ref: 'LICENSE',
  note: 'root MIT license; per-package FSL-1.1-MIT files in the 5 Pro packages',
};
export const LICENSE_SPLIT: EvidenceRef = {
  kind: 'metric',
  ref: 'scripts/validate/claim-drift.ts',
  note: 'licenseSplit 23 MIT + 5 FSL + 2 internal, pinned by the claim-drift gate',
};
export const SELF_HOST: EvidenceRef = {
  kind: 'code',
  ref: 'docs/guides/deployment.md',
  note: 'self-host deployment guide; plain Node bundle, no vendor edge runtime',
};
export const REPO: EvidenceRef = {
  kind: 'url',
  ref: 'https://github.com/RevealUIStudio/revealui',
  note: 'the entire runtime is in the public repo',
};
export const CI_GATE: EvidenceRef = {
  kind: 'code',
  ref: 'scripts/gates/ci-gate.ts',
  note: 'local 3-phase gate: Biome, typecheck, Vitest, build; CodeQL, Gitleaks, and Playwright e2e jobs in .github/workflows/ci.yml',
};
export const AUDIT_SIGNING: EvidenceRef = {
  kind: 'code',
  ref: 'packages/security/src/audit-signing.ts',
  note: 'Ed25519AuditRowSigner signs each row over RFC 8785 canonical bytes (GAP-355 Stage 3)',
};
export const AUDIT_SIGNING_TEST: EvidenceRef = {
  kind: 'test',
  ref: 'apps/server/src/lib/__tests__/audit-signing-roundtrip.pglite.test.ts#a canonically-signed row verifies OFFLINE after the jsonb + timestamptz round trip',
  note: 'production-path proof: signed row verifies offline from jsonb + timestamptz readback using only the public key',
};
export const AUDIT_PUBLIC_KEY_ROUTE: EvidenceRef = {
  kind: 'code',
  ref: 'apps/server/src/routes/audit.ts',
  note: 'GET /api/audit/public-key publishes the offline-verify key (prod 200 verified 2026-08-02)',
};
// Legal / contact pages: the published content module is the public policy
// artifact. Technical sentences below add code refs when they assert product
// behavior; the content ref always remains for the policy restatement.
export const LEGAL_CONTACT_CONTENT: EvidenceRef = {
  kind: 'code',
  ref: 'apps/marketing/app/content/contact.ts',
  note: 'contact page copy; rendered by apps/marketing/app/routes/ContactPage.tsx',
};
export const LEGAL_PRIVACY_CONTENT: EvidenceRef = {
  kind: 'code',
  ref: 'apps/marketing/app/content/legal/privacy.ts',
  note: 'published Privacy Policy; rendered by PrivacyPage.tsx',
};
export const LEGAL_REFUND_CONTENT: EvidenceRef = {
  kind: 'code',
  ref: 'apps/marketing/app/content/legal/refund-policy.ts',
  note: 'published refund policy; sourced from .jv refund-window ADR; RefundPolicyPage.tsx',
};
export const LEGAL_SECURITY_CONTENT: EvidenceRef = {
  kind: 'code',
  ref: 'apps/marketing/app/content/legal/security.ts',
  note: 'published security page; rendered by SecurityPage.tsx',
};
export const LEGAL_SLA_CONTENT: EvidenceRef = {
  kind: 'code',
  ref: 'apps/marketing/app/content/legal/sla.ts',
  note: 'published SLA; sourced from .jv sla-target ADR; SlaPage.tsx',
};
export const LEGAL_SUBPROCESSORS_CONTENT: EvidenceRef = {
  kind: 'code',
  ref: 'apps/marketing/app/content/legal/subprocessors.ts',
  note: 'published subprocessors list; SubprocessorsPage.tsx',
};
export const LEGAL_SUPPORT_CONTENT: EvidenceRef = {
  kind: 'code',
  ref: 'apps/marketing/app/content/legal/support.ts',
  note: 'published support page; SupportPage.tsx',
};
export const LEGAL_TERMS_CONTENT: EvidenceRef = {
  kind: 'code',
  ref: 'apps/marketing/app/content/legal/terms.ts',
  note: 'published Terms of Service; TermsPage.tsx',
};
export const TRIAL: EvidenceRef = {
  kind: 'code',
  ref: 'apps/server/src/routes/billing.ts',
  note: 'default trial period for new subscriptions (DEFAULT_TRIAL_DAYS)',
};
export const TIER_LIMITS: EvidenceRef = {
  kind: 'code',
  ref: 'apps/server/src/lib/tier-limits.ts',
  note: 'pro maxAgentTasks 10_000; free 1_000',
};
export const X402: EvidenceRef = {
  kind: 'code',
  ref: 'apps/server/src/middleware/x402.ts',
  note: 'HTTP 402 payment middleware; rails in development per the roadmap',
};
export const MEMORY: EvidenceRef = {
  kind: 'code',
  ref: 'packages/ai/src/memory',
  note: 'CRDT agent memory',
};
export const AGENT_ROUTES: EvidenceRef = {
  kind: 'code',
  ref: 'apps/server/src/routes/agent-tasks.ts',
  note: 'agent surfaces mounted behind the same auth + entitlement middleware as user routes',
};
export const REFUND_ROUTE: EvidenceRef = {
  kind: 'code',
  ref: 'apps/server/src/routes/billing.ts',
  note: 'POST /api/billing/refund; admin-authenticated, full or partial refunds via Stripe',
};
export const AUDIT_LOG_SCHEMA: EvidenceRef = {
  kind: 'code',
  ref: 'packages/db/src/schema/audit-log.ts',
  note: 'audit_log table; single-door write path enforced by validate:audit-one-door',
};
export const OPEN_STANDARDS: EvidenceRef = {
  kind: 'code',
  ref: 'packages/openapi/src',
  note: 'OpenAPI spec generation; MCP + Stripe webhooks + OAuth are the other open surfaces',
};
export const POSTGRES: EvidenceRef = {
  kind: 'code',
  ref: 'packages/db/src/schema',
  note: 'plain Postgres via Drizzle; no proprietary database',
};
export const THIS_SITE: EvidenceRef = {
  kind: 'url',
  ref: 'https://revealui.com',
  note: 'this site (apps/marketing) and revealuistudio.com run on RevealUI in production',
};
export const PRICING_FALLBACKS: EvidenceRef = {
  kind: 'metric',
  ref: 'apps/marketing/app/lib/pricing-fallbacks.ts',
  note: 'display prices pinned in lockstep with scripts/setup/stripe-catalog.ts by validate:pricing-lockstep',
};
export const NO_TELEMETRY: EvidenceRef = {
  kind: 'url',
  ref: 'https://github.com/RevealUIStudio/revealui/search?q=telemetry',
  note: 'negative claim: no telemetry client ships in the runtime; verify by repo search',
};
export const DEPLOY_TARGETS: EvidenceRef = {
  kind: 'code',
  ref: 'docs/guides/deployment.md',
  note: 'self-host deployment guide; named hosts in copy are examples of standard Node targets, the guide covers the primary paths',
};
export const DOCS: EvidenceRef = { kind: 'url', ref: 'https://docs.revealui.com' };
export const LIVE_AGENT_CARD: EvidenceRef = {
  kind: 'url',
  ref: 'https://api.revealui.com/.well-known/agent.json',
  note: 'returns 200 on live prod, verified 2026-07-12; route at apps/server/src/routes/a2a.ts',
};
export const FEATURES_MATRIX: EvidenceRef = {
  kind: 'code',
  ref: 'packages/core/src/features.ts',
  note: 'per-tier feature flags (getFeaturesForTier)',
};
export const X402_FACILITATOR: EvidenceRef = {
  kind: 'code',
  ref: 'packages/paywall/src/x402',
  note: 'Coinbase-compatible USDC-on-Base facilitator; gated behind X402_ENABLED, default off',
};
export const COMMERCIAL_POLICY: EvidenceRef = {
  kind: 'url',
  ref: 'https://revealui.com/pricing',
  note: 'owner-committed commercial policy (service rungs, credits, custom pricing/SLA); no code artifact by nature. Policy-page follow-up tracked in the coordination hub',
};
export const FAIR_SOURCE_PAGE: EvidenceRef = {
  kind: 'code',
  ref: 'apps/marketing/app/routes/FairSourcePage.tsx',
};
export const SLA_PAGE: EvidenceRef = {
  kind: 'code',
  ref: 'apps/marketing/app/routes/SlaPage.tsx',
  note: 'published support-response and infrastructure-uptime commitments',
};
export const INFRA_COST_ESTIMATE: EvidenceRef = {
  kind: 'url',
  ref: 'https://revealui.com/pricing',
  note: 'infra cost estimate of the rented stack, not a RevealUI price',
};
export const WAITLIST: EvidenceRef = {
  kind: 'code',
  ref: 'apps/server/src/routes/waitlist.ts',
  note: 'newsletter/release-updates capture endpoint',
};

// ── claims-ratchet 2026-07-12 evidence (products/capabilities/primitives) ────
export const HARNESS_WORKBOARD: EvidenceRef = {
  kind: 'code',
  ref: 'packages/harnesses/src/workboard/workboard-manager.ts',
  note: 'shared workboard manager for cross-session agent coordination',
};
export const HARNESS_ADAPTER: EvidenceRef = {
  kind: 'code',
  ref: 'packages/harnesses/src/adapters/revealui-agent-adapter.ts',
  note: 'the one working agent adapter; roadmap profiles at packages/harnesses/src/protocol/roadmap-profiles.ts state no working adapter ships for claude-code/cursor yet',
};
export const HYPERVISOR: EvidenceRef = {
  kind: 'code',
  ref: 'packages/mcp/src/hypervisor.ts',
  note: 'supervises the MCP servers and surfaces their tool registries',
};
export const TASK_QUOTA: EvidenceRef = {
  kind: 'code',
  ref: 'apps/server/src/middleware/task-quota.ts',
  note: '429 over per-tier maxAgentTasks; mounted on agent-tasks + agent-stream in apps/server/src/index.ts',
};
export const ORCHESTRATOR: EvidenceRef = {
  kind: 'code',
  ref: 'packages/ai/src/orchestration/orchestrator.ts',
  note: 'multi-agent coordination + orchestration',
};
export const A2A_ROUTES: EvidenceRef = {
  kind: 'code',
  ref: 'apps/server/src/routes/a2a.ts',
  note: 'JSON-RPC agent-to-agent protocol mounted at /a2a behind entitlement middleware',
};
export const PERPETUAL: EvidenceRef = {
  kind: 'code',
  ref: 'apps/server/src/routes/billing.ts',
  note: 'perpetualCheckoutRoute POST /checkout-perpetual; catalog products in scripts/setup/stripe-catalog.ts; licenses.perpetual column',
};
/** Agency Perpetual mint site cap (GAP-448). */
export const AGENCY_PERPETUAL_MAX_SITES: EvidenceRef = {
  kind: 'code',
  ref: 'packages/contracts/src/pricing.ts',
  note: 'perpetualMaxSitesForTier: perpetual max tier mints maxSites 10 (Agency Fleet); subscription Max stays at TIER_LIMITS.max.sites 15',
};
export const AGENCY_PERPETUAL_MINT_WEBHOOK: EvidenceRef = {
  kind: 'code',
  ref: 'packages/core/src/license/mint-client.ts',
  note: 'withPerpetualSiteCaps / mintLicenseKey: perpetual max tier bakes maxSites 10 for Agency JWT',
};
export const ADMIN_LICENSE_PAGE: EvidenceRef = {
  kind: 'code',
  ref: 'apps/admin/src/app/(frontend)/account/license/page.tsx',
  note: 'PERPETUAL_PLANS Agency Perpetual → POST /api/billing/checkout-perpetual with tier max',
};
export const MCP_SERVERS: EvidenceRef = {
  kind: 'code',
  ref: 'packages/mcp/src/servers',
  note: 'first-party MCP servers; the count is METRICS.mcpServers, pinned by scripts/validate/claim-drift.ts',
};
export const REVVAULT_REPO: EvidenceRef = {
  kind: 'url',
  ref: 'https://github.com/RevealUIStudio/revvault',
  note: 'Rust CLI (crates/) + Tauri desktop app; age-encrypted passage-compatible store; workspace version 0.3.0',
};
export const REVFORGE_REF: EvidenceRef = {
  kind: 'url',
  ref: 'https://revealui.com/products',
  note: 'operator-only tool in a private repo; stamping/domain-lock/multi-tenant capabilities verified internally 2026-07-12; the repo is not public, which is why the card carries no GitHub link',
};
export const REVDEV_REPO: EvidenceRef = {
  kind: 'url',
  ref: 'https://github.com/RevealUIStudio/revdev',
  note: 'apps/studio + apps/console + packages/daemon at 0.2.0 (v0.2.0 tagged 2026-07-17); the daemon registers and coordinates agents over JSON-RPC',
};
export const REVCON_REPO: EvidenceRef = {
  kind: 'url',
  ref: 'https://github.com/RevealUIStudio/revcon',
  note: 'MIT editor config sync (Zed + Cursor), symlinked per project',
};
export const REVSKILLS_REPO: EvidenceRef = {
  kind: 'url',
  ref: 'https://github.com/RevealUIStudio/revskills',
  note: 'MIT Claude Code skills library (Drizzle schemas, Vitest patterns, security hardening)',
};
export const ROADMAP: EvidenceRef = {
  kind: 'url',
  ref: 'https://revealui.com/roadmap',
  note: 'RevMarket is Planned; third-party publishing is roadmap-only, not yet shipped',
};

// ── claims-ratchet 2026-07-12 evidence (narrative funnel cluster) ─────────────
export const EMAIL_AGENT: EvidenceRef = {
  kind: 'code',
  ref: 'packages/ai/src/templates',
  note: 'email-agent triage/draft/schedule template (id "email-agent", index.ts); no order-processing template ships',
};
export const SERVICES_STRIPE: EvidenceRef = {
  kind: 'code',
  ref: 'packages/services/src',
  note: 'only stripe/ and email/ subtrees ship; no Solana or Vercel service in src',
};
export const LLM_CLIENT: EvidenceRef = {
  kind: 'code',
  ref: 'packages/ai/src/llm/client.ts',
  note: 'createLLMClientFromEnv default provider inference-snaps, defaultModel nemotron-3-nano, port 9090; US-origin allowlist; LLMProviderType union groq/ollama/huggingface/inference-snaps',
};
export const OLLAMA: EvidenceRef = {
  kind: 'code',
  ref: 'packages/ai/src/llm/providers/ollama.ts',
  note: 'Ollama adapter, default gemma4:e2b, port 11434',
};
export const OPENAI_COMPAT: EvidenceRef = {
  kind: 'code',
  ref: 'packages/ai/src/llm/providers/openai-compat.ts',
  note: 'OpenAI-compatible provider adapter (GPT and any OpenAI-compatible endpoint)',
};
export const LICENSE_ED25519: EvidenceRef = {
  kind: 'code',
  ref: 'packages/core/src/revforge-license.ts',
  note: 'EdDSA-signed license JWTs; runtime verification in apps/server/src/routes/license.ts',
};
export const ENGINES: EvidenceRef = {
  kind: 'code',
  ref: 'packages/engines/src',
  note: 'the five business primitives: People, Content, Offers, Payments, Agents',
};
export const AGENT_CHAT: EvidenceRef = {
  kind: 'code',
  ref: 'apps/admin/src/lib/hooks/useAgentStream.ts',
  note: 'SSE-streaming dashboard agent chat with tool visibility and history',
};
export const DOCS_APP: EvidenceRef = {
  kind: 'code',
  ref: 'apps/docs',
  note: 'documentation site (docs.revealui.com)',
};
export const REVDEV_STUDIO_INFERENCE: EvidenceRef = {
  kind: 'url',
  ref: 'https://github.com/RevealUIStudio/revdev',
  note: 'RevDev Studio local-inference cockpit verified 2026-07-12 at apps/studio/src-tauri/src/commands/inference.rs: Tauri commands install/run Ollama (inference_ollama_start/pull) and Inference Snaps (inference_snap_install)',
};
export const FSL_PEERS_CITATION: EvidenceRef = {
  kind: 'url',
  ref: 'https://fair.io/',
  note: 'external FSL adopters (Sentry, GitButler, Keygen); each peer card links its own primary source',
};
export const BIO: EvidenceRef = {
  kind: 'url',
  ref: 'https://revealuistudio.com',
  note: 'biographical and organizational claims, owner-attested; no code artifact by nature',
};
export const MARKET_CITATIONS: EvidenceRef = {
  kind: 'url',
  ref: 'https://revealui.com/local-ai',
  note: 'external market citations, explicitly labeled as not RevealUI customers with an on-page disclaimer',
};

// ── /claims self-reference (frontend-excellence Phase 5, Fable ruling
// 2026-07-16): the ledger page proves itself with the same artifacts it
// renders for every other page. ──────────────────────────────────────────
export const CLAIMS_INDEX: EvidenceRef = {
  kind: 'code',
  ref: 'apps/marketing/app/content/claims-evidence.ts',
  note: 'the claims index this page renders',
};
export const CLAIMS_VALIDATOR: EvidenceRef = {
  kind: 'code',
  ref: 'scripts/validate/claims-evidence.ts',
  note: 'the gate that enforces coverage, text staleness, and evidence-path existence on every PR',
};
export const CLAIMS_ROUTE_MAP: EvidenceRef = {
  kind: 'code',
  ref: 'apps/marketing/app/content/claims-routes.ts',
  note: 'file-to-route map; the validator fails when a covered file has no entry here',
};
export const CLAIMS_PAGE_ROUTE: EvidenceRef = {
  kind: 'code',
  ref: 'apps/marketing/app/routes/ClaimsPage.tsx',
  note: 'renders this index publicly at /claims',
};
// ── audit-log signing (GAP-355 Stage 3): the log is signed with a key anyone
// can check, verifiable offline without our secret. Scoped to the log, not
// "every agent action" (Stage 5). Stage 4 adds Merkle roots + offline anchor
// CLI (S4-5) for customers who hold a delivered root. ─────────────────────────
export const AUDIT_ROW_SIGNER: EvidenceRef = {
  kind: 'code',
  ref: 'packages/security/src/audit-signing.ts',
  note: 'Ed25519AuditRowSigner signs each row over RFC 8785 canonical bytes; verify with the published SPKI public key (GET /api/audit/public-key), no secret needed',
};
export const AUDIT_SIGN_ROUNDTRIP: EvidenceRef = {
  kind: 'test',
  ref: 'apps/server/src/lib/__tests__/audit-signing-roundtrip.pglite.test.ts#a canonically-signed row verifies OFFLINE after the jsonb + timestamptz round trip',
  note: 'a row written through the one door verifies offline from the jsonb + timestamptz readback using only the public key',
};
export const AUDIT_MERKLE: EvidenceRef = {
  kind: 'code',
  ref: 'packages/security/src/audit-merkle.ts',
  note: 'Stage 4: per-tenant Merkle roots over row signature leaves; inclusion proofs recompute the root offline',
};
export const AUDIT_ANCHOR_VERIFY: EvidenceRef = {
  kind: 'code',
  ref: 'packages/security/src/audit-anchor-verify.ts',
  note: 'Stage 4 S4-5: pure offline verify of root signature + optional inclusion proof (no network)',
};
export const AUDIT_ANCHOR_VERIFY_CLI: EvidenceRef = {
  kind: 'command',
  ref: 'pnpm verify:audit-anchor -- --public-key <pem> --anchor <json> [--proof <json>]',
  note: 'Stage 4 offline CLI (scripts/security/verify-audit-anchor.ts); exit 0 iff checks pass',
};
export const AUDIT_ANCHOR_SCHEMA: EvidenceRef = {
  kind: 'code',
  ref: 'packages/db/src/schema/audit-anchors.ts',
  note: 'audit_anchors stores delivered roots + root_signature for customer hold',
};
export const AUDIT_ANCHOR_VERIFY_TEST: EvidenceRef = {
  kind: 'test',
  ref: 'packages/security/src/__tests__/audit-anchor-verify.test.ts#accepts root + inclusion proof for one leaf',
  note: 'root signature + inclusion path verify offline with only the public key',
};
export const AUDIT_ANCHOR_API: EvidenceRef = {
  kind: 'code',
  ref: 'apps/server/src/routes/audit.ts',
  note: 'GET /api/audit/anchors and /proof (S4-4); Max+ auditLog gate + tenant lag in list response',
};
export const AUDIT_LOG_FEATURE_MAX: EvidenceRef = {
  kind: 'code',
  ref: 'packages/core/src/features.ts',
  note: 'auditLog feature requires Max tier; Free/Pro cannot download roots (403)',
};
export const AUDIT_RECEIPTS_DOC: EvidenceRef = {
  kind: 'code',
  ref: 'docs/security/AUDIT_RECEIPTS.md',
  note: 'Stage 4 honesty: what Free/Pro get vs Max root delivery; offline CLI; verification never paid',
};
export const STARTER_KIT: EvidenceRef = {
  kind: 'code',
  ref: 'examples/starter-kit',
  note: 'GAP-434 content-only kit: recipes, receipt verify, Postgres bootstrap (npm-resolvable)',
};
export const STARTER_KIT_GETTING_STARTED: EvidenceRef = {
  kind: 'code',
  ref: 'examples/starter-kit/GETTING-STARTED.md',
  note: 'buyer flow documents create-revealui + bootstrap',
};
export const STARTER_KIT_RECEIPT_TEST: EvidenceRef = {
  kind: 'test',
  ref: 'examples/starter-kit/src/receipts/__tests__/roundtrip.test.ts#signs an action log and verifies it as valid',
  note: 'offline receipt sign+verify roundtrip in the kit',
};
export const AGENCY_PERPETUAL_FEATURES: EvidenceRef = {
  kind: 'code',
  ref: 'packages/contracts/src/pricing.ts',
  note: 'PERPETUAL_TIERS Agency Perpetual: Max features, up to 10 client deployments, never-expire key',
};
export const CHECKOUT_PERPETUAL_ROUTE: EvidenceRef = {
  kind: 'code',
  ref: 'apps/server/src/routes/billing/routes.ts',
  note: 'POST /api/billing/checkout-perpetual authenticated one-time Stripe payment',
};
export const PERPETUAL_MINT_LIMITS: EvidenceRef = {
  kind: 'code',
  ref: 'packages/core/src/license/mint-client.ts',
  note: 'withPerpetualSiteCaps: Agency/max perpetual mints maxSites 10 (and seat caps)',
};
export const PERPETUAL_MINT_LIMITS_TEST: EvidenceRef = {
  kind: 'test',
  ref: 'packages/core/src/__tests__/license-mint-client.test.ts#local mint embeds maxSites 10 for Agency perpetual JWT',
  note: 'Agency perpetual JWT embeds maxSites 10 via withPerpetualSiteCaps',
};
export const PERPETUAL_NEVER_EXPIRES_TEST: EvidenceRef = {
  kind: 'test',
  ref: 'packages/core/src/__tests__/license.test.ts#perpetual licenses never expire',
  note: 'JWT perpetual path has no exp claim',
};
