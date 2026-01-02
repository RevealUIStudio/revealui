/**
 * RevealUI Request Types
 * 
 * Defines request context and related types.
 * 
 * @module @revealui/cms/types/request
 */

import type { RevealUser } from './user';
import type { RevealPayload } from './runtime';

// =============================================================================
// REQUEST
// =============================================================================

/** RevealUI's request abstraction */
export interface RevealRequest {
  user?: RevealUser;
  locale?: string;
  fallbackLocale?: string;
  context?: Record<string, unknown>;
  payload?: RevealPayload;
  transactionID?: string | number | null;
  headers?: Headers | Map<string, string>;
  url?: string;
  method?: string;
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
  data?: Record<string, unknown>;
  /** Optimized document loader */
  payloadDataLoader?: {
    find: RevealPayload['find'];
  } & unknown;
  // Request body parsing methods
  json?: () => Promise<unknown>;
  text?: () => Promise<string>;
  formData?: () => Promise<FormData>;
  arrayBuffer?: () => Promise<ArrayBuffer>;
  blob?: () => Promise<Blob>;
}

/** Payload request type alias */
export type PayloadRequest = RevealRequest;

/** Request context type */
export interface RequestContext {
  [key: string]: unknown;
}
