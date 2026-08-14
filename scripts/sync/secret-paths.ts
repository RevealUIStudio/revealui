/**
 * Canonical secret-path declaration - machine-readable single source of truth
 * for the revvault paths the fleet syncs to its production runtimes (Vercel +
 * Fly), and the drift predicates the lockstep gate checks.
 *
 * Modeled 1:1 on scripts/setup/stripe-catalog.ts: a pure, importable, I/O-free
 * data module (SECRET_PATHS + RENAME_MAP), derived ReadonlySets, and pure
 * reconciliation predicates that unit-test against plain literals. No revvault,
 * no fs, no network - the lockstep test (scripts/sync/__tests__/
 * secret-paths-lockstep.test.ts) feeds these predicates the parsed manifests +
 * the rendered SECRETS.md and fails CI on drift.
 *
 * SCOPE (Phase 0, P0-1): this declares the PRODUCTION-SYNCED runtime path set -
 * the union of scripts/sync/revvault-vercel.toml + revvault-fly.toml (the
 * drift-critical surface) - plus the license signing keypair and the one
 * security-relevant `with-secrets` env bundles it mirrors (revealui/env/license +
 * revealui/env/license-signing after GAP-260 P2-2,
 * R8). The dev/*, api-keys/*, credentials/*, revdev/tauri-*, forge/*, and
 * agents/* tiers are NOT modeled here yet; they remain hand-written prose in
 * docs/SECRETS.md OUTSIDE the generated markers. The SecretTier union carries
 * them for forward-compatibility as later phases fold them in.
 *
 * NO SECRET VALUES live here - paths + structure only. Every path is already
 * public in the sync manifests in this same repo; this file adds no exposure.
 *
 * The rendered derived view (docs/SECRETS.md §Production runtime, between the
 * BEGIN/END GENERATED:secret-paths markers) is produced by
 * scripts/sync/render-secrets-md.ts from SECRET_PATHS. Change the paths here and
 * re-run the renderer; the lockstep test fails until manifest, spec, and doc all
 * agree.
 *
 * Zero authored regex (fleet no-regex posture): every predicate uses
 * String.prototype methods + Set membership only.
 */

/** What a secret path holds - drives the `sensitive` invariant + doc labeling. */
export type SecretKind =
  | 'credential' // tokens, passwords, secret keys, db urls, HMAC/session/KEK  → sensitive
  | 'signing-private' // PKCS#8 / Ed25519 private signing key                  → sensitive
  | 'signing-public' // SPKI public verification key                           → NOT sensitive
  | 'public-config' // public urls, ids, kebab flags, publishable keys, DSNs   → NOT sensitive
  | 'price-id'; // Stripe price/product ids (low-secrecy identifiers)          → NOT sensitive

/** Secrecy tier (by secrecy, not by vault namespace). */
export type SecretTier = 'prod' | 'staging' | 'dev' | 'env' | 'credentials' | 'agents' | 'forge';

export interface SecretPathDef {
  /** Canonical revvault path, lower-kebab, a leaf XOR a directory prefix (never both). */
  path: string;
  kind: SecretKind;
  /** MUST equal isSensitiveKind(kind). Enforced by findSpecSensitivityInconsistencies. */
  sensitive: boolean;
  tier: SecretTier;
  /**
   * Where this path is consumed. Tokens:
   *   vercel:api | vercel:admin | vercel:marketing | vercel:docs | fly:worker
   *   with-secrets:license | with-secrets:license-signing
   *   app:license-signer (GAP-260 P4-2 isolated mint process; not a Vercel app)
   */
  consumers: string[];
  /** Feeds P0-5 (⊇ REQUIRED_IN_PRODUCTION_HOSTED). Set only where confirmed required-at-boot. */
  requiredInProdHosted?: boolean;
  /**
   * Env var name(s) this vault path is consumed as. REQUIRED for entries with
   * `requiredInProdHosted` — P0-5 (prod-required-coverage.test.ts) asserts each
   * is enforced at hosted-prod boot, via validate-startup's
   * REQUIRED_IN_PRODUCTION_HOSTED or a REQUIRED_ALWAYS_GROUPS alias group.
   */
  envVars?: string[];
  /** Declared in-flight rename target (zero-downtime). The value has NOT moved yet. */
  migratingTo?: string;
  /** ISO date the migration was declared. Lingering past one release window is a finding. */
  migratingSince?: string;
  /** Suppresses the not-synced/orphan finding - export-env bundles + bootstrap one-shots. */
  intentionallyUnsynced?: boolean;
  /** Rendered as a doc note; also carries known-state context (e.g. empty-in-vault). */
  note?: string;
}

/** The one sensitivity invariant: a path is sensitive iff it holds a credential or private key. */
export function isSensitiveKind(kind: SecretKind): boolean {
  return kind === 'credential' || kind === 'signing-private';
}

