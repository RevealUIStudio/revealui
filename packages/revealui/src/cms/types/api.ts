/**
 * RevealUI API Types
 * 
 * Defines REST API and response types.
 * 
 * @module @revealui/cms/types/api
 */

import type { RevealDocument, RevealWhere, RevealSort, RevealSelect } from './query';
import type { RevealRequest } from './request';
import type { RevealUIInstance } from './runtime';

// =============================================================================
// HANDLER TYPES
// =============================================================================

/**
 * RevealUI request handler function
 * Used for custom endpoints and API handlers
 */
export type RevealHandler = (args: {
  req: RevealRequest;
  res?: Response;
  next?: () => void;
  revealui?: RevealUIInstance;
}) => Promise<Response | void> | Response | void;

/**
 * Endpoint handler with full context
 */
export interface EndpointHandlerArgs {
  req: RevealRequest;
  revealui: RevealUIInstance;
  params?: Record<string, string>;
}

export type EndpointHandler = (args: EndpointHandlerArgs) => Promise<Response> | Response;

// =============================================================================
// REST OPTIONS
// =============================================================================

export interface RESTOptions {
  where?: RevealWhere;
  sort?: RevealSort;
  limit?: number;
  page?: number;
  select?: RevealSelect;
  depth?: number;
  locale?: string;
}

// =============================================================================
// API RESPONSE
// =============================================================================

export interface APIResponse<T = RevealDocument> {
  message?: string;
  doc?: T;
  docs?: T[];
  errors?: { field: string; message: string }[];
  totalDocs?: number;
  limit?: number;
  totalPages?: number;
  page?: number;
}

// =============================================================================
// REST METHOD TYPES
// =============================================================================

export type REST_DELETE = () => Promise<Response>;
export type REST_GET = () => Promise<Response>;
export type REST_OPTIONS = () => Promise<Response>;
export type REST_PATCH = () => Promise<Response>;
export type REST_POST = () => Promise<Response>;
