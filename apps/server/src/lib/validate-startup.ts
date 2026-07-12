// Shared live/test classification — same rule the runtime money-boundary guard
// (getStripe) uses, so the boot validator and the request path can't drift.
import {
  classifyStripePublishableKey,
  classifyStripeSecretKey,
} from '@revealui/config/stripe-mode';
import {
  computeKeyId,
  hostMatchesLicensedDomains,
  validateLicenseKey,
} from '@revealui/core/license';
import { getClient } from '@revealui/db/client';
import { billingCatalog } from '@revealui/db/schema';
import { eq } from 'drizzle-orm';
import { REQUIRED_ALWAYS_GROUPS, REQUIRED_IN_PRODUCTION_HOSTED } from './required-env.js';

export type EnvMap = Record<string, string | undefined>;

/**
 * Row shape returned by the billing_catalog lookup. Exported so tests can
 * construct fake rows without depending on @revealui/db's inferred types.
 */
export interface BillingCatalogRow {
  planId: string;
  stripePriceId: string | null;
}

/**
 * All `billing_catalog` plan IDs that must exist with `stripe_price_id`
 * populated when running hosted live-mode (`STRIPE_LIVE_MODE=true`). Format:
 * `<billing_model>:<tier>`.
 *
 * This list is duplicated in `apps/server/src/routes/cron/billing-readiness.ts`
 * (`EXPECTED_PLAN_IDS`) — the lib layer must not import from routes, so the
 * two lists are intentionally separate. A test in
 * `__tests__/validate-startup.test.ts` asserts they stay in sync.
 */
export const EXPECTED_LIVE_PLAN_IDS = [
  'subscription:pro',
  'subscription:max',
  'subscription:enterprise',
  'subscription:pro:year',
  'subscription:max:year',
  'subscription:enterprise:year',
  'perpetual:pro',
  'perpetual:max',
  'perpetual:enterprise',
  'credits:starter',
  'credits:standard',
  'credits:scale',
] as const;

/**
 * Compute which expected live-mode billing-catalog plans are absent (no row at
 * all) or incomplete (row present but `stripe_price_id` is null). Shared by the
 * boot-time validator (`validateBillingCatalogAtStartup`, run only by the Fly
 * worker) AND the per-cold-instance checkout gate in `routes/billing.ts`, so the
 * two enforcement points cannot drift — both derive the expected set from
 * `EXPECTED_LIVE_PLAN_IDS` and apply the identical missing/incomplete predicate.
 */
export function findBillingCatalogGaps(rows: BillingCatalogRow[]): {
  missing: string[];
  incomplete: string[];
} {
  const byPlanId = new Map<string, string | null>(rows.map((r) => [r.planId, r.stripePriceId]));
  const missing: string[] = [];
  const incomplete: string[] = [];
  for (const planId of EXPECTED_LIVE_PLAN_IDS) {
    if (!byPlanId.has(planId)) {
      missing.push(planId);
    } else if (!byPlanId.get(planId)) {
      incomplete.push(planId);
    }
  }
  return { missing, incomplete };
}

/**
 * Where this RevealUI deployment runs.
 *
 * - `hosted`: revealui.com SaaS. We sign per-subscriber license JWTs, so
 *   `REVEALUI_LICENSE_PRIVATE_KEY` is set; entitlement is DB-driven via
 *   `account_entitlements` rows. Strict Stripe + HTTPS posture.
 * - `forge`: self-hosted Forge customer kit (Docker stack from
 *   `forge/stamp.sh`). Customer consumes a studio-issued JWT in
 *   `REVEALUI_LICENSE_KEY` against the master public key in
 *   `REVEALUI_LICENSE_PUBLIC_KEY`. No Stripe, no signing key, can run on
 *   `http://localhost`.
 *
 * Detection is by presence of the signing key: only the studio's hosted
 * deployment has it.
 */
export type DeploymentMode = 'forge' | 'hosted';

