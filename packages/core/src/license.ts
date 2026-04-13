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

import { decodeProtectedHeader, importPKCS8, importSPKI, jwtVerify, SignJWT } from 'jose';
import { z } from 'zod';
import { decryptLicenseKey } from './license-encryption.js';
import { logger } from './utils/logger.js';

/** Available license tiers */
export type LicenseTier = 'free' | 'pro' | 'max' | 'enterprise';

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

const DEFAULT_CACHE_CONFIG: LicenseCacheConfig = {
  ttlMs: (() => {
    const envTtl = process.env.LICENSE_CACHE_TTL_MS;
    if (envTtl) {
      const parsed = Number.parseInt(envTtl, 10);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    return DEFAULT_TTL_MS;
  })(),
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
}

let cachedState: LicenseState = {
  tier: 'free',
  payload: null,
  validatedAt: null,
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
  for (let i = 0; i < 4; i++) {
    hex += (digest[i] as number).toString(16).padStart(2, '0');
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
    // Extract kid from JWT header for forward-compatible key rotation
    const header = decodeProtectedHeader(licenseKey);
    const expectedKid = await computeKeyId(publicKey);
    if (header.kid && header.kid !== expectedKid) {
      logger.warn(
        `JWT kid mismatch: token has "${header.kid}", current key is "${expectedKid}". ` +
          'Token may have been signed with a rotated key.',
      );
    }

    const key = await importSPKI(publicKey, 'RS256');
    const { payload } = await jwtVerify(licenseKey, key, {
      algorithms: ['RS256', 'ES256'],
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
    cachedState = { tier: 'free', payload: null, validatedAt: Date.now() };
    cachedAt = Date.now();
    return 'free';
  }

  const payload = await validateLicenseKey(licenseKey, publicKey);

  if (!payload) {
    cachedState = { tier: 'free', payload: null, validatedAt: Date.now() };
    cachedAt = Date.now();
    return 'free';
  }

  cachedState = {
    tier: payload.tier,
    payload,
    validatedAt: Date.now(),
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
    cachedState = { tier: 'free', payload: null, validatedAt: null };
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
      return false;
    }
  }

  return tierRank[cachedState.tier] >= tierRank[requiredTier];
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
  const key = await importPKCS8(privateKey, 'RS256');
  const kid = publicKey ? await computeKeyId(publicKey) : undefined;
  const header: { alg: string; kid?: string } = { alg: 'RS256' };
  if (kid) {
    header.kid = kid;
  }
  const builder = new SignJWT({ ...payload }).setProtectedHeader(header).setIssuedAt();
  if (expiresInSeconds !== null) {
    builder.setExpirationTime(`${expiresInSeconds}s`);
  }
  return builder.sign(key);
}

/**
 * Reset license state. Primarily for testing.
 */
export function resetLicenseState(): void {
  cachedState = { tier: 'free', payload: null, validatedAt: null };
  cachedAt = 0;
}
