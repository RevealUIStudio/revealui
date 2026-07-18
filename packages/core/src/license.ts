/**
 * License validation for RevealUI Pro/Enterprise tiers.
 *
 * Edge-compatible: uses the Web Crypto API (`crypto.subtle`) and `jose`
 * exclusively. Safe to import from any runtime (Node, Edge, browser,
 * Workers). No `node:crypto` or filesystem dependencies.
 *
 * @dependencies
 * - jose - JWT signing/verification (Web Crypto API)
 * - zod - Schema validation for license payloads
 */

// jose is imported lazily inside async functions to avoid Turbopack's
// async module initialization ordering issue (see #399). Top-level
// import of jose triggers an asyncModule wrapper that can race with
// other modules in the auth route bundle during page data collection.
import { z } from 'zod';
import { decryptLicenseKey } from './license-encryption.js';
import { logger } from './utils/logger.js';

async function getJose() {
  return await import('jose');
}

/** JWT issuer and audience for license tokens — prevents cross-environment replay */
const LICENSE_ISSUER = process.env.REVEALUI_LICENSE_ISSUER ?? 'https://revealui.com';
const LICENSE_AUDIENCE = process.env.REVEALUI_LICENSE_AUDIENCE ?? 'revealui-license';

/** Available license tiers */
export type LicenseTier = 'free' | 'pro' | 'max' | 'enterprise';

/**
 * License operating mode — determines how the system behaves when license
 * checks encounter various failure conditions.
 *
 * - active: License is valid and current
 * - grace: License has an issue but is within a grace period (still allowed)
 * - read-only: Perpetual support lapsed past grace — reads allowed, writes blocked
 * - expired: Grace period exhausted — degraded to free tier
 * - invalid: Signature invalid or tampered — hard fail
 * - missing: No license configured — free tier
 */
export type LicenseMode = 'active' | 'grace' | 'read-only' | 'expired' | 'invalid' | 'missing';

/** Detailed result from license status check */
export interface LicenseCheckResult {
  /** Whether the requested action is allowed */
  allowed: boolean;
  /** Current effective tier */
  tier: LicenseTier;
  /** Operating mode */
  mode: LicenseMode;
  /** Human-readable reason for the current mode */
  reason?: string;
  /** Milliseconds remaining in grace period (undefined if not in grace) */
  graceRemainingMs?: number;
  /** Whether writes should be blocked (read-only mode for lapsed perpetual) */
  readOnly: boolean;
}

/** Grace period configuration (in days). Overridable via env for testing. */
export interface GracePeriodConfig {
  /** Days after subscription expiry before degrading to free (default: 3) */
  subscriptionDays: number;
  /** Days after perpetual support lapse before read-only mode (default: 30) */
  perpetualDays: number;
  /** Days of cached-license grace when infra is unreachable (default: 7) */
  infraDays: number;
}

const DEFAULT_GRACE: GracePeriodConfig = {
  subscriptionDays: parseEnvInt('LICENSE_GRACE_SUBSCRIPTION_DAYS', 3),
  perpetualDays: parseEnvInt('LICENSE_GRACE_PERPETUAL_DAYS', 30),
  infraDays: parseEnvInt('LICENSE_GRACE_INFRA_DAYS', 7),
};