/**
 * Options that change validation behavior across runtime vs pre-deploy contexts.
 *
 * - `lenient` (default false): treats empty-string values as "present, sensitive
 *   — trust runtime" rather than "missing". Use this from the pre-deploy
 *   `validate-prod-env` script where Vercel-Sensitive vars pull as empty
 *   strings even though they're populated at runtime. The runtime caller
 *   (apps/server boot) leaves it false so empty-string env vars are caught
 *   as real misconfig, matching the semantics this validator was originally
 *   designed for.
 *
 * Background: Vercel's Sensitive flag (default-on for new env vars in 2026)
 * deliberately excludes values from `vercel pull`'s `.env.production.local`
 * output. The names appear, the values don't. Strict validation fails on
 * the empty values even though the runtime function reads them fine. The
 * lenient flag tells the validator to accept presence-by-name and defer
 * format checks for sensitive values to runtime (where they're available).
 */
export interface ValidateOptions {
  lenient?: boolean;
}

/**
 * Returns true when `key` is set in `env`. Strict semantics treat empty
 * string as missing (so `KEY=""` in a .env file fails validation, matching
 * the original runtime contract). Lenient semantics treat empty string as
 * present (so Sensitive vars that pull empty pre-deploy don't trip the
 * required-presence check).
 */
function isPresent(env: EnvMap, key: string, lenient: boolean): boolean {
  if (lenient) return env[key] !== undefined;
  return Boolean(env[key]);
}

export function detectDeploymentMode(
  env: EnvMap,
  { lenient = false }: ValidateOptions = {},
): DeploymentMode {
  return isPresent(env, 'REVEALUI_LICENSE_PRIVATE_KEY', lenient) ? 'hosted' : 'forge';
}

const REQUIRED_IN_PRODUCTION_FORGE = [
  'REVEALUI_SECRET',
  // REVEALUI_KEK is generated by forge/stamp.sh (RevealUIStudio/revforge#10)
  // and propagated through revvault → docker/.env → both api + admin
  // services. Required here so apps/server refuses to boot if a customer's
  // bootstrap step skipped it; the at-rest encryption guarantee for MCP
  // tokens / OAuth bearer tokens depends on it being present.
  'REVEALUI_KEK',
  'REVEALUI_PUBLIC_SERVER_URL',
  'NEXT_PUBLIC_SERVER_URL',
  // The studio-issued JWT and matching public key. validateLicenseAtStartup
  // verifies the JWT itself; this list just ensures both vars are present so
  // the boot fails with a useful name rather than a generic JWT error.
  'REVEALUI_LICENSE_KEY',
  'REVEALUI_LICENSE_PUBLIC_KEY',
  'CORS_ORIGIN',
] as const;

/**
 * Validate required environment variables at startup so any missing or
 * misformatted config causes a loud failure at boot rather than silently
 * failing on the first real request.
 *
 * Mode dispatch (see DeploymentMode):
 *  - Hosted (revealui.com SaaS) — strict Stripe + HTTPS posture, full
 *    REQUIRED_IN_PRODUCTION_HOSTED list.
 *  - Forge (self-hosted customer kit) — license JWT + public key required;
 *    Stripe / CRON / ALERT_EMAIL / HTTPS-CORS not enforced (customer may run
 *    on `http://localhost` and has no Stripe webhooks back to revealui.com).
 *
 * Layers (in order):
 *  1. Always-required presence — POSTGRES_URL, NODE_ENV
 *  2. Production-required presence — mode-specific list
 *  3. Production format — KEK / SECRET / URL parity shared across modes;
 *     Stripe / HTTPS-only URLs / CORS-HTTPS / cron-secret length / alert-
 *     email format are hosted-only.
 *
 * `STRIPE_LIVE_MODE` toggle (hosted mode only):
 *   - When `STRIPE_LIVE_MODE=true`: enforces `sk_live_` / `pk_live_` prefixes
 *     (real customer money flows).
 *   - When `STRIPE_LIVE_MODE` is unset or any other value: enforces `sk_test_`
 *     / `pk_test_` prefixes and emits a loud boot-time warning that the API
 *     is running with TEST Stripe keys in production. This is the
 *     pre-launch / pre-LLC / pre-billing-audit posture (gated on GAP-124,
 *     internal tracker).
 *
 * Honors `SKIP_ENV_VALIDATION=true` so Docker-build and other build-only
 * contexts can compile without live credentials present. Forge customer
 * RUNTIME containers must NOT set this — boot-time license enforcement
 * (validateLicenseAtStartup) honors the same flag.
 *
 * Takes `env` as an argument (defaulted to `process.env`) so tests can pass
 * explicit fixtures without touching real process state.
 */
