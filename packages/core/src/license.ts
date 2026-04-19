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
  /** Organization or customer ID */
  customerId: z.string(),
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
    console.warn(
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
 * The public key used to verify license JWTs.
 * In production, this is fetched from the license server.
 * For local development, it reads from REVEALUI_LICENSE_PUBLIC_KEY env var.
 */
function getPublicKey(): string | null {
  const raw = process.env.REVEALUI_LICENSE_PUBLIC_KEY ?? null;
  // Docker/env files store PEM as single-line with literal \n  -  restore real newlines
  return raw ? raw.replace(/\\n/g, '\n') : null;
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
 */
export async function validateLicenseKey(
  licenseKey: string,
  publicKey: string,
): Promise<LicensePayload | null> {
  try {
    const jose = await getJose();
    // Extract kid from JWT header for forward-compatible key rotation
    const header = jose.decodeProtectedHeader(licenseKey);
    const expectedKid = await computeKeyId(publicKey);
    if (header.kid && header.kid !== expectedKid) {
      logger.warn(
        `JWT kid mismatch: token has "${header.kid}", current key is "${expectedKid}". ` +
          'Token may have been signed with a rotated key.',
      );
    }

    const key = await jose.importSPKI(publicKey, 'RS256');
    // Accept tokens expired within the subscription grace window so the
    // payload is available for grace-period calculations in isLicensed().
    const { payload } = await jose.jwtVerify(licenseKey, key, {
      algorithms: ['RS256'],
      clockTolerance: graceConfig.subscriptionDays * 86_400,
      issuer: LICENSE_ISSUER,
      audience: LICENSE_AUDIENCE,
    });

    const result = licensePayloadSchema.safeParse(payload);
    if (!result.success) {
      return null;
    }

    return result.data;
  } catch {
    return null;
  }
}

/**
 * Initialize the license system. Call once at application startup.
 * Reads REVEALUI_LICENSE_KEY and REVEALUI_LICENSE_PUBLIC_KEY from environment.
 *
 * @returns The resolved license tier
 */
export async function initializeLicense(): Promise<LicenseTier> {
  const licenseKey = await getLicenseKey();
  const publicKey = getPublicKey();

  if (!(licenseKey && publicKey)) {
    cachedState = {
      tier: 'free',
      payload: null,
      validatedAt: Date.now(),
      keyPresentButInvalid: false,
    };
    cachedAt = Date.now();
    return 'free';
  }

  const payload = await validateLicenseKey(licenseKey, publicKey);

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
 * @param privateKey - RS256 private key (PEM format)
 * @param expiresInSeconds - JWT expiration in seconds. Pass null for perpetual
 *   licenses (no exp claim). Defaults to 1 year for subscription licenses.
 * @param publicKey - RS256 public key (PEM format). When provided, a `kid`
 *   claim is added to the JWT header for forward-compatible key rotation.
 * @returns Signed JWT string
 */
export async function generateLicenseKey(
  payload: Omit<LicensePayload, 'iat' | 'exp'>,
  privateKey: string,
  expiresInSeconds: number | null = 365 * 24 * 60 * 60,
  publicKey?: string,
): Promise<string> {
  const jose = await getJose();
  const key = await jose.importPKCS8(privateKey, 'RS256');
  const kid = publicKey ? await computeKeyId(publicKey) : undefined;
  const header: { alg: string; kid?: string } = { alg: 'RS256' };
  if (kid) {
    header.kid = kid;
  }
  const builder = new jose.SignJWT({ ...payload })
    .setProtectedHeader(header)
    .setIssuedAt()
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