function parseEnvInt(key: string, fallback: number): number {
  const val = process.env[key];
  if (val) {
    const parsed = Number.parseInt(val, 10);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return fallback;
}

let graceConfig: GracePeriodConfig = { ...DEFAULT_GRACE };

/**
 * Configure grace period durations. Useful for testing.
 */
export function configureGracePeriods(overrides: Partial<GracePeriodConfig>): void {
  graceConfig = { ...DEFAULT_GRACE, ...overrides };
}

/** Decoded license payload schema */
const licensePayloadSchema = z.object({
  /** License tier */
  tier: z.enum(['pro', 'max', 'enterprise']),
  /** Organization or customer ID — must be non-empty; used to bind the token to a specific customer */
  customerId: z.string().min(1),
  /** JWT ID — used for per-token revocation; every issued token must carry one */
  jti: z.string().min(1),
  /** Licensed domain(s) */
  domains: z.array(z.string()).optional(),
  /** Maximum number of sites allowed */
  maxSites: z.number().int().positive().optional(),
  /** Maximum number of users/editors allowed */
  maxUsers: z.number().int().positive().optional(),
  /**
   * True for one-time perpetual purchases.
   * When set, the exp claim is omitted from the JWT and isLicensed() skips
   * expiry checks  -  the license is valid as long as it hasn't been revoked.
   */
  perpetual: z.boolean().optional(),
  /** License issued-at timestamp */
  iat: z.number().optional(),
  /** License expiration timestamp  -  absent for perpetual licenses */
  exp: z.number().optional(),
});

export type LicensePayload = z.infer<typeof licensePayloadSchema>;

/** License cache TTL configuration */
export interface LicenseCacheConfig {
  /** Cache TTL in milliseconds (default: 15 seconds) */
  ttlMs: number;
}

const DEFAULT_TTL_MS = 15_000; // 15 seconds  -  revoked licenses lose access quickly

/**
 * Hard cap on cache TTL. Any env override exceeding this is clamped + warned.
 * Revoked licenses must not stay cached longer than this, regardless of
 * operator misconfiguration. 15 minutes balances revocation responsiveness
 * against DB load for high-traffic deployments.
 *
 * Tracked by MASTER_PLAN §CR-8 CR8-P1-05.
 */
export const MAX_LICENSE_CACHE_TTL_MS = 15 * 60 * 1000;

/**
 * Parse and validate the `LICENSE_CACHE_TTL_MS` env value.
 *
 * Rules:
 * - Unset / non-numeric / non-positive → `DEFAULT_TTL_MS` (15s)
 * - Above `MAX_LICENSE_CACHE_TTL_MS` → clamped to cap, warning emitted
 * - Otherwise → parsed value
 *
 * Exported for unit testing. Production code uses the module-load-time
 * evaluation in `DEFAULT_CACHE_CONFIG` below.
 */
export function parseLicenseCacheTtlEnv(envValue: string | undefined): number {
  if (!envValue) return DEFAULT_TTL_MS;
  const parsed = Number.parseInt(envValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_TTL_MS;
  if (parsed > MAX_LICENSE_CACHE_TTL_MS) {
    logger.warn(
      `LICENSE_CACHE_TTL_MS=${parsed} exceeds the ${MAX_LICENSE_CACHE_TTL_MS}ms (15-minute) cap; using ${MAX_LICENSE_CACHE_TTL_MS}. Longer TTLs extend the window where revoked licenses retain access and are not permitted.`,
    );
    return MAX_LICENSE_CACHE_TTL_MS;
  }
  return parsed;
}

const DEFAULT_CACHE_CONFIG: LicenseCacheConfig = {
  ttlMs: parseLicenseCacheTtlEnv(process.env.LICENSE_CACHE_TTL_MS),
};

let cacheConfig: LicenseCacheConfig = { ...DEFAULT_CACHE_CONFIG };
let cachedAt = 0;

/**
 * Configure the license cache TTL.
 * Useful for tests (short TTL) or deployments needing faster revocation detection.
 */
export function configureLicenseCache(overrides: Partial<LicenseCacheConfig>): void {
  cacheConfig = { ...DEFAULT_CACHE_CONFIG, ...overrides };
}

/** Cached license state */
interface LicenseState {
  tier: LicenseTier;
  payload: LicensePayload | null;
  validatedAt: number | null;
  /** True when a license key was configured but failed validation (expired, invalid, etc.) */
  keyPresentButInvalid: boolean;
}

let cachedState: LicenseState = {
  tier: 'free',
  payload: null,
  validatedAt: null,
  keyPresentButInvalid: false,
};

/**
 * Restore real newlines in a PEM stored single-line with literal `\n`
 * (Docker / .env files commonly do this). Fixed-string split/join — no
 * authored regex, per the fleet no-regex rule.
 */
export function normalizePem(raw: string): string {
  return raw.split('\\n').join('\n');
}

/**
 * The ordered public-key candidates used to verify license JWTs.
 *
 * Index 0 is the current key (`REVEALUI_LICENSE_PUBLIC_KEY`); index 1, when
 * present, is the incoming rotation key (`REVEALUI_LICENSE_PUBLIC_KEY_NEXT`).
 * During a zero-downtime key rotation BOTH are configured at once, so a token
 * signed by EITHER key verifies GREEN and no customer is interrupted while
 * re-minted tokens propagate. In production the current key is provisioned
 * from the license server; both read from env here.
 *
 * Exported so the hosted boot canary (`apps/server` validate path) builds the
 * SAME ordered, newline-normalized list the request path uses — a NEXT-signed
 * token must pass the canary during a rotation window exactly as it passes a
 * live request.
 */
export function getPublicKeys(): string[] {
  const keys: string[] = [];
  const current = process.env.REVEALUI_LICENSE_PUBLIC_KEY;
  if (current) keys.push(normalizePem(current));
  const next = process.env.REVEALUI_LICENSE_PUBLIC_KEY_NEXT;
  if (next) keys.push(normalizePem(next));
  return keys;
}

/**
 * Reads the license key from environment.
 * Supports encrypted keys (enc:iv:ciphertext:tag format) via REVEALUI_LICENSE_ENCRYPTION_KEY.
 */
async function getLicenseKey(): Promise<string | null> {
  const raw = process.env.REVEALUI_LICENSE_KEY ?? null;
  if (!raw) return null;
  return decryptLicenseKey(raw);
}

/**
 * Computes a deterministic Key ID (kid) from a public key PEM string.
 * Returns the first 8 characters of the SHA-256 hex digest of the PEM.
 *
 * Async because it uses `crypto.subtle.digest` for full edge compatibility.
 */
export async function computeKeyId(publicKeyPem: string): Promise<string> {
  const encoded = new TextEncoder().encode(publicKeyPem);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', encoded));
  let hex = '';
  // Only the first 4 bytes (8 hex chars) — enough to identify rotated keys.
  for (const b of digest.subarray(0, 4)) {
    hex += b.toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Validates a license key JWT and returns the decoded payload.
 * Returns null if the key is invalid, expired, or missing.
 *
 * Multi-key rotation (GAP-259 P0-3): `publicKey` accepts either a single PEM
 * or an ORDERED list of candidate PEMs (current first, then the incoming
 * rotation key). The token is verified against each candidate in turn and is
 * accepted on the FIRST success; it is rejected only when EVERY candidate
 * fails. The JWT `kid` header (a SHA-256 fingerprint via `computeKeyId`) is a
 * perf hint used to try the matching key first — it is NOT authoritative, so a
 * token with no `kid` (or a stale one) still verifies against whichever key
 * actually signed it. This lets a deployment run both keys at once during a
 * zero-downtime rotation. A single string keeps the legacy behavior unchanged.
 *
 * Phase 1 audit B-2: when `expectedCustomerId` is supplied, the JWT's
 * `customerId` claim must match exactly — otherwise the token is rejected
 * even when the signature + iss + aud + exp are all valid. This binds a
 * license to its purchaser. Forge mode uses this against the env-configured
 * `REVEALUI_LICENSED_CUSTOMER_ID`. Hosted mode (where the deployment IS the
 * customer) leaves it undefined.
 *
 * Note: `nbf` and `exp` are enforced automatically by jose.jwtVerify against
 * `currentDate` (defaults to now). `iss` and `aud` are enforced via the
 * options below. Signature is enforced via the public key.
 */
export async function validateLicenseKey(
  licenseKey: string,
  publicKey: string | readonly string[],
  expectedCustomerId?: string,
): Promise<LicensePayload | null> {
  // Accept tokens expired within the subscription grace window so the payload
  // is available for grace-period calculations in isLicensed().
  return verifyAndParseLicenseJwt(
    licenseKey,
    publicKey,
    graceConfig.subscriptionDays * 86_400,
    expectedCustomerId,
  );
}

/**
 * How far past `exp` a license JWT is still accepted by the refresh endpoint
 * (GAP-287 PR-1). Ratified by the owner 2026-07-18 at 30 days.
 *
 * Deliberately wider than the subscription validation grace
 * (`LICENSE_GRACE_SUBSCRIPTION_DAYS`, default 3): the validation grace answers
 * "may you still run", the refresh-accept window answers "may you still fetch
 * your renewal". A customer returning from a month away should still be able to
 * pull their current key rather than being bricked. Beyond this window the
 * refresh path refuses and re-delivery goes through the authenticated admin
 * account page.
 */
export const REFRESH_ACCEPT_DAYS = 30;

/**
 * Refresh-path validator (GAP-287 PR-1). Verifies a presented license JWT for
 * `POST /api/license/refresh`, accepting a token whose `exp` is past by at most
 * `refreshAcceptDays` (default {@link REFRESH_ACCEPT_DAYS}).
 *
 * It reuses the SAME ordered multi-key verification (GAP-259 rotation
 * composition) and payload schema as {@link validateLicenseKey}, so a token
 * minted under the outgoing private key during a dual-key rotation window still
 * verifies. It performs NO `customerId` binding: the refresh endpoint trusts
 * the token's `customerId` claim and then independently requires an ACTIVE
 * license row for it. This function only proves possession of a recently-valid
 * signed key. It never mints and never grants entitlement on its own.
 */
export async function validateLicenseKeyForRefresh(
  licenseKey: string,
  publicKey: string | readonly string[],
  refreshAcceptDays: number = REFRESH_ACCEPT_DAYS,
): Promise<LicensePayload | null> {
  return verifyAndParseLicenseJwt(licenseKey, publicKey, refreshAcceptDays * 86_400);
}

/**
 * Shared verify + parse path for {@link validateLicenseKey} and
 * {@link validateLicenseKeyForRefresh}. The ONLY behavioral difference between
 * the two callers is `clockToleranceSeconds` — how far past `exp` a token is
 * still accepted — so the rotation-aware multi-key loop and the payload schema
 * live in exactly one place.
 */
async function verifyAndParseLicenseJwt(
  licenseKey: string,
  publicKey: string | readonly string[],
  clockToleranceSeconds: number,
  expectedCustomerId?: string,
): Promise<LicensePayload | null> {
  const candidates = typeof publicKey === 'string' ? [publicKey] : [...publicKey];
  if (candidates.length === 0) return null;
  try {
    const jose = await getJose();
    // The kid header is a rotation hint: try the key whose fingerprint matches
    // first, then still fall through to the rest (a token may carry no kid).
    const header = jose.decodeProtectedHeader(licenseKey);
    const ordered = await orderCandidatesByKid(candidates, header.kid);

    let verifiedPayload: unknown = null;
    let verified = false;
    for (const candidate of ordered) {
      try {
        const key = await jose.importSPKI(candidate, 'EdDSA');
        const { payload } = await jose.jwtVerify(licenseKey, key, {
          algorithms: ['EdDSA'],
          clockTolerance: clockToleranceSeconds,
          issuer: LICENSE_ISSUER,
          audience: LICENSE_AUDIENCE,
        });
        verifiedPayload = payload;
        verified = true;
        break;
      } catch {
        // This candidate did not verify (wrong key, malformed PEM, bad
        // iss/aud, or expired beyond tolerance) — try the next before giving up.
      }
    }

    if (!verified) {
      // Rejected by every configured key. Warn once (no key material leaked)
      // to aid diagnosing a rotation where the token's signer is not yet — or
      // no longer — in REVEALUI_LICENSE_PUBLIC_KEY[_NEXT].
      if (header.kid) {
        logger.warn(
          `License JWT rejected: token kid "${header.kid}" did not verify against ` +
            `any of the ${candidates.length} configured public key(s). ` +
            'The signing key may not be in REVEALUI_LICENSE_PUBLIC_KEY / _NEXT.',
        );
      }
      return null;
    }

    const result = licensePayloadSchema.safeParse(verifiedPayload);
    if (!result.success) {
      return null;
    }

    // Phase 1 audit B-2: customerId binding. If the caller supplied an
    // expectation, the JWT's customerId must match exactly. This prevents
    // a leaked JWT from one customer being used to license another's
    // deployment (Forge customer-binding) or a leaked stamping-time JWT
    // being replayed against a deployment expecting a different customer.
    if (expectedCustomerId !== undefined && result.data.customerId !== expectedCustomerId) {
      logger.warn(
        `License customerId mismatch: token has "${result.data.customerId}", ` +
          `deployment expects "${expectedCustomerId}". Token rejected.`,
      );
      return null;
    }

    return result.data;
  } catch {
    return null;
  }
}

/**
 * Order candidate PEMs so the one whose `computeKeyId` fingerprint matches the
 * token's `kid` header is tried first. A perf hint only — when `kid` is absent
 * or matches nothing, the original order is preserved and the caller still
 * tries every candidate. Never throws (a malformed candidate simply does not
 * match and is left in place).
 */
async function orderCandidatesByKid(
  candidates: string[],
  kid: string | undefined,
): Promise<string[]> {
  if (!kid || candidates.length < 2) return candidates;
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    if (!candidate) continue;
    let fingerprint: string | null = null;
    try {
      fingerprint = await computeKeyId(candidate);
    } catch {
      fingerprint = null;
    }
    if (fingerprint === kid) {
      if (i === 0) return candidates;
      return [candidate, ...candidates.slice(0, i), ...candidates.slice(i + 1)];
    }
  }
  return candidates;
}

/**
 * Outcome of a signing-keypair self-test. See {@link selfVerifyLicenseKeypair}.
 */
export type KeypairCanaryResult =
  | { status: 'ok'; kid: string | undefined }
  | { status: 'mismatch' }
  | { status: 'degraded'; reason: string };

/**
 * Self-test a signing keypair by signing a throwaway token with `privateKey`
 * and verifying it against the ordered `publicKeys` list — the SAME multi-key
 * path real tokens take. Used by the hosted boot canary (GAP-259 P0-4).
 *
 * Distinguishes three outcomes so the caller can react correctly:
 *  - `ok`       — a token the private key signed verifies against a configured
 *                 public key, and its kid resolves to a configured key.
 *  - `mismatch` — imports all succeeded but NO public key verifies the token:
 *                 the private key does not pair with any verification key. A
 *                 definitive fault the caller should fail loud on.
 *  - `degraded` — a jose/parse exception (malformed PEM), no public key to
 *                 verify against, or a kid outside the configured allowlist.
 *                 Ambiguous / possibly environmental; the caller should alert,
 *                 not crash.
 *
 * Never throws — every jose exception collapses to `degraded`. The parse of the
 * public PEMs happens up front precisely so a malformed public key is reported
 * as `degraded` rather than masquerading as a `mismatch` (validateLicenseKey
 * collapses import failures and signature failures alike to null). Edge-compatible.
 */
export async function selfVerifyLicenseKeypair(
  privateKey: string,
  publicKeys: readonly string[],
): Promise<KeypairCanaryResult> {
  if (publicKeys.length === 0) {
    return { status: 'degraded', reason: 'no public key configured to verify against' };
  }

  const jose = await getJose();

  // Pre-parse every public PEM so a MALFORMED public key surfaces as `degraded`
  // (a jose import exception) instead of an indistinguishable `mismatch`.
  for (const pk of publicKeys) {
    try {
      await jose.importSPKI(pk, 'EdDSA');
    } catch (err) {
      return {
        status: 'degraded',
        reason: `public key import failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  // Sign a throwaway token with the deployment's own private key. A malformed
  // private PEM throws inside generateLicenseKey (importPKCS8) → degraded.
  const firstKey = publicKeys[0] as string;
  let token: string;
  try {
    token = await generateLicenseKey(
      { tier: 'pro', customerId: 'canary' },
      privateKey,
      60,
      firstKey,
    );
  } catch (err) {
    return {
      status: 'degraded',
      reason: `canary token signing failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Verify against the ordered public-key list. A null result AFTER imports
  // succeeded means no configured key verifies a token our own private key
  // signed: a definitive keypair mismatch.
  const payload = await validateLicenseKey(token, publicKeys);
  if (payload === null) {
    return { status: 'mismatch' };
  }

  // kid allowlist: the token's kid must resolve to a configured public key.
  const header = jose.decodeProtectedHeader(token);
  const kid = typeof header.kid === 'string' ? header.kid : undefined;
  if (kid !== undefined) {
    const allowed = await Promise.all(publicKeys.map((pk) => computeKeyId(pk)));
    if (!allowed.includes(kid)) {
      return {
        status: 'degraded',
        reason: `signed token kid "${kid}" is not among the configured public-key ids [${allowed.join(', ')}]`,
      };
    }
  }

  return { status: 'ok', kid };
}

/**
 * Initialize the license system. Call once at application startup.
 * Reads REVEALUI_LICENSE_KEY and REVEALUI_LICENSE_PUBLIC_KEY from environment.
 *
 * @returns The resolved license tier
 */
export async function initializeLicense(): Promise<LicenseTier> {
  const licenseKey = await getLicenseKey();
  const publicKeys = getPublicKeys();

  if (!(licenseKey && publicKeys.length > 0)) {
    cachedState = {
      tier: 'free',
      payload: null,
      validatedAt: Date.now(),
      keyPresentButInvalid: false,
    };
    cachedAt = Date.now();
    return 'free';
  }

  const payload = await validateLicenseKey(licenseKey, publicKeys);

  if (!payload) {
    // Key was present but failed validation (expired beyond grace, invalid signature, etc.)
    cachedState = {
      tier: 'free',
      payload: null,
      validatedAt: Date.now(),
      keyPresentButInvalid: true,
    };
    cachedAt = Date.now();
    return 'free';
  }

  cachedState = {
    tier: payload.tier,
    payload,
    validatedAt: Date.now(),
    keyPresentButInvalid: false,
  };
  cachedAt = Date.now();

  // Clamp cache TTL to license expiry so revoked licenses don't survive the full TTL
  if (payload.exp) {
    const msUntilExpiry = payload.exp * 1000 - Date.now();
    if (msUntilExpiry > 0 && msUntilExpiry < cacheConfig.ttlMs) {
      cacheConfig = { ...cacheConfig, ttlMs: msUntilExpiry };
    }
  }

  return payload.tier;
}

/**
 * Invalidates the cached license state if it has exceeded the configured TTL.
 * After invalidation, the license defaults to 'free' until re-initialized.
 */
function evictStaleCache(): void {
  if (cachedAt > 0 && Date.now() - cachedAt > cacheConfig.ttlMs) {
    cachedState = { tier: 'free', payload: null, validatedAt: null, keyPresentButInvalid: false };
    cachedAt = 0;
  }
}

/**
 * Returns the current license tier.
 * If the license hasn't been initialized or the cache has expired, returns 'free'.
 */
export function getCurrentTier(): LicenseTier {
  evictStaleCache();
  return cachedState.tier;
}

/**
 * Returns the full license payload, or null if no valid license or cache expired.
 */
export function getLicensePayload(): LicensePayload | null {
  evictStaleCache();
  return cachedState.payload;
}

/**
 * Returns true when `host` is covered by the license's `domains` claim.
 *
 * The single matching primitive for RevForge/Fleet domain-lock — consumed by
 * the API's `requireDomain` middleware, the admin boot check, and
 * `validateLicenseAtStartup`. Because the allowed domains come from the signed
 * JWT `domains` claim (not a separate env var), the lock is cryptographically
 * bound: it cannot be spoofed by editing an env file.
 *
 * Matching rules (no authored regex, per the fleet no-regex rule):
 * - `host` is lower-cased and stripped of any `:port` suffix
 * - `localhost` / `127.0.0.1` are always allowed, so a trial kit boots and
 *   serves on its default `http://localhost` regardless of the licensed domain
 * - otherwise `host` must equal a licensed domain OR be a subdomain of one
 *   (`app.example.com` matches `example.com`)
 *
 * @param host    raw Host header value or URL hostname (a `:port` suffix is tolerated)
 * @param domains the license payload's `domains` claim
 */
export function hostMatchesLicensedDomains(host: string, domains: readonly string[]): boolean {
  const normalized = (host.trim().toLowerCase().split(':')[0] ?? '').trim();
  if (!normalized) return false;
  if (normalized === 'localhost' || normalized === '127.0.0.1') return true;
  return domains.some((domain) => {
    const d = domain.trim().toLowerCase();
    return d.length > 0 && (normalized === d || normalized.endsWith(`.${d}`));
  });
}

/**
 * Checks whether the current license is at least the given tier.
 * Also validates that the license has not expired (checks JWT exp claim).
 *
 * Subscription grace: if the JWT has expired but is within the configured
 * grace period (default 3 days), access is still allowed. Use
 * `getLicenseStatus()` to check whether the license is in grace.
 */
export function isLicensed(requiredTier: LicenseTier): boolean {
  evictStaleCache();
  const tierRank: Record<LicenseTier, number> = {
    free: 0,
    pro: 1,
    max: 2,
    enterprise: 3,
  };

  // Free tier is always available
  if (requiredTier === 'free') return true;

  // Perpetual licenses never expire  -  skip the exp check entirely
  if (!cachedState.payload?.perpetual && cachedState.payload?.exp) {
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (cachedState.payload.exp < nowSeconds) {
      // Expired — check subscription grace period
      const graceEndSeconds = cachedState.payload.exp + graceConfig.subscriptionDays * 86_400;
      if (nowSeconds < graceEndSeconds) {
        // Within grace — still allowed, but callers should check getLicenseStatus()
        return tierRank[cachedState.tier] >= tierRank[requiredTier];
      }
      return false;
    }
  }

  return tierRank[cachedState.tier] >= tierRank[requiredTier];
}

/**
 * Returns the full license status including mode, grace state, and read-only flag.
 *
 * Use this for UI decisions (banners, warnings) and API response headers.
 * For simple gate checks, `isLicensed()` is sufficient.
 */
export function getLicenseStatus(requiredTier: LicenseTier = 'pro'): LicenseCheckResult {
  evictStaleCache();

  const tierRank: Record<LicenseTier, number> = {
    free: 0,
    pro: 1,
    max: 2,
    enterprise: 3,
  };

  // No license configured — or key was present but failed validation
  if (!cachedState.payload) {
    if (cachedState.keyPresentButInvalid) {
      return {
        allowed: requiredTier === 'free',
        tier: 'free',
        mode: 'expired',
        reason: 'License key failed validation (expired beyond grace or invalid)',
        readOnly: false,
      };
    }
    return {
      allowed: requiredTier === 'free',
      tier: 'free',
      mode: 'missing',
      reason: 'No license configured',
      readOnly: false,
    };
  }

  const nowSeconds = Math.floor(Date.now() / 1000);

  // Check subscription expiry + grace
  if (!cachedState.payload.perpetual && cachedState.payload.exp) {
    if (cachedState.payload.exp < nowSeconds) {
      const graceEndSeconds = cachedState.payload.exp + graceConfig.subscriptionDays * 86_400;

      if (nowSeconds < graceEndSeconds) {
        const graceRemainingMs = (graceEndSeconds - nowSeconds) * 1000;
        return {
          allowed: tierRank[cachedState.tier] >= tierRank[requiredTier],
          tier: cachedState.tier,
          mode: 'grace',
          reason: `Subscription expired, ${Math.ceil(graceRemainingMs / 86_400_000)}-day grace remaining`,
          graceRemainingMs,
          readOnly: false,
        };
      }

      return {
        allowed: requiredTier === 'free',
        tier: 'free',
        mode: 'expired',
        reason: 'Subscription expired and grace period exhausted',
        readOnly: false,
      };
    }
  }

  // Active license
  return {
    allowed: tierRank[cachedState.tier] >= tierRank[requiredTier],
    tier: cachedState.tier,
    mode: 'active',
    readOnly: false,
  };
}

/**
 * Returns the configured grace period durations.
 * Useful for API response headers and customer-facing documentation.
 */
export function getGraceConfig(): Readonly<GracePeriodConfig> {
  return graceConfig;
}

/**
 * Returns the maximum number of sites allowed by the current license.
 */
export function getMaxSites(): number {
  evictStaleCache();
  if (cachedState.tier === 'enterprise') return Infinity;
  if (cachedState.tier === 'max') return cachedState.payload?.maxSites ?? 15;
  if (cachedState.tier === 'pro') return cachedState.payload?.maxSites ?? 5;
  return 1;
}

/**
 * Returns the maximum number of users/editors allowed by the current license.
 */
export function getMaxUsers(): number {
  evictStaleCache();
  if (cachedState.tier === 'enterprise') return Infinity;
  if (cachedState.tier === 'max') return cachedState.payload?.maxUsers ?? 100;
  if (cachedState.tier === 'pro') return cachedState.payload?.maxUsers ?? 25;
  return 3;
}

/**
 * Returns the maximum agent tasks per billing cycle for the current license.
 * Track B metering: free=1K, pro=10K, max=50K, enterprise=unlimited.
 */
export function getMaxAgentTasks(): number {
  evictStaleCache();
  if (cachedState.tier === 'enterprise') return Infinity;
  if (cachedState.tier === 'max') return 50_000;
  if (cachedState.tier === 'pro') return 10_000;
  return 1_000;
}

/**
 * Generates a signed license key JWT.
 * Server-only in practice (requires the private key) but edge-compatible —
 * `jose.importPKCS8` and `SignJWT` both run on Web Crypto.
 *
 * @param payload - License payload (tier, customerId, limits, perpetual flag)
 * @param privateKey - Ed25519 private key (PEM format)
 * @param expiresInSeconds - JWT expiration in seconds. Pass null for perpetual
 *   licenses (no exp claim). Defaults to 1 year for subscription licenses.
 * @param publicKey - Ed25519 public key (PEM format). When provided, a `kid`
 *   claim is added to the JWT header for forward-compatible key rotation.
 * @returns Signed JWT string
 */
export async function generateLicenseKey(
  payload: Omit<LicensePayload, 'iat' | 'exp' | 'jti'> & { jti?: string },
  privateKey: string,
  expiresInSeconds: number | null = 365 * 24 * 60 * 60,
  publicKey?: string,
): Promise<string> {
  const jose = await getJose();
  const key = await jose.importPKCS8(privateKey, 'EdDSA');
  const kid = publicKey ? await computeKeyId(publicKey) : undefined;
  const header: { alg: string; kid?: string } = { alg: 'EdDSA' };
  if (kid) {
    header.kid = kid;
  }
  // Phase 1 audit B-2: every issued token carries a `jti` so it can be
  // individually revoked without rotating the vendor key. Auto-generate
  // when caller doesn't supply one (the common case).
  const jti = payload.jti ?? crypto.randomUUID();
  // Strip the optional jti from the spread so jose.setJti() is the single
  // source of the claim (avoids a duplicate field in the payload).
  const { jti: _ignoredJti, ...rest } = payload;
  const builder = new jose.SignJWT({ ...rest })
    .setProtectedHeader(header)
    .setIssuedAt()
    // Phase 1 audit B-2: enforce nbf so tokens cannot be replayed pre-issue
    // by a clock-skewed client.
    .setNotBefore('0s')
    .setJti(jti)
    .setIssuer(LICENSE_ISSUER)
    .setAudience(LICENSE_AUDIENCE);
  if (expiresInSeconds !== null) {
    builder.setExpirationTime(`${expiresInSeconds}s`);
  }
  return builder.sign(key);
}

/**
 * Reset license state. Primarily for testing.
 */
export function resetLicenseState(): void {
  cachedState = { tier: 'free', payload: null, validatedAt: null, keyPresentButInvalid: false };
  cachedAt = 0;
}