export function validateStartup(
  env: EnvMap = process.env as EnvMap,
  { lenient = false }: ValidateOptions = {},
): void {
  if (env.SKIP_ENV_VALIDATION === 'true') {
    return;
  }

  // Local helper: in lenient (pre-deploy) mode, skip format checks on empty
  // values — those represent Vercel-Sensitive vars whose values are hidden
  // from `vercel pull` but populated at runtime. The runtime call (lenient
  // false) still validates format strictly so a misconfigured `KEY=""` in a
  // .env file fails loudly.
  const skipFormat = (value: string): boolean => lenient && value === '';

  const missingGroups = REQUIRED_ALWAYS_GROUPS.filter(
    (group) => !group.some((key) => isPresent(env, key, lenient)),
  );
  if (missingGroups.length > 0) {
    const missingNames = missingGroups.map((group) =>
      group.length > 1 ? `${group.join(' or ')}` : group[0],
    );
    throw new Error(
      `STARTUP VALIDATION FAILED: Missing required environment variables: ${missingNames.join(', ')}. ` +
        'Check your .env file or deployment configuration.',
    );
  }

  if (env.NODE_ENV !== 'production') {
    return;
  }

  const mode = detectDeploymentMode(env, { lenient });
  const required = mode === 'forge' ? REQUIRED_IN_PRODUCTION_FORGE : REQUIRED_IN_PRODUCTION_HOSTED;
  const missingProd = required.filter((key) => !isPresent(env, key, lenient));
  if (missingProd.length > 0) {
    throw new Error(
      `STARTUP VALIDATION FAILED (${mode} mode): Missing production-required env vars: ${missingProd.join(', ')}.`,
    );
  }

  const errors: string[] = [];

  // ── Format checks that apply in BOTH modes ────────────────────────

  // KEK — exactly 64 hex characters (32 bytes / 256 bits). Required in
  // both modes (hosted + forge), so missing-presence is caught by the
  // REQUIRED check above; we always run the format check here.
  const kek = env.REVEALUI_KEK ?? '';
  if (!(skipFormat(kek) || /^[0-9a-f]{64}$/i.test(kek))) {
    errors.push('REVEALUI_KEK must be exactly 64 hexadecimal characters (256 bits).');
  }

  // Optional dual-key boot (zero-downtime KEK rotation). Only validated when
  // present — empty/unset is the steady state. When set, must be 64 hex
  // chars since the crypto layer uses it as the primary encrypt key + first
  // decrypt attempt during the rotation window.
  // See docs/runbooks/rotate-kek.md §Zero-downtime path.
  const kekNext = (env.REVEALUI_KEK_NEXT ?? '').trim();
  if (kekNext && !/^[0-9a-f]{64}$/i.test(kekNext)) {
    errors.push(
      'REVEALUI_KEK_NEXT must be exactly 64 hexadecimal characters when set (transitional key during dual-key rotation).',
    );
  }

  // Secret minimum length — required in both modes, so always set here.
  const secret = env.REVEALUI_SECRET ?? '';
  if (!skipFormat(secret) && secret.length < 32) {
    errors.push('REVEALUI_SECRET must be at least 32 characters.');
  }

  // Audit HMAC signing secret — required in both modes. Mirrors the fallback
  // getAuditSecret() uses at write time (postgres-audit-storage.ts):
  // REVEALUI_AUDIT_HMAC_SECRET, falling back to REVEALUI_SECRET. That runtime
  // check throws per-write into a swallowing `.catch()`, so a misconfigured
  // deploy served traffic for however long it took someone to notice the
  // audit trail was silent. Checking the same effective value here means a
  // server that cannot sign the audit log refuses to boot instead — this
  // duplicates (does not replace) getAuditSecret()'s own defense-in-depth
  // throw. REVEALUI_SECRET is already REQUIRED_IN_PRODUCTION_{HOSTED,FORGE}
  // above, so in a correctly configured deploy this branch is unreachable;
  // it exists to catch the same impossible states getAuditSecret() guards
  // against (env tampering mid-run) at boot instead of at the first write.
  const auditHmacSecret = env.REVEALUI_AUDIT_HMAC_SECRET ?? env.REVEALUI_SECRET ?? '';
  if (!skipFormat(auditHmacSecret)) {
    if (!auditHmacSecret) {
      errors.push(
        'REVEALUI_AUDIT_HMAC_SECRET (or REVEALUI_SECRET fallback) is required — ' +
          'a server that cannot sign the audit log must not serve traffic. ' +
          'See docs/SECRETS.md.',
      );
    } else if (auditHmacSecret.length < 32) {
      errors.push(
        'REVEALUI_AUDIT_HMAC_SECRET (or REVEALUI_SECRET fallback) must be at least 32 characters.',
      );
    }
  }

  // URL parity — if both are set, they must match. Applies in both modes.
  const publicUrl = env.REVEALUI_PUBLIC_SERVER_URL ?? '';
  const nextPublicUrl = env.NEXT_PUBLIC_SERVER_URL ?? '';
  if (publicUrl && nextPublicUrl && publicUrl !== nextPublicUrl) {
    errors.push('REVEALUI_PUBLIC_SERVER_URL and NEXT_PUBLIC_SERVER_URL must match.');
  }

  // ── Hosted-mode-specific checks ───────────────────────────────────
  if (mode === 'hosted') {
    const stripeLiveMode = env.STRIPE_LIVE_MODE === 'true';
    if (!stripeLiveMode) {
      emitStripeTestModeWarning();
    }

    // Stripe secret key — environment must match STRIPE_LIVE_MODE. The live/test
    // prefix rule is shared with the runtime money-boundary guard (getStripe)
    // via @revealui/services/stripe/mode; `unknown` (empty/malformed) keys fail
    // the strict boot check in both modes exactly as the old startsWith checks did.
    const stripeSecretKey = env.STRIPE_SECRET_KEY ?? '';
    if (!skipFormat(stripeSecretKey)) {
      const secretKeyMode = classifyStripeSecretKey(stripeSecretKey);
      if (stripeLiveMode) {
        if (secretKeyMode !== 'live') {
          errors.push(
            'STRIPE_SECRET_KEY must be a live key (sk_live_...) when STRIPE_LIVE_MODE=true.',
          );
        }
      } else if (secretKeyMode !== 'test') {
        errors.push(
          'STRIPE_SECRET_KEY must be a test key (sk_test_...) when STRIPE_LIVE_MODE is unset/false. ' +
            'Set STRIPE_LIVE_MODE=true to use live keys (gated on the billing-readiness audit).',
        );
      }
    }

    // Stripe publishable key (optional, but if set it must match the mode).
    const stripePublishable = env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (stripePublishable) {
      const publishableKeyMode = classifyStripePublishableKey(stripePublishable);
      if (stripeLiveMode) {
        if (publishableKeyMode !== 'live') {
          errors.push(
            'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY must be a live key (pk_live_...) when STRIPE_LIVE_MODE=true.',
          );
        }
      } else if (publishableKeyMode !== 'test') {
        errors.push(
          'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY must be a test key (pk_test_...) when STRIPE_LIVE_MODE is unset/false.',
        );
      }
    }

    // Stripe webhook signing secret — `whsec_` prefix in both Stripe modes.
    const webhookSecret = env.STRIPE_WEBHOOK_SECRET ?? '';
    if (!(skipFormat(webhookSecret) || webhookSecret.startsWith('whsec_'))) {
      errors.push('STRIPE_WEBHOOK_SECRET must start with "whsec_" in production.');
    }

    // Live-mode webhook signing secret. The webhook handler PREFERS this over
    // STRIPE_WEBHOOK_SECRET when set, so a malformed value boots clean and then
    // silently 400s every live webhook (no boot signal — the alert path is
    // post-verification). Validate format when set; empty = handler falls back
    // to STRIPE_WEBHOOK_SECRET, so this is not required.
    const liveWebhookSecret = (env.STRIPE_WEBHOOK_SECRET_LIVE ?? '').trim();
    if (liveWebhookSecret && !liveWebhookSecret.startsWith('whsec_')) {
      errors.push(
        'STRIPE_WEBHOOK_SECRET_LIVE must start with "whsec_" when set (preferred by the webhook handler in live mode).',
      );
    }

    // Optional dual-secret rotation transition (GAP-144). Only validated when
    // present — empty/unset is the steady state. When set, must be a valid
    // whsec_ secret since the webhook handler will use it as a fallback verifier.
    const previousWebhookSecret = (env.STRIPE_WEBHOOK_SECRET_LIVE_PREVIOUS ?? '').trim();
    if (previousWebhookSecret && !previousWebhookSecret.startsWith('whsec_')) {
      errors.push(
        'STRIPE_WEBHOOK_SECRET_LIVE_PREVIOUS must start with "whsec_" when set (transitional secret used during webhook signing-key rotation).',
      );
    }

    // HTTPS-only URLs (hosted mode runs on revealui.com).
    if (!(skipFormat(publicUrl) || publicUrl.startsWith('https://'))) {
      errors.push('REVEALUI_PUBLIC_SERVER_URL must use HTTPS in production.');
    }
    if (!(skipFormat(nextPublicUrl) || nextPublicUrl.startsWith('https://'))) {
      errors.push('NEXT_PUBLIC_SERVER_URL must use HTTPS in production.');
    }

    // Cron secret length (hosted-only — Forge customers don't have crons
    // calling back into revealui.com).
    const cronSecret = env.REVEALUI_CRON_SECRET ?? '';
    if (!skipFormat(cronSecret) && cronSecret.length < 32) {
      errors.push('REVEALUI_CRON_SECRET must be at least 32 characters.');
    }

    // Alert email format (hosted-only — primary use is unreconciled Stripe
    // webhooks; Forge customers can configure but aren't required to).
    const alertEmail = env.REVEALUI_ALERT_EMAIL ?? '';
    if (!(skipFormat(alertEmail) || alertEmail.includes('@'))) {
      errors.push(
        `REVEALUI_ALERT_EMAIL is not a valid email (got: ${JSON.stringify(alertEmail)}).`,
      );
    }

    // Sentry DSN format — must be a valid URL. Sentry DSNs follow the shape
    // https://<key>@<org>.ingest.sentry.io/<projectId>. Rather than encoding
    // that shape as a regex (no-regex-authored rule), we parse with the URL
    // constructor: any valid DSN is also a valid HTTPS URL, and anything that
    // fails URL parsing is definitely wrong. Hosted-only — Forge customers run
    // self-hosted without Sentry. Required so a missing DSN doesn't silently
    // disable Sentry capture (incl. checkout-route HTTPException path).
    // GAP-S1 / Phase 1 audit J-P0-1; hotfix #744 (hosted requirement).
    const sentryDsn = env.SENTRY_DSN ?? '';
    if (!skipFormat(sentryDsn)) {
      let sentryDsnValid = false;
      try {
        const parsed = new URL(sentryDsn);
        sentryDsnValid = parsed.protocol === 'https:';
      } catch {
        sentryDsnValid = false;
      }
      if (!sentryDsnValid) {
        errors.push(
          `SENTRY_DSN must be a valid HTTPS URL (e.g. https://<key>@<org>.ingest.sentry.io/<projectId>). Got: ${JSON.stringify(sentryDsn)}.`,
        );
      }
    }

    // CORS_ORIGIN is comma-separated; every origin must be HTTPS in hosted prod.
    const corsOriginRaw = env.CORS_ORIGIN ?? '';
    if (!skipFormat(corsOriginRaw)) {
      const nonHttpsOrigins = corsOriginRaw
        .split(',')
        .map((o) => o.trim())
        .filter((o) => o.length > 0 && !o.startsWith('https://'));
      if (nonHttpsOrigins.length > 0) {
        errors.push(
          `CORS_ORIGIN must contain only HTTPS origins in production. Got non-HTTPS: ${nonHttpsOrigins.join(', ')}.`,
        );
      }
    }
  }

  // ── x402 native payment activation (mode-agnostic) ────────────────
  // When operators flip X402_ENABLED=true, a non-empty receiving address
  // must be configured — otherwise 402 responses would advertise an empty
  // payTo and drop payments. See docs/architecture/x402.md for activation.
  if (env.X402_ENABLED === 'true') {
    const receivingAddress = env.X402_RECEIVING_ADDRESS ?? '';
    if (!receivingAddress) {
      errors.push(
        'X402_ENABLED=true requires X402_RECEIVING_ADDRESS (USDC receiving wallet) to be set. ' +
          'See docs/architecture/x402.md for activation steps.',
      );
    } else if (!/^0x[0-9a-f]{40}$/i.test(receivingAddress)) {
      errors.push(
        `X402_RECEIVING_ADDRESS must be a 0x-prefixed 40-hex EVM address. Got: ${JSON.stringify(receivingAddress)}.`,
      );
    }
  }

  if (errors.length > 0) {
    throw new Error(`STARTUP VALIDATION FAILED:\n  - ${errors.join('\n  - ')}`);
  }
}

