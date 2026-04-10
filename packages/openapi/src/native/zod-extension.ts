/**
 * Native Zod → OpenAPI Extension
 *
 * Adds `.openapi()` method to Zod schemas for attaching OpenAPI metadata
 * (description, example, deprecated, etc.) without requiring
 * @asteasolutions/zod-to-openapi.
 *
 * Usage:
 *   extendZodWithOpenApi(z);
 *   const schema = z.string().openapi({ description: 'User name', example: 'Alice' });
 */

import type { z as zod } from 'zod';

// =============================================================================
// Types
// =============================================================================

export interface OpenAPIMetadata {
  /** OpenAPI description */
  description?: string;
  /** Example value */
  example?: unknown;
  /** Multiple examples */
  examples?: unknown[];
  /** Mark as deprecated */
  deprecated?: boolean;
  /** Reference ID for schema reuse ($ref) */
  refId?: string;
  /** OpenAPI format (e.g., 'email', 'uri', 'date-time') */
  format?: string;
  /** Default value */
  default?: unknown;
  /** Title for the schema */
  title?: string;
  /** OpenAPI parameter metadata */
  param?: {
    name?: string;
    in?: 'query' | 'header' | 'path' | 'cookie';
    required?: boolean;
    description?: string;
  };
  /** Additional OpenAPI properties */
  [key: string]: unknown;
}

// Symbol used to store metadata on Zod schema instances
const OPENAPI_METADATA = Symbol.for('revealui:openapi-metadata');

// =============================================================================
// Metadata Storage
// =============================================================================

/**
 * Get OpenAPI metadata from a Zod schema.
 * Returns undefined if no metadata has been attached.
 */
export function getOpenApiMetadata(schema: zod.ZodTypeAny): OpenAPIMetadata | undefined {
  return (schema as unknown as Record<symbol, unknown>)[OPENAPI_METADATA] as
    | OpenAPIMetadata
    | undefined;
}

/**
 * Set OpenAPI metadata on a Zod schema.
 */
export function setOpenApiMetadata(schema: zod.ZodTypeAny, metadata: OpenAPIMetadata): void {
  (schema as unknown as Record<symbol, unknown>)[OPENAPI_METADATA] = metadata;
}

// =============================================================================
// Zod Extension
// =============================================================================

/**
 * Extends Zod with `.openapi()` method for attaching OpenAPI metadata.
 *
 * Call once at application startup:
 *   import { z } from 'zod';
 *   import { extendZodWithOpenApi } from '@revealui/openapi/native';
 *   extendZodWithOpenApi(z);
 */
export function extendZodWithOpenApi(zod: typeof import('zod').z): void {
  if ('openapi' in zod.ZodType.prototype) {
    return; // Already extended
  }

  // Add .openapi() method to all Zod types
  zod.ZodType.prototype.openapi = function (metadata: OpenAPIMetadata) {
    const clone = this.describe(metadata.description ?? '');
    (clone as Record<symbol, unknown>)[OPENAPI_METADATA] = {
      ...getOpenApiMetadata(this),
      ...metadata,
    };
    return clone;
  };
}

// Type augmentation for TypeScript
declare module 'zod' {
  interface ZodType {
    openapi(metadata: OpenAPIMetadata): this;
  }
}
