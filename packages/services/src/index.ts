/**
 * services - Shared Services Package
 *
 * Provides server-side and client-side service integrations:
 * - Stripe payment processing
 * - Supabase database and auth
 * - API routes
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

// Re-export client (client-side) exports
export * from './client'
// Re-export core (server-side) exports
export * from './core'