// ─── SECRET_PATHS - seeded from the live sync manifests (2026-07-01) ──────────
// Grouped by subsystem for readability; the renderer + lockstep sort by path.
export const SECRET_PATHS: SecretPathDef[] = [
  // ── Stripe - keys + secrets (credential) ──────────────────────────────────
  {
    path: 'revealui/prod/stripe/secret-key',
    kind: 'credential',
    sensitive: true,
    tier: 'prod',
    consumers: ['vercel:api', 'vercel:admin'],
    note: 'sk_live_* - set Fly-direct (mode-gated), not synced to the worker',
  },
  {
    path: 'revealui/prod/stripe/webhook-secret',
    kind: 'credential',
    sensitive: true,
    tier: 'prod',
    consumers: ['vercel:api', 'vercel:admin', 'fly:worker'],
  },
  {
    path: 'revealui/prod/stripe/webhook-secret-live',
    kind: 'credential',
    sensitive: true,
    tier: 'prod',
    consumers: ['vercel:api', 'fly:worker'],
  },
  {
    path: 'revealui/prod/stripe/publishable-key',
    kind: 'public-config',
    sensitive: false,
    tier: 'prod',
    consumers: ['vercel:admin'],
    note: 'pk_live_* - publishable by design (client SDK)',
  },
  {
    path: 'revealui/prod/stripe/agent-meter-event-name',
    kind: 'public-config',
    sensitive: false,
    tier: 'prod',
    // Also read by the staging api project (revvault-vercel-staging.toml) -
    // not secret, not per-environment, deliberately shared (GAP-343 Phase 3).
    consumers: ['vercel:api', 'fly:worker', 'vercel:api-staging'],
  },
  {
    path: 'revealui/prod/stripe/billing-portal-config-id',
    kind: 'public-config',
    sensitive: false,
    tier: 'prod',
    consumers: ['vercel:api'],
    note: 'canonical billing-portal config id (Vercel api)',
  },
  // R18: the Fly worker still reads the un-namespaced billing/ path - a LIVE
  // duplicate of the stripe/ canonical above (the two manifests disagree). Both
  // are actively synced today, so both are declared; the Fly laggard is marked
  // migrating. Converge-then-delete is P3-3 (owner-gated), NOT this PR.
  {
    path: 'revealui/prod/billing/portal-config-id',
    kind: 'public-config',
    sensitive: false,
    tier: 'prod',
    consumers: ['fly:worker'],
    migratingTo: 'revealui/prod/stripe/billing-portal-config-id',
    migratingSince: '2026-07-01',
    note: 'R18 - Fly-side duplicate of the stripe/ canonical; converge in P3-3',
  },
  // ── Stripe - price ids (low-secrecy identifiers) ──────────────────────────
  ...(
    [
      ['revealui/prod/stripe/pro-price-id', ['vercel:api', 'vercel:admin', 'fly:worker']],
      ['revealui/prod/stripe/max-price-id', ['vercel:api', 'vercel:admin', 'fly:worker']],
      ['revealui/prod/stripe/enterprise-price-id', ['vercel:api', 'vercel:admin', 'fly:worker']],
      ['revealui/prod/stripe/pro-annual-price-id', ['vercel:api', 'vercel:admin']],
      ['revealui/prod/stripe/max-annual-price-id', ['vercel:api', 'vercel:admin', 'fly:worker']],
      ['revealui/prod/stripe/enterprise-annual-price-id', ['vercel:api', 'vercel:admin']],
      ['revealui/prod/stripe/perpetual-pro-price-id', ['vercel:api', 'vercel:admin', 'fly:worker']],
      ['revealui/prod/stripe/perpetual-max-price-id', ['vercel:api', 'vercel:admin', 'fly:worker']],
      [
        'revealui/prod/stripe/perpetual-enterprise-price-id',
        ['vercel:api', 'vercel:admin', 'fly:worker'],
      ],
      ['revealui/prod/stripe/renewal-pro-price-id', ['vercel:api']],
      ['revealui/prod/stripe/renewal-max-price-id', ['vercel:api']],
      ['revealui/prod/stripe/renewal-enterprise-price-id', ['vercel:api']],
      ['revealui/prod/stripe/credits-starter-price-id', ['vercel:api', 'fly:worker']],
      ['revealui/prod/stripe/credits-standard-price-id', ['vercel:api', 'fly:worker']],
      ['revealui/prod/stripe/credits-scale-price-id', ['vercel:api', 'fly:worker']],
      ['revealui/prod/stripe/agent-overage-price-id', ['vercel:api', 'fly:worker']],
    ] as const
  ).map(
    ([path, consumers]): SecretPathDef => ({
      path,
      kind: 'price-id',
      sensitive: false,
      tier: 'prod',
      consumers: [...consumers],
    }),
  ),
  // ── Database (credential) ─────────────────────────────────────────────────
  {
    path: 'revealui/prod/db/postgres-url',
    kind: 'credential',
    sensitive: true,
    tier: 'prod',
    consumers: ['vercel:api', 'vercel:admin', 'fly:worker'],
    requiredInProdHosted: true,
    envVars: ['POSTGRES_URL', 'DATABASE_URL'],
    note: 'canonical Neon pooled url - feeds POSTGRES_URL + DATABASE_URL',
  },
  {
    path: 'revealui/prod/db/neon-api-key',
    kind: 'credential',
    sensitive: true,
    tier: 'prod',
    consumers: ['vercel:admin'],
  },
  // ── Encryption + signing (crown jewels) ───────────────────────────────────
  {
    path: 'revealui/prod/kek',
    kind: 'credential',
    sensitive: true,
    tier: 'prod',
    consumers: ['vercel:api', 'vercel:admin', 'fly:worker'],
    note: 'REVEALUI_KEK - AES-256-GCM envelope key; has a NEXT dual-slot rotation story',
  },
  {
    path: 'revealui/prod/secret',
    kind: 'credential',
    sensitive: true,
    tier: 'prod',
    consumers: ['vercel:api', 'vercel:admin', 'fly:worker'],
    note: 'REVEALUI_SECRET - session/CSRF/internal-token signer',
  },
  // Audit-log signing keypair (GAP-355 Stage 3). Per-row Ed25519 signing
  // replaced the retired audit HMAC. The private key signs every row at the one
  // door; a hosted signing deployment refuses to boot without it (validate-
  // startup REQUIRED_IN_PRODUCTION_HOSTED). The public key is published at
  // GET /api/audit/public-key so a customer can verify a receipt offline.
  {
    path: 'revealui/prod/audit/signing-private-key',
    kind: 'signing-private',
    sensitive: true,
    tier: 'prod',
    consumers: ['vercel:api', 'vercel:admin', 'fly:worker'],
    requiredInProdHosted: true,
    envVars: ['REVEALUI_AUDIT_SIGNING_KEY'],
    note: 'Ed25519 PKCS#8 PEM - signs every audit row; only signing surfaces read it, no fallback',
  },
  {
    path: 'revealui/prod/audit/signing-public-key',
    kind: 'signing-public',
    sensitive: false,
    tier: 'prod',
    consumers: ['vercel:api', 'vercel:admin', 'fly:worker'],
    envVars: ['REVEALUI_AUDIT_PUBLIC_KEY'],
    note: 'Ed25519 SPKI PEM - published for offline receipt verification; derivable from the private key. See docs/security/AUDIT_RECEIPTS.md (Stage 4: row verify free; root download Max)',
  },
  // Visual edit sessions (P1). HMAC-SHA256 key behind the read-only preview
  // tokens; the API both mints and verifies (routes/content/sessions), no
  // other consumer reads it and there is no fallback value.
  {
    path: 'revealui/prod/preview-token-secret',
    kind: 'credential',
    sensitive: true,
    tier: 'prod',
    consumers: ['vercel:api'],
    envVars: ['REVEALUI_PREVIEW_TOKEN_SECRET'],
    note: 'HMAC-SHA256 key for edit-session preview tokens - short-lived read-only credential',
  },
  // License signing keypair - CANONICAL stays at the live revdev/* path so the
  // gate is GREEN against today's manifest; the project-aligned target is
  // DECLARED via migratingTo (the value-move is P3-4, owner-gated - NOT here).
  {
    path: 'revdev/license-signing-private-key',
    kind: 'signing-private',
    sensitive: true,
    tier: 'prod',
    consumers: ['fly:worker', 'fly:license-signer', 'with-secrets:license-signing'],
    migratingTo: 'revealui/prod/license/private-key',
    migratingSince: '2026-06-28',
    note: 'Ed25519 license-signing key. Admin + api dropped P4-4 (signer is mint path). Fly worker last until executor-off digest. Offline stamper keeps with-secrets:license-signing.',
  },
  {
    path: 'revdev/license-signing-public-key',
    kind: 'signing-public',
    sensitive: false,
    tier: 'prod',
    consumers: [
      'vercel:api',
      'vercel:admin',
      'fly:worker',
      'fly:license-signer',
      'with-secrets:license',
    ],
    migratingTo: 'revealui/prod/license/public-key',
    migratingSince: '2026-06-28',
    note: 'Ed25519 verification key - rotating invalidates all issued customer licenses',
  },
  // ── Cron + alerting ───────────────────────────────────────────────────────
  {
    path: 'revealui/prod/cron-secret',
    kind: 'credential',
    sensitive: true,
    tier: 'prod',
    consumers: ['vercel:api', 'vercel:admin', 'fly:worker'],
  },
  {
    path: 'revealui/prod/alert-email',
    kind: 'public-config',
    sensitive: false,
    tier: 'prod',
    consumers: ['vercel:api', 'fly:worker'],
    requiredInProdHosted: true,
    envVars: ['REVEALUI_ALERT_EMAIL'],
    note: 'required at prod boot - apps/server refuses to start without it',
  },
  // ── Admin subsystem ───────────────────────────────────────────────────────
  {
    path: 'revealui/prod/admin/api-key',
    kind: 'credential',
    sensitive: true,
    tier: 'prod',
    consumers: ['vercel:api', 'vercel:admin', 'fly:worker'],
  },
  {
    path: 'revealui/prod/admin/email',
    kind: 'public-config',
    sensitive: false,
    tier: 'prod',
    consumers: ['vercel:admin'],
  },
  {
    path: 'revealui/prod/admin/password',
    kind: 'credential',
    sensitive: true,
    tier: 'prod',
    consumers: ['vercel:admin'],
  },
  // Self-serve funnel + Pro bundle flags (GAP-339). Public-config booleans;
  // declared here so secret-paths lockstep matches revvault-vercel.toml.
  {
    path: 'revealui/prod/admin/signup-open',
    kind: 'public-config',
    sensitive: false,
    tier: 'prod',
    consumers: ['vercel:admin'],
    envVars: ['REVEALUI_SIGNUP_OPEN'],
    note: 'Boolean string; self-serve signup funnel gate (true/false)',
  },
  {
    path: 'revealui/prod/api/bundle-pro',
    kind: 'public-config',
    sensitive: false,
    tier: 'prod',
    consumers: ['vercel:api'],
    envVars: ['REVEALUI_BUNDLE_PRO'],
    note: 'Pro bundle flag for hosted API',
  },
  // ── Storage - Cloudflare R2 ───────────────────────────────────────────────
  {
    path: 'revealui/prod/r2/account-id',
    kind: 'public-config',
    sensitive: false,
    tier: 'prod',
    consumers: ['vercel:api', 'vercel:admin', 'fly:worker'],
  },
  {
    path: 'revealui/prod/r2/access-key-id',
    kind: 'credential',
    sensitive: true,
    tier: 'prod',
    consumers: ['vercel:api', 'vercel:admin', 'fly:worker'],
  },
  {
    path: 'revealui/prod/r2/secret-access-key',
    kind: 'credential',
    sensitive: true,
    tier: 'prod',
    consumers: ['vercel:api', 'vercel:admin', 'fly:worker'],
  },
  {
    path: 'revealui/prod/r2/bucket',
    kind: 'public-config',
    sensitive: false,
    tier: 'prod',
    consumers: ['vercel:api', 'vercel:admin', 'fly:worker'],
  },
  {
    path: 'revealui/prod/r2/public-base-url',
    kind: 'public-config',
    sensitive: false,
    tier: 'prod',
    consumers: ['vercel:api', 'vercel:admin', 'fly:worker'],
  },
  // ── Email transport (Gmail service account) ───────────────────────────────
  {
    path: 'revealui/prod/google/service-account-email',
    kind: 'public-config',
    sensitive: false,
    tier: 'prod',
    // Reused as-is by staging (revvault-vercel-staging.toml) - real
    // verification/receipt/license mail must land in a real inbox during the
    // 9-path walk; forking transport credentials buys no isolation (GAP-343).
    consumers: [
      'vercel:api',
      'vercel:admin',
      'fly:worker',
      'vercel:api-staging',
      'vercel:admin-staging',
    ],
  },
  {
    path: 'revealui/prod/google/private-key',
    kind: 'credential',
    sensitive: true,
    tier: 'prod',
    consumers: [
      'vercel:api',
      'vercel:admin',
      'fly:worker',
      'vercel:api-staging',
      'vercel:admin-staging',
    ],
    note: 'PKCS8 PEM - Gmail SA domain-wide delegation; also read by staging (GAP-343)',
  },
  {
    path: 'revealui/prod/email/from',
    kind: 'public-config',
    sensitive: false,
    tier: 'prod',
    consumers: [
      'vercel:api',
      'vercel:admin',
      'fly:worker',
      'vercel:api-staging',
      'vercel:admin-staging',
    ],
  },
  {
    path: 'revealui/prod/email/reply-to',
    kind: 'public-config',
    sensitive: false,
    tier: 'prod',
    consumers: [
      'vercel:api',
      'vercel:admin',
      'fly:worker',
      'vercel:api-staging',
      'vercel:admin-staging',
    ],
  },
  // ── Auth / session ────────────────────────────────────────────────────────
  {
    path: 'revealui/prod/passkey/origin',
    kind: 'public-config',
    sensitive: false,
    tier: 'prod',
    consumers: ['vercel:api', 'vercel:admin', 'fly:worker'],
  },
  {
    path: 'revealui/prod/passkey/rp-id',
    kind: 'public-config',
    sensitive: false,
    tier: 'prod',
    consumers: ['vercel:api', 'vercel:admin', 'fly:worker'],
  },
  {
    path: 'revealui/prod/passkey/rp-name',
    kind: 'public-config',
    sensitive: false,
    tier: 'prod',
    consumers: ['vercel:api', 'vercel:admin', 'fly:worker'],
  },
  {
    path: 'revealui/prod/session-cookie-domain',
    kind: 'public-config',
    sensitive: false,
    tier: 'prod',
    consumers: ['vercel:api', 'vercel:admin', 'fly:worker'],
  },
  {
    path: 'revealui/prod/cors-origin',
    kind: 'public-config',
    sensitive: false,
    tier: 'prod',
    consumers: ['vercel:api', 'fly:worker'],
  },
  // ── Marketplace ───────────────────────────────────────────────────────────
  {
    path: 'revealui/prod/marketplace-connect-return-url',
    kind: 'public-config',
    sensitive: false,
    tier: 'prod',
    consumers: ['vercel:api', 'fly:worker'],
  },
  // ── Electric (real-time sync) ─────────────────────────────────────────────
  {
    path: 'revealui/prod/electric/service-url',
    kind: 'public-config',
    sensitive: false,
    tier: 'prod',
    consumers: ['vercel:api', 'vercel:admin', 'fly:worker'],
  },
  {
    path: 'revealui/prod/electric/secret',
    kind: 'credential',
    sensitive: true,
    tier: 'prod',
    consumers: ['vercel:api', 'vercel:admin', 'fly:worker'],
    note: 'currently empty in the vault (GAP-230/231); the worker does not require it',
  },
  // ── Observability - Sentry ────────────────────────────────────────────────
  {
    path: 'revealui/prod/sentry/dsn',
    kind: 'public-config',
    sensitive: false,
    tier: 'prod',
    consumers: ['vercel:api', 'fly:worker'],
    requiredInProdHosted: true,
    envVars: ['SENTRY_DSN'],
    note: 'server DSN - required by validate-startup REQUIRED_IN_PRODUCTION_HOSTED',
  },
  {
    path: 'revealui/prod/sentry/dsn-admin',
    kind: 'public-config',
    sensitive: false,
    tier: 'prod',
    consumers: ['vercel:admin'],
  },
  {
    path: 'revealui/prod/sentry/auth-token',
    kind: 'credential',
    sensitive: true,
    tier: 'prod',
    consumers: ['vercel:admin'],
    note: 'CI/CD source-map upload (build-time)',
  },
  {
    path: 'revealui/prod/sentry/org',
    kind: 'public-config',
    sensitive: false,
    tier: 'prod',
    consumers: ['vercel:admin'],
  },
  {
    path: 'revealui/prod/sentry/project-admin',
    kind: 'public-config',
    sensitive: false,
    tier: 'prod',
    consumers: ['vercel:admin'],
  },
  // ── Public / non-secret config (kept canonical for reproducibility) ───────
  {
    path: 'revealui/prod/public/server-url',
    kind: 'public-config',
    sensitive: false,
    tier: 'prod',
    // marketing dropped (GAP-350): Vite app does not read SERVER_URL twins.
    consumers: ['vercel:api', 'vercel:admin', 'fly:worker'],
  },
  {
    path: 'revealui/prod/public/api-url',
    kind: 'public-config',
    sensitive: false,
    tier: 'prod',
    // vercel:api is required for governed MCP tool loopback (self REST calls).
    // vercel:marketing reads it as VITE_API_URL (GAP-350); admin/api still use
    // REVEALUI_API_URL + NEXT_PUBLIC_API_URL.
    consumers: ['vercel:api', 'vercel:admin', 'vercel:marketing', 'vercel:docs'],
    requiredInProdHosted: true,
    envVars: ['REVEALUI_API_URL', 'VITE_API_URL'],
    note: 'api self-origin: REVEALUI_API_URL (+ NEXT_PUBLIC_API_URL twin on Next apps; VITE_API_URL on marketing). Governed MCP tools fail without it.',
  },
  {
    path: 'revealui/prod/public/is-live',
    kind: 'public-config',
    sensitive: false,
    tier: 'prod',
    // marketing dropped (GAP-350): zero readers in apps/marketing.
    consumers: ['vercel:admin'],
    note: 'NEXT_PUBLIC_IS_LIVE - Stripe live-mode feature flag',
  },
  // ── STAGING (GAP-343 Phase 3) ──────────────────────────────────────────────
  // The revealui/staging/* surface synced by scripts/sync/revvault-vercel-staging.toml
  // (a SEPARATE manifest from the prod one - see its header). Same subsystem
  // grouping as the prod entries above; consumers use the *-staging tokens
  // (vercel:api-staging / vercel:admin-staging / vercel:marketing-staging) so
  // "which manifest reads this" stays visible without inventing a new field.
  // Reused-from-prod values (Gmail SA, one Stripe meter-event name) are NOT
  // duplicated here - see the consumers additions on the prod entries above.
  {
    path: 'revealui/staging/stripe/secret-key',
    kind: 'credential',
    sensitive: true,
    tier: 'staging',
    consumers: ['vercel:api-staging', 'vercel:admin-staging'],
    note: 'sk_test_* - isolated staging Stripe test account (Phase 2)',
  },
  {
    path: 'revealui/staging/stripe/webhook-secret',
    kind: 'credential',
    sensitive: true,
    tier: 'staging',
    consumers: ['vercel:api-staging', 'vercel:admin-staging'],
  },
  {
    path: 'revealui/staging/stripe/publishable-key',
    kind: 'public-config',
    sensitive: false,
    tier: 'staging',
    consumers: ['vercel:admin-staging'],
    note: 'pk_test_*',
  },
  {
    path: 'revealui/staging/stripe/billing-portal-config-id',
    kind: 'public-config',
    sensitive: false,
    tier: 'staging',
    consumers: ['vercel:api-staging'],
  },
  ...(
    [
      ['revealui/staging/stripe/pro-price-id', ['vercel:api-staging', 'vercel:admin-staging']],
      ['revealui/staging/stripe/max-price-id', ['vercel:api-staging', 'vercel:admin-staging']],
      [
        'revealui/staging/stripe/enterprise-price-id',
        ['vercel:api-staging', 'vercel:admin-staging'],
      ],
      [
        'revealui/staging/stripe/pro-annual-price-id',
        ['vercel:api-staging', 'vercel:admin-staging'],
      ],
      [
        'revealui/staging/stripe/max-annual-price-id',
        ['vercel:api-staging', 'vercel:admin-staging'],
      ],
      [
        'revealui/staging/stripe/enterprise-annual-price-id',
        ['vercel:api-staging', 'vercel:admin-staging'],
      ],
      [
        'revealui/staging/stripe/perpetual-pro-price-id',
        ['vercel:api-staging', 'vercel:admin-staging'],
      ],
      [
        'revealui/staging/stripe/perpetual-max-price-id',
        ['vercel:api-staging', 'vercel:admin-staging'],
      ],
      [
        'revealui/staging/stripe/perpetual-enterprise-price-id',
        ['vercel:api-staging', 'vercel:admin-staging'],
      ],
      ['revealui/staging/stripe/renewal-pro-price-id', ['vercel:api-staging']],
      ['revealui/staging/stripe/renewal-max-price-id', ['vercel:api-staging']],
      ['revealui/staging/stripe/renewal-enterprise-price-id', ['vercel:api-staging']],
      ['revealui/staging/stripe/credits-starter-price-id', ['vercel:api-staging']],
      ['revealui/staging/stripe/credits-standard-price-id', ['vercel:api-staging']],
      ['revealui/staging/stripe/credits-scale-price-id', ['vercel:api-staging']],
      ['revealui/staging/stripe/agent-overage-price-id', ['vercel:api-staging']],
    ] as const
  ).map(
    ([path, consumers]): SecretPathDef => ({
      path,
      kind: 'price-id',
      sensitive: false,
      tier: 'staging',
      consumers: [...consumers],
    }),
  ),
  {
    path: 'revealui/staging/db/postgres-url',
    kind: 'credential',
    sensitive: true,
    tier: 'staging',
    consumers: ['vercel:api-staging', 'vercel:admin-staging'],
    note: 'Phase 1 (owner-run empty Neon branch + full migrate) fills this',
  },
  {
    path: 'revealui/staging/kek',
    kind: 'credential',
    sensitive: true,
    tier: 'staging',
    consumers: ['vercel:api-staging', 'vercel:admin-staging'],
    note: 'fresh staging value (scripts/setup/gen-staging-secrets.ts)',
  },
  {
    path: 'revealui/staging/secret',
    kind: 'credential',
    sensitive: true,
    tier: 'staging',
    consumers: ['vercel:api-staging', 'vercel:admin-staging'],
    note: 'must match across api + admin - CSRF tokens are cross-verified',
  },
  {
    path: 'revealui/staging/license/private-key',
    kind: 'signing-private',
    sensitive: true,
    tier: 'staging',
    consumers: ['vercel:api-staging'],
    note: 'fresh Ed25519 pair, isolated from revdev/license-signing-* (GAP-343 decision 1). Admin-staging dropped P4-4 (verify-only).',
  },
  {
    path: 'revealui/staging/license/public-key',
    kind: 'signing-public',
    sensitive: false,
    tier: 'staging',
    consumers: ['vercel:api-staging', 'vercel:admin-staging'],
  },
  {
    path: 'revealui/staging/cron-secret',
    kind: 'credential',
    sensitive: true,
    tier: 'staging',
    consumers: ['vercel:api-staging', 'vercel:admin-staging'],
  },
  {
    path: 'revealui/staging/alert-email',
    kind: 'public-config',
    sensitive: false,
    tier: 'staging',
    consumers: ['vercel:api-staging'],
    note: 'owner sets by hand - not derivable, not generated by gen-staging-secrets.ts',
  },
  {
    path: 'revealui/staging/admin/api-key',
    kind: 'credential',
    sensitive: true,
    tier: 'staging',
    consumers: ['vercel:api-staging', 'vercel:admin-staging'],
  },
  {
    path: 'revealui/staging/admin/email',
    kind: 'public-config',
    sensitive: false,
    tier: 'staging',
    consumers: ['vercel:admin-staging'],
    note: 'owner sets by hand - fresh staging bootstrap admin user',
  },
  {
    path: 'revealui/staging/admin/password',
    kind: 'credential',
    sensitive: true,
    tier: 'staging',
    consumers: ['vercel:admin-staging'],
    note: 'owner sets by hand - fresh staging bootstrap admin user',
  },
  {
    path: 'revealui/staging/r2/account-id',
    kind: 'public-config',
    sensitive: false,
    tier: 'staging',
    consumers: ['vercel:api-staging', 'vercel:admin-staging'],
  },
  {
    path: 'revealui/staging/r2/access-key-id',
    kind: 'credential',
    sensitive: true,
    tier: 'staging',
    consumers: ['vercel:api-staging', 'vercel:admin-staging'],
  },
  {
    path: 'revealui/staging/r2/secret-access-key',
    kind: 'credential',
    sensitive: true,
    tier: 'staging',
    consumers: ['vercel:api-staging', 'vercel:admin-staging'],
  },
  {
    path: 'revealui/staging/r2/bucket',
    kind: 'public-config',
    sensitive: false,
    tier: 'staging',
    consumers: ['vercel:api-staging', 'vercel:admin-staging'],
  },
  {
    path: 'revealui/staging/r2/public-base-url',
    kind: 'public-config',
    sensitive: false,
    tier: 'staging',
    consumers: ['vercel:api-staging', 'vercel:admin-staging'],
  },
  {
    path: 'revealui/staging/passkey/origin',
    kind: 'public-config',
    sensitive: false,
    tier: 'staging',
    consumers: ['vercel:api-staging', 'vercel:admin-staging'],
    note: 'the admin app origin, https://admin.staging.revealui.com',
  },
  {
    path: 'revealui/staging/passkey/rp-id',
    kind: 'public-config',
    sensitive: false,
    tier: 'staging',
    consumers: ['vercel:api-staging', 'vercel:admin-staging'],
  },
  {
    path: 'revealui/staging/passkey/rp-name',
    kind: 'public-config',
    sensitive: false,
    tier: 'staging',
    consumers: ['vercel:api-staging', 'vercel:admin-staging'],
  },
  {
    path: 'revealui/staging/session-cookie-domain',
    kind: 'public-config',
    sensitive: false,
    tier: 'staging',
    consumers: ['vercel:api-staging', 'vercel:admin-staging'],
  },
  {
    path: 'revealui/staging/cors-origin',
    kind: 'public-config',
    sensitive: false,
    tier: 'staging',
    consumers: ['vercel:api-staging'],
  },
  {
    path: 'revealui/staging/sentry/dsn',
    kind: 'public-config',
    sensitive: false,
    tier: 'staging',
    consumers: ['vercel:api-staging'],
    note: 'separate staging Sentry project - prod error budget stays clean',
  },
  {
    path: 'revealui/staging/sentry/dsn-admin',
    kind: 'public-config',
    sensitive: false,
    tier: 'staging',
    consumers: ['vercel:admin-staging'],
  },
  {
    path: 'revealui/staging/sentry/auth-token',
    kind: 'credential',
    sensitive: true,
    tier: 'staging',
    consumers: ['vercel:admin-staging'],
  },
  {
    path: 'revealui/staging/sentry/org',
    kind: 'public-config',
    sensitive: false,
    tier: 'staging',
    consumers: ['vercel:admin-staging'],
  },
  {
    path: 'revealui/staging/sentry/project-admin',
    kind: 'public-config',
    sensitive: false,
    tier: 'staging',
    consumers: ['vercel:admin-staging'],
  },
  {
    path: 'revealui/staging/public/server-url',
    kind: 'public-config',
    sensitive: false,
    tier: 'staging',
    // marketing-staging dropped (GAP-350): Vite app does not read SERVER_URL twins.
    consumers: ['vercel:api-staging', 'vercel:admin-staging'],
    note: 'the admin app own origin (parity with the prod server-url leaf)',
  },
  {
    path: 'revealui/staging/public/api-url',
    kind: 'public-config',
    sensitive: false,
    tier: 'staging',
    consumers: ['vercel:api-staging', 'vercel:admin-staging', 'vercel:marketing-staging'],
    note: 'the api own origin (MCP loopback + OpenAPI); VITE_API_URL on marketing (anti-cross-wire, GAP-343/350)',
  },

  // ── Env bundles (derived, verify-only - NOT synced to any platform) ───────
  // R8: with-secrets loads license material from SEPARATE paths (GAP-260 P2-2).
  //   license          → public SPKI only (verify / mode fallbacks)
  //   license-signing  → private PKCS#8 (mint only; REVVAULT_ALLOW_PRIVATE=1)
  {
    path: 'revealui/env/license',
    kind: 'signing-public',
    sensitive: false,
    tier: 'env',
    consumers: ['with-secrets:license'],
    intentionallyUnsynced: true,
    note: 'export-env public-only bundle: REVEALUI_LICENSE_PUBLIC_KEY (and MODE). Must NOT hold private key; with-secrets license uses revvault export-env --public-only',
  },
  {
    path: 'revealui/env/license-signing',
    kind: 'signing-private',
    sensitive: true,
    tier: 'env',
    consumers: ['with-secrets:license-signing'],
    intentionallyUnsynced: true,
    note: 'export-env signing bundle: REVEALUI_LICENSE_PRIVATE_KEY (+ public if needed for self-check). with-secrets license-signing requires REVVAULT_ALLOW_PRIVATE=1',
  },
  // GAP-260 P4-2/P4-3: dedicated HMAC for apps/license-signer mint API.
  // NOT REVEALUI_SECRET. Synced to api after signer soak (P4-4). Fly signer
  // still sets it Fly-direct (skip list).
  {
    path: 'revealui/prod/license/signer-invoke-secret',
    kind: 'credential',
    sensitive: true,
    tier: 'prod',
    consumers: ['app:license-signer', 'vercel:api'],
    envVars: ['REVEALUI_SIGNER_INVOKE_SECRET'],
    note: 'HMAC-SHA256 per-call auth for POST /internal/mint. Consumed by license-signer AND mint-client when REVEALUI_LICENSE_SIGN_VIA_SIGNER is on. No REVEALUI_SECRET fallback. Fly signer sets this Fly-direct (skip).',
  },
  {
    path: 'revealui/prod/license/signer-url',
    kind: 'public-config',
    sensitive: false,
    tier: 'prod',
    consumers: ['vercel:api'],
    envVars: ['REVEALUI_LICENSE_SIGNER_URL'],
    note: 'Base URL for apps/license-signer (GAP-260 P4-3 mint-client). Not a secret. Flag REVEALUI_LICENSE_SIGN_VIA_SIGNER is a plain env toggle (not vaulted).',
  },
];