/**
 * Extracts the `kid` (key id) from a JWT's protected header WITHOUT verifying
 * the signature. Returns undefined when the token is malformed or carries no
 * `kid` (older tokens issued before the issuer paired a public key). Uses only
 * built-in parsers (base64url decode + JSON.parse): no authored regex and no
 * jose import at the boot layer. Used purely to sharpen the error message once
 * cryptographic verification has ALREADY failed; never as a verification step.
 */
function decodeJwtKid(jwt: string): string | undefined {
  const headerSegment = jwt.split('.')[0];
  if (!headerSegment) return undefined;
  try {
    const header: unknown = JSON.parse(Buffer.from(headerSegment, 'base64url').toString('utf8'));
    if (header && typeof header === 'object' && 'kid' in header) {
      const { kid } = header as { kid?: unknown };
      return typeof kid === 'string' ? kid : undefined;
    }
  } catch {
    // Malformed header segment. Fall through; the caller's generic
    // "invalid license" path surfaces the real failure.
  }
  return undefined;
}

/**
 * Boot-time license enforcement for self-hosted (Forge) deployments.
 *
 * The hosted SaaS deployment (apps/server on Vercel for revealui.com) signs
 * license JWTs for paying subscribers, so REVEALUI_LICENSE_PRIVATE_KEY is
 * always set there — entitlement comes from `account_entitlements` rows,
 * not from an env-var JWT. Boot-time license enforcement is a no-op in
 * that mode.
 *
 * Self-hosted Forge customer deployments don't have the studio's signing
 * key — they only consume a JWT signed by the studio, plus the matching
 * public key. We detect Forge mode by the absence of
 * REVEALUI_LICENSE_PRIVATE_KEY and, when in that mode:
 *
 *   - REVEALUI_LICENSE_KEY must be set (the studio-issued JWT)
 *   - REVEALUI_LICENSE_PUBLIC_KEY must be set (master verification key)
 *   - The JWT must verify cleanly (signature + expiry, with the
 *     subscription grace window from `@revealui/core/license`)
 *
 * Throws on any failure so the API refuses to boot rather than silently
 * degrading to free tier (which is `initializeLicense`'s default
 * behavior). This is the gate that makes a stamped Forge kit honor its
 * license — without it, an expired or tampered key would still let the
 * stack come up.
 *
 * Honors `SKIP_ENV_VALIDATION=true` so Docker-build contexts and tests
 * can compile without live credentials present. Takes `env` as an
 * argument (defaulted to `process.env`) so tests can pass explicit
 * fixtures.
 */
