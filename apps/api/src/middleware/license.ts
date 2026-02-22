/**
 * License Enforcement Middleware for Hono API
 *
 * Gates routes by license tier or feature flag.
 * Uses the cached license state from @revealui/core — no DB call per request.
 */

import { type FeatureFlags, getRequiredTier, isFeatureEnabled } from '@revealui/core/features'
import { getCurrentTier, isLicensed, type LicenseTier } from '@revealui/core/license'
import type { MiddlewareHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'

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
