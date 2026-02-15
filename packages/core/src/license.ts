/**
 * License validation for RevealUI Pro/Enterprise tiers.
 *
 * @dependencies
 * - jsonwebtoken - JWT token verification
 * - zod - Schema validation for license payloads
 */

import jwt from 'jsonwebtoken'
import { z } from 'zod'

/** Available license tiers */
export type LicenseTier = 'free' | 'pro' | 'enterprise'

/** Decoded license payload schema */
const licensePayloadSchema = z.object({
  /** License tier */
  tier: z.enum(['pro', 'enterprise']),
  /** Organization or customer ID */
  customerId: z.string(),
  /** Licensed domain(s) */
  domains: z.array(z.string()).optional(),
  /** Maximum number of sites allowed */
  maxSites: z.number().int().positive().optional(),
  /** Maximum number of users/editors allowed */
  maxUsers: z.number().int().positive().optional(),
  /** License issued-at timestamp */
  iat: z.number().optional(),
  /** License expiration timestamp */
  exp: z.number().optional(),
})

export type LicensePayload = z.infer<typeof licensePayloadSchema>

/** Cached license state */
interface LicenseState {
  tier: LicenseTier
  payload: LicensePayload | null
  validatedAt: number | null
}

let cachedState: LicenseState = {
  tier: 'free',
  payload: null,
  validatedAt: null,
}

/**
 * The public key used to verify license JWTs.
 * In production, this is fetched from the license server.
 * For local development, it reads from REVEALUI_LICENSE_PUBLIC_KEY env var.
 */
function getPublicKey(): string | null {
  return process.env.REVEALUI_LICENSE_PUBLIC_KEY ?? null
}

/**
 * Reads the license key from environment.
 */
function getLicenseKey(): string | null {
  return process.env.REVEALUI_LICENSE_KEY ?? null
}

/**
 * Validates a license key JWT and returns the decoded payload.
 * Returns null if the key is invalid, expired, or missing.
 */
export function validateLicenseKey(licenseKey: string, publicKey: string): LicensePayload | null {
  try {
    const decoded = jwt.verify(licenseKey, publicKey, {
      algorithms: ['RS256', 'ES256'],
    })

    const result = licensePayloadSchema.safeParse(decoded)
    if (!result.success) {
      return null
    }

    return result.data
  } catch {
    return null
  }
}

/**
 * Initialize the license system. Call once at application startup.
 * Reads REVEALUI_LICENSE_KEY and REVEALUI_LICENSE_PUBLIC_KEY from environment.
 *
 * @returns The resolved license tier
 */
export function initializeLicense(): LicenseTier {
  const licenseKey = getLicenseKey()
  const publicKey = getPublicKey()

  if (!(licenseKey && publicKey)) {
    cachedState = { tier: 'free', payload: null, validatedAt: Date.now() }
    return 'free'
  }

  const payload = validateLicenseKey(licenseKey, publicKey)

  if (!payload) {
    cachedState = { tier: 'free', payload: null, validatedAt: Date.now() }
    return 'free'
  }

  cachedState = {
    tier: payload.tier,
    payload,
    validatedAt: Date.now(),
  }

  return payload.tier
}

/**
 * Returns the current license tier.
 * If the license hasn't been initialized, returns 'free'.
 */
export function getCurrentTier(): LicenseTier {
  return cachedState.tier
}

/**
 * Returns the full license payload, or null if no valid license.
 */
export function getLicensePayload(): LicensePayload | null {
  return cachedState.payload
}

/**
 * Checks whether the current license is at least the given tier.
 */
export function isLicensed(requiredTier: LicenseTier): boolean {
  const tierRank: Record<LicenseTier, number> = {
    free: 0,
    pro: 1,
    enterprise: 2,
  }

  return tierRank[cachedState.tier] >= tierRank[requiredTier]
}

/**
 * Returns the maximum number of sites allowed by the current license.
 */
export function getMaxSites(): number {
  if (cachedState.tier === 'enterprise') return Infinity
  if (cachedState.tier === 'pro') return cachedState.payload?.maxSites ?? 5
  return 1
}

/**
 * Returns the maximum number of users/editors allowed by the current license.
 */
export function getMaxUsers(): number {
  if (cachedState.tier === 'enterprise') return Infinity
  if (cachedState.tier === 'pro') return cachedState.payload?.maxUsers ?? 25
  return 3
}

/**
 * Reset license state. Primarily for testing.
 */
export function resetLicenseState(): void {
  cachedState = { tier: 'free', payload: null, validatedAt: null }
}
