/**
 * Shared Error Response Types
 *
 * Common types for error responses used across both Next.js routes and RevealHandler routes.
 */

/**
 * Standard error response format
 *
 * Used consistently across all API endpoints to ensure predictable error handling.
 */
export interface ErrorResponse {
  /** Error type/category (e.g., 'VALIDATION_ERROR', 'UNAUTHORIZED') */
  error: string;

  /** Human-readable error message */
  message: string;

  /** Optional error code for programmatic handling */
  code?: string;

  /** Optional additional details (validation errors, stack traces in dev, etc.) */
  details?: unknown;
}