export async function validateLicenseAtStartup(env: EnvMap = process.env as EnvMap): Promise<void> {
  if (env.SKIP_ENV_VALIDATION === 'true') {
    return;
  }

  // Mode detection: absence of the signing key = self-hosted Forge customer.
  if (detectDeploymentMode(env) !== 'forge') {
    return;
  }

  if (!env.REVEALUI_LICENSE_KEY) {
    throw new Error(
      'LICENSE VALIDATION FAILED: REVEALUI_LICENSE_KEY is required for RevForge deployments. ' +
        'Run bin/revvault-bootstrap.sh to materialize docker/.env from revvault, ' +
        'or contact the operator who stamped this kit.',
    );
  }
  if (!env.REVEALUI_LICENSE_PUBLIC_KEY) {
    throw new Error(
      'LICENSE VALIDATION FAILED: REVEALUI_LICENSE_PUBLIC_KEY is required for RevForge deployments. ' +
        'Stamped kits embed this value in docker/.env.example; check that it survived the bootstrap step.',
    );
  }

  // Restore real newlines if the public key landed as a single-line PEM
  // (the .env-encoded format that stamp.sh produces). Split/join, no authored
  // regex — mirrors @revealui/core/license normalizePem. GAP-259 P0-4.
  const publicKey = env.REVEALUI_LICENSE_PUBLIC_KEY.split('\\n').join('\n');
  // Phase 1 audit B-2: bind the license to a specific customer when the
  // operator has provided REVEALUI_LICENSED_CUSTOMER_ID. Without this, a
  // leaked JWT from one customer would license another customer's
  // deployment. Hosted mode does not set this — the deployment IS the
  // customer. Forge stamping should set it (revforge#NN tracking).
  const expectedCustomerId = env.REVEALUI_LICENSED_CUSTOMER_ID || undefined;
  const payload = await validateLicenseKey(env.REVEALUI_LICENSE_KEY, publicKey, expectedCustomerId);
  if (!payload) {
    // Sharpen the most common (and most confusing) stamping failure: the kit
    // baked a REVEALUI_LICENSE_PUBLIC_KEY that is not the verification key for
    // the issued JWT. Our issuer embeds a `kid` (a short digest of the paired
    // public key) in every token, so a token whose kid does not match the
    // configured public key's id was provably signed by a different key. We
    // consult the kid only HERE, after cryptographic verification has already
    // failed, so a public key that is correct but merely formatted differently
    // (validateLicenseKey verifies key material, not PEM bytes) can never reach
    // this branch and produce a false "wrong key" message.
    const tokenKid = decodeJwtKid(env.REVEALUI_LICENSE_KEY);
    if (tokenKid !== undefined) {
      const expectedKid = await computeKeyId(publicKey);
      if (tokenKid !== expectedKid) {
        throw new Error(
          'LICENSE VALIDATION FAILED: REVEALUI_LICENSE_PUBLIC_KEY does not match the key that ' +
            `signed REVEALUI_LICENSE_KEY (license key id "${tokenKid}", configured public key id ` +
            `"${expectedKid}"). The stamped kit baked the wrong public key. Re-issue the license ` +
            'with the matching keypair, or bake the public key that pairs with the signing key, ' +
            'then re-run bin/revvault-bootstrap.sh. Contact the operator who stamped this kit.',
        );
      }
    }
    throw new Error(
      'LICENSE VALIDATION FAILED: REVEALUI_LICENSE_KEY is invalid, expired beyond grace, ' +
        'signed with a key that does not match REVEALUI_LICENSE_PUBLIC_KEY, or its ' +
        'customerId does not match REVEALUI_LICENSED_CUSTOMER_ID (if set). ' +
        'Contact the operator who stamped this kit to re-issue the license.',
    );
  }

  // Domain binding: when the license restricts domains, the configured public
  // server URL must resolve to a licensed host. The allowed domains come from
  // the signed JWT `domains` claim (cryptographically bound), so this cannot
  // be bypassed by editing an env var. REVEALUI_PUBLIC_SERVER_URL presence is
  // enforced separately in validateStartup's forge-mode REQUIRED list (prod);
  // when it is absent here (e.g. dev), skip — request-time `requireDomain` is
  // the per-request gate. localhost/127.0.0.1 pass via the shared matcher so a
  // trial kit on its default http://localhost still boots.
  if (payload.domains && payload.domains.length > 0) {
    const publicUrl = (env.REVEALUI_PUBLIC_SERVER_URL ?? env.NEXT_PUBLIC_SERVER_URL ?? '').trim();
    if (publicUrl) {
      let host = '';
      try {
        host = new URL(publicUrl).hostname;
      } catch {
        host = '';
      }
      if (!hostMatchesLicensedDomains(host, payload.domains)) {
        throw new Error(
          'LICENSE VALIDATION FAILED: this license is restricted to ' +
            `[${payload.domains.join(', ')}], but REVEALUI_PUBLIC_SERVER_URL host ` +
            `"${host || '(unparseable)'}" is not among them. Set REVEALUI_PUBLIC_SERVER_URL ` +
            'to a licensed domain, or contact the operator who stamped this kit.',
        );
      }
    }
  }
}

