/**
 * License Enforcement Middleware for Hono API
 *
 * Gates routes by license tier or feature flag.
 * Uses the cached license state from @revealui/core — no DB call per request.
 */

import { type FeatureFlags, getRequiredTier, isFeatureEnabled } from '@revealui/core/features'
import {
  getCurrentTier,
  getLicensePayload,
  isLicensed,
  type LicenseTier,
} from '@revealui/core/license'
import type { MiddlewareHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'

/** Cache for DB-side license status checks (avoid querying every request) */
let dbStatusCache: { status: string; checkedAt: number } | null = null
const DB_STATUS_CHECK_INTERVAL = 5 * 60 * 1000 // 5 minutes

/**
 * Require a minimum license tier to access the route.
 * Returns 403 with upgrade prompt if the tier is insufficient.
 */
export const requireLicense = (minimumTier: LicenseTier): MiddlewareHandler => {
  return async (_c, next) => {
    if (!isLicensed(minimumTier)) {
      throw new HTTPException(403, {
        message: `This endpoint requires a ${minimumTier} license. Current tier: ${getCurrentTier()}. Upgrade at https://revealui.com/pricing`,
      })
    }
    await next()
  }
}

/**
 * Require a specific feature to be enabled.
 * Returns 403 with feature name and required tier.
 */
export const requireFeature = (feature: keyof FeatureFlags): MiddlewareHandler => {
  return async (_c, next) => {
    if (!isFeatureEnabled(feature)) {
      const requiredTier = getRequiredTier(feature)
      throw new HTTPException(403, {
        message: `Feature '${feature}' requires a ${requiredTier} license. Current tier: ${getCurrentTier()}. Upgrade at https://revealui.com/pricing`,
      })
    }
    await next()
  }
}

/**
 * Validate the requesting domain against the license's allowed domains.
 * Skips validation if no domain restrictions exist in the license.
 * Supports subdomain matching (e.g. app.example.com matches example.com).
 */
export const requireDomain = (): MiddlewareHandler => {
  return async (c, next) => {
    const payload = getLicensePayload()

    // No domain restrictions — pass through
    if (!payload?.domains || payload.domains.length === 0) {
      await next()
      return
    }

    const origin = c.req.header('origin') || c.req.header('referer')
    if (!origin) {
      throw new HTTPException(403, {
        message: 'Origin header required for domain-restricted licenses',
      })
    }

    let requestDomain: string
    try {
      requestDomain = new URL(origin).hostname
    } catch {
      throw new HTTPException(403, {
        message: 'Invalid Origin header format',
      })
    }

    const isAllowed = payload.domains.some(
      (d) => requestDomain === d || requestDomain.endsWith(`.${d}`),
    )

    if (!isAllowed) {
      throw new HTTPException(403, {
        message: `Domain '${requestDomain}' is not licensed. Licensed domains: ${payload.domains.join(', ')}`,
      })
    }

    await next()
  }
}

/**
 * Check license status in the database with a 5-minute cache.
 * Returns 403 if the license has been revoked or expired.
 * Skips check for free tier (no license to validate).
 *
 * @param queryLicenseStatus - Function that queries the DB for the license status.
 *   Injected to avoid coupling middleware to DB schema imports.
 */
export const checkLicenseStatus = (
  queryLicenseStatus: (customerId: string) => Promise<string | null>,
): MiddlewareHandler => {
  return async (_c, next) => {
    const payload = getLicensePayload()

    // No license — free tier, no DB check needed
    if (!payload) {
      await next()
      return
    }

    const now = Date.now()
    if (!dbStatusCache || now - dbStatusCache.checkedAt > DB_STATUS_CHECK_INTERVAL) {
      const status = await queryLicenseStatus(payload.customerId)
      dbStatusCache = {
        status: status ?? 'active',
        checkedAt: now,
      }
    }

    if (dbStatusCache.status === 'revoked') {
      throw new HTTPException(403, {
        message: 'Your license has been revoked. Contact support@revealui.com',
      })
    }

    if (dbStatusCache.status === 'expired') {
      throw new HTTPException(403, {
        message: 'Your license has expired. Renew at https://revealui.com/pricing',
      })
    }

    await next()
  }
}

/**
 * Reset the DB status cache. Primarily for testing.
 */
export function resetDbStatusCache(): void {
  dbStatusCache = null
}