// ─── RENAME_MAP - retired old path → canonical (value already moved) ─────────
// Only paths whose CONSUMERS already point at the canonical leaf (the retired
// path lingers in the vault as a dead duplicate, awaiting owner delete in P3-3).
// The license migration is NOT here - its value has not moved (see migratingTo).
export const RENAME_MAP: Record<string, string> = {
  'revealui/prod/neon/postgres-url': 'revealui/prod/db/postgres-url', // R9
  'revealui/db/neon-production': 'revealui/prod/db/postgres-url', // R9
};

// ─── Derived sets (modeled on DECLARED_PRODUCT_KEYS) ─────────────────────────
/** Every canonical path declared in SECRET_PATHS. */
export const DECLARED_PATHS: ReadonlySet<string> = new Set(SECRET_PATHS.map((d) => d.path));
/** Paths whose value is sensitive (credential or private signing key). */
export const SENSITIVE_PATHS: ReadonlySet<string> = new Set(
  SECRET_PATHS.filter((d) => d.sensitive).map((d) => d.path),
);
/** Retired old paths that must never reappear in a manifest. */
export const RETIRED_PATHS: ReadonlySet<string> = new Set(Object.keys(RENAME_MAP));
/** The synced prod surface - the doc generated-block + manifest bijection set. */
export const SYNCED_PATHS: ReadonlySet<string> = new Set(
  SECRET_PATHS.filter((d) => !d.intentionallyUnsynced).map((d) => d.path),
);