/**
 * Fetch the live-mode `billing_catalog` rows via the shared Drizzle client.
 * Exported so BOTH the boot-time validator (injectable for tests) AND the
 * checkout gate in `routes/billing.ts` issue the identical query — checking the
 * live-mode rows specifically (test rows may be partially seeded before cutover).
 */
export async function fetchLiveBillingCatalogRows(): Promise<BillingCatalogRow[]> {
  const db = getClient();
  return (
    db
      .select({
        planId: billingCatalog.planId,
        stripePriceId: billingCatalog.stripePriceId,
      })
      .from(billingCatalog)
      // This validator only runs when STRIPE_LIVE_MODE=true, so it checks the
      // live-mode catalog rows specifically (test rows may be partially seeded).
      .where(eq(billingCatalog.mode, 'live'))
  );
}

/**
 * Validate that the `billing_catalog` table is fully seeded for live mode.
 *
 * Runs only when ALL of:
 *   - `NODE_ENV === 'production'`
 *   - mode === 'hosted' (skip Forge — no Stripe, no catalog)
 *   - `STRIPE_LIVE_MODE === 'true'` (skip test mode — catalog can be
 *     partially seeded before the live-key cutover)
 *
 * Throws if any expected plan is missing OR has null `stripe_price_id`.
 * This prevents the failure mode where a customer's checkout reaches the
 * Stripe price lookup at runtime, can't find a row, and 500s mid-customer-
 * transaction. The daily billing-readiness cron at
 * `apps/server/src/routes/cron/billing-readiness.ts` already detects this
 * and emails an alert, but that's after-the-fact; this validator fails
 * boot so a misconfigured deploy never accepts traffic.
 *
 * `fetchRows` is injectable so tests can pass fixture data without
 * mocking the DB module. The production caller relies on the default.
 *
 * Honors `SKIP_ENV_VALIDATION=true` so Docker-build and other build-only
 * contexts can compile without a live DB connection. Takes `env` as an
 * argument so tests can pass explicit fixtures.
 */
