/**
 * services - Shared Services Package
 *
 * Provides service integrations:
 * - Stripe payment processing
 * - RevealCoin / Solana
 *
 * ## Usage
 *
 * ```typescript
 * import { protectedStripe } from '@revealui/services'
 * import { protectedStripe } from '@revealui/services/server'
 * ```
 */

import { isFeatureEnabled } from '@revealui/core/features';
import { logger } from '@revealui/core/observability/logger';

/**
 * Check if payment services are licensed for use.
 * Returns false with a warning log if no Pro/Enterprise license is active.
 */
export function checkServicesLicense(): boolean {
  if (!isFeatureEnabled('payments')) {
    logger.warn(
      '[@revealui/services] Payment and service integrations require a Pro or Enterprise license. ' +
        'Visit https://revealui.com/pricing for details.',
    );
    return false;
  }
  return true;
}

// Re-export client (client-side) exports
export * from './revealcoin/index.js';
export * from './stripe/index.js';