// ─── Minimal projections the predicates read (fed by the parsed manifests) ───
/** One Vercel/Fly manifest var: its name, the vault path, and whether it is sensitive-marked. */
export interface ManifestVar {
  /** Vercel/Fly env var name (UPPER_SNAKE). */
  name: string;
  /** Vault path the var reads from. */
  path: string;
  /** `sensitive = true` in the manifest inline table (Vercel only; Fly has no marker yet). */
  sensitive: boolean;
  /** Manifest source, for drift messages. */
  source: string;
}

export type DriftKind =
  | 'undeclared-in-spec' // manifest/doc path not in SECRET_PATHS
  | 'missing-from-manifest' // synced spec path absent from every manifest
  | 'missing-from-doc' // synced spec path absent from the rendered generated block
  | 'undeclared-in-doc' // doc generated-block path not in SECRET_PATHS
  | 'retired-path-in-use' // a RENAME_MAP key is actively synced
  | 'sensitivity-mismatch' // manifest sensitive flag disagrees with spec kind
  | 'spec-sensitivity-inconsistent' // SecretPathDef.sensitive !== isSensitiveKind(kind)
  | 'leaf-and-directory' // a path is used as both a leaf and a directory prefix
  | 'non-kebab-leaf' // a path segment is not lower-kebab
  | 'expired-migration'; // migratingSince older than one release window