export async function validateBillingCatalogAtStartup(
  env: EnvMap = process.env as EnvMap,
  fetchRows: () => Promise<BillingCatalogRow[]> = fetchLiveBillingCatalogRows,
): Promise<void> {
  if (env.SKIP_ENV_VALIDATION === 'true') return;
  if (env.NODE_ENV !== 'production') return;
  if (detectDeploymentMode(env) !== 'hosted') return;
  if (env.STRIPE_LIVE_MODE !== 'true') return;

  const rows = await fetchRows();
  const { missing, incomplete } = findBillingCatalogGaps(rows);

  if (missing.length === 0 && incomplete.length === 0) return;

  const details: string[] = [];
  if (missing.length > 0) {
    details.push(`missing rows: ${missing.join(', ')}`);
  }
  if (incomplete.length > 0) {
    details.push(`null stripe_price_id: ${incomplete.join(', ')}`);
  }

  throw new Error(
    'BILLING CATALOG VALIDATION FAILED (live mode): ' +
      `${details.join('; ')}. ` +
      'Run `pnpm tsx scripts/setup/seed-billing.ts` against the live Stripe account ' +
      'to populate billing_catalog with real stripe_price_id values, then redeploy.',
  );
}

/**
 * Exposed so tests can assert this list stays in sync with the cron file.
 * Not meant for runtime callers — they should treat the validator's
 * behavior (throws on missing/incomplete) as the contract.
 */
