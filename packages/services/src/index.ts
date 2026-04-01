/**
 * services - Shared Services Package
 *
 * Provides server-side and client-side service integrations:
 * - Stripe payment processing
 * - Supabase database and auth
 *
 * ## Usage
 *
 * ### Full Package (Recommended)
 * ```typescript
 * import { protectedStripe, createServerClient, createBrowserClient } from 'services'
 * ```
 *
 * ### Core (Server-side)
 * ```typescript
 * import { createServerClient, protectedStripe } from 'services/server'
 * ```
 *
 * ### Client (Browser)
 * ```typescript
 * import { createBrowserClient } from 'services/client'
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
export * from './client/index.js';
export * from './revealcoin/index.js';
export * from './stripe/index.js';
export * from './supabase/index.js';
