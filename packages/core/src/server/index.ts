'use server'

/**
 * RevealUI Core - Server Entry Point
 *
 * Server-only exports for RevealUI framework.
 * This module includes Node.js-specific utilities and should only be imported
 * in server-side code (API routes, server components, middleware with nodejs runtime).
 *
 * WARNING: Do NOT import from this module in client components or edge runtime.
 * Use '@revealui/core' or '@revealui/core/client' for client-safe exports.
 */

// Server-only logger with request context
export { logger, createLogger } from '../utils/logger-server.js'
export type { Logger, LogContext, LogLevel } from '../utils/logger-server.js'

// Request context utilities (server-only - uses async_hooks)
export * from '../utils/request-context.js'

// Server-only database/storage
export { universalPostgresAdapter } from '../database/universal-postgres.js'
export { vercelBlobStorage } from '../storage/vercel-blob.js'

// Server-only API handlers
export { createRESTHandlers, handleRESTRequest } from '../api/rest.js'

// Monitoring (server-only due to request-context dependency)
// NOTE: Monitoring exports are commented out due to Sentry build-time import issues
// Import directly from '@revealui/core/monitoring' if needed
// export * from '../monitoring/index.js'

// Existing server functionality
export { renderPage } from './renderPage.js'