export interface Drift {
  kind: DriftKind;
  path: string;
  detail: string;
}

// ─── Pure predicates (no I/O, no regex - unit-test with literals) ────────────

const KEBAB_CHARS: ReadonlySet<string> = new Set('abcdefghijklmnopqrstuvwxyz0123456789-');

/** A leaf is lower-kebab: only [a-z0-9-], no leading/trailing/double hyphen, non-empty. */
export function isKebabLeaf(leaf: string): boolean {
  if (leaf.length === 0) return false;
  if (leaf.startsWith('-') || leaf.endsWith('-')) return false;
  if (leaf.includes('--')) return false;
  for (const ch of leaf) {
    if (!KEBAB_CHARS.has(ch)) return false;
  }
  return true;
}

/** Every path whose any segment is not lower-kebab. */
export function findNonKebabPaths(paths: readonly string[]): Drift[] {
  const out: Drift[] = [];
  for (const path of paths) {
    for (const seg of path.split('/')) {
      if (!isKebabLeaf(seg)) {
        out.push({
          kind: 'non-kebab-leaf',
          path,
          detail: `segment '${seg}' is not lower-kebab`,
        });
        break;
      }
    }
  }
  return out;
}

/** A path may be a leaf XOR a directory prefix of another path, never both. */
export function findLeafOrDirViolations(paths: readonly string[]): Drift[] {
  const out: Drift[] = [];
  const all = [...paths];
  for (const p of paths) {
    const prefix = `${p}/`;
    const child = all.find((q) => q !== p && q.startsWith(prefix));
    if (child !== undefined) {
      out.push({
        kind: 'leaf-and-directory',
        path: p,
        detail: `used as both a leaf and a directory prefix of '${child}'`,
      });
    }
  }
  return out;
}