export const EXPECTED_LIVE_PLAN_IDS_FOR_TEST = EXPECTED_LIVE_PLAN_IDS;

/**
 * Emitted once per cold start when running in production with
 * `STRIPE_LIVE_MODE` unset/false. Made loud + visible so a quick scan of
 * Vercel runtime logs (or a console pull) makes the test-mode posture
 * unmistakable. Exported separately so tests can spy on the emission.
 */
export function emitStripeTestModeWarning(): void {
  const banner = [
    '',
    '⚠️  ╔══════════════════════════════════════════════════════════════════╗',
    '⚠️  ║  STRIPE TEST MODE in production                                  ║',
    '⚠️  ║                                                                  ║',
    '⚠️  ║  STRIPE_LIVE_MODE is unset/false. apps/server accepts test Stripe   ║',
    '⚠️  ║  keys (sk_test_*, pk_test_*) and NO real customer money flows   ║',
    '⚠️  ║  through these endpoints. The Stripe SDK will route requests to ║',
    '⚠️  ║  the test environment.                                           ║',
    '⚠️  ║                                                                  ║',
    '⚠️  ║  Flip STRIPE_LIVE_MODE=true ONLY after the billing-readiness     ║',
    '⚠️  ║  audit (internal GAP-124) closes — every money-touching path    ║',
    '⚠️  ║  must be bulletproof first.                                      ║',
    '⚠️  ╚══════════════════════════════════════════════════════════════════╝',
    '',
    '',
  ].join('\n');
  // Direct stderr write (rather than the standard console facade) per
  // the project's noConsole lint rule. Semantically this is a warning,
  // and stderr is the canonical destination — Vercel captures it as a
  // runtime log identically to a higher-level warning facade.
  process.stderr.write(banner);
}
