/**
 * RevealUI Request Types
 *
 * Defines request context and related types.
 *
 * @module @revealui/core/types/request
 */

import type { RevealUIInstance } from './runtime.js'
import type { RevealUser } from './user.js'

// =============================================================================
// REQUEST
// =============================================================================

/** RevealUI's request abstraction */
export interface RevealRequest {
  user?: RevealUser
  locale?: string
  fallbackLocale?: string
  context?: Record<string, unknown>
  /** The RevealUI instance */
  revealui?: RevealUIInstance
  transactionID?: string | number | null
  headers?: Headers | Map<string, string>
  url?: string
  method?: string
  body?: unknown
  query?: Record<string, string | string[] | undefined>
  data?: Record<string, unknown>
  /** Optimized document loader */
  dataLoader?: {
    find: RevealUIInstance['find']
  } & unknown
  // Request body parsing methods
  json?: () => Promise<unknown>
  text?: () => Promise<string>
  formData?: () => Promise<FormData>
  arrayBuffer?: () => Promise<ArrayBuffer>
  blob?: () => Promise<Blob>
}

/** Request context type */
export interface RequestContext {
  [key: string]: unknown
}