/** SECRET_PATHS self-consistency: sensitive must equal isSensitiveKind(kind). */
export function findSpecSensitivityInconsistencies(defs: readonly SecretPathDef[]): Drift[] {
  const out: Drift[] = [];
  for (const d of defs) {
    if (d.sensitive !== isSensitiveKind(d.kind)) {
      out.push({
        kind: 'spec-sensitivity-inconsistent',
        path: d.path,
        detail: `sensitive=${d.sensitive} but kind='${d.kind}' implies ${isSensitiveKind(d.kind)}`,
      });
    }
  }
  return out;
}

/** Manifest ↔ spec: undeclared manifest paths + synced spec paths missing from every manifest. */
export function findManifestDrift(manifestPaths: readonly string[]): Drift[] {
  const out: Drift[] = [];
  const manifestSet = new Set(manifestPaths);
  for (const path of manifestSet) {
    if (!DECLARED_PATHS.has(path)) {
      out.push({
        kind: 'undeclared-in-spec',
        path,
        detail: 'synced by a manifest but not declared in SECRET_PATHS',
      });
    }
  }
  for (const path of SYNCED_PATHS) {
    if (!manifestSet.has(path)) {
      out.push({
        kind: 'missing-from-manifest',
        path,
        detail: 'declared synced in SECRET_PATHS but absent from every manifest (explicit-listing)',
      });
    }
  }
  return out;
}

