/**
 * services - Shared Services Package
 *
 * Provides service integrations:
 * - Stripe payment processing
 * - Email delivery (Gmail API)
 *
 * ## Usage
 *
 * ```typescript
 * import { protectedStripe } from '@revealui/services'
 * import { protectedStripe } from '@revealui/services/server'
 * ```
 */

// Re-export client (client-side) exports
export * from './email/index.js';
export * from './stripe/index.js';