/** Rendered generated-block ↔ spec: bijection over the synced surface. */
export function findDocDrift(docPaths: readonly string[]): Drift[] {
  const out: Drift[] = [];
  const docSet = new Set(docPaths);
  for (const path of docSet) {
    if (!DECLARED_PATHS.has(path)) {
      out.push({
        kind: 'undeclared-in-doc',
        path,
        detail: 'present in the SECRETS.md generated block but not in SECRET_PATHS',
      });
    }
  }
  for (const path of SYNCED_PATHS) {
    if (!docSet.has(path)) {
      out.push({
        kind: 'missing-from-doc',
        path,
        detail:
          'declared synced in SECRET_PATHS but not rendered in the SECRETS.md generated block',
      });
    }
  }
  return out;
}

/** No retired (renamed-away) path may be actively synced. */
export function findRetiredPathUsage(manifestPaths: readonly string[]): Drift[] {
  const out: Drift[] = [];
  for (const path of new Set(manifestPaths)) {
    if (RETIRED_PATHS.has(path)) {
      out.push({
        kind: 'retired-path-in-use',
        path,
        detail: `retired - consumers should read the canonical '${RENAME_MAP[path]}'`,
      });
    }
  }
  return out;
}

/**
 * Sensitivity-completeness: every credential-class Vercel var carries
 * sensitive=true, and every public var stays bare. Reads the parsed manifest
 * vars against the spec kind. (Fly has no sensitivity marker yet - P3-3 adds
 * one - so pass Vercel vars only.)
 */
export function findSensitivityGaps(vars: readonly ManifestVar[]): Drift[] {
  const out: Drift[] = [];
  for (const v of vars) {
    if (!DECLARED_PATHS.has(v.path)) continue; // undeclared caught by findManifestDrift
    const expected = SENSITIVE_PATHS.has(v.path);
    if (v.sensitive !== expected) {
      out.push({
        kind: 'sensitivity-mismatch',
        path: v.path,
        detail: `${v.source} var ${v.name} sensitive=${v.sensitive}, spec expects ${expected}`,
      });
    }
  }
  return out;
}

/**
 * A declared migration that has lingered past one release window is a finding.
 * Pure + deterministic: the caller supplies the reference instant and window
 * length (days), so the gate never depends on the wall clock. One release
 * window ≈ 90 days by convention; wiring this to Date.now() as a hard tripwire
 * is a deliberate P3-4 follow-on (when the license value-move must land).
 */
export function findExpiredMigrations(
  defs: readonly SecretPathDef[],
  nowIso: string,
  windowDays = 90,
): Drift[] {
  const out: Drift[] = [];
  const now = Date.parse(nowIso);
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  for (const d of defs) {
    if (d.migratingSince === undefined) continue;
    const since = Date.parse(d.migratingSince);
    if (Number.isNaN(since)) {
      out.push({
        kind: 'expired-migration',
        path: d.path,
        detail: `migratingSince '${d.migratingSince}' is not a parseable date`,
      });
      continue;
    }
    if (now - since > windowMs) {
      out.push({
        kind: 'expired-migration',
        path: d.path,
        detail: `migratingTo '${d.migratingTo}' declared ${d.migratingSince}, past the ${windowDays}-day window - resolve or re-date`,
      });
    }
  }
  return out;
}
