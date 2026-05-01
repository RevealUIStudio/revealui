/**
 * Multi-Tenant Middleware
 *
 * Extracts and validates tenant context from incoming requests.
 * Enterprise-only: requires a valid license with multi-tenant enabled.
 *
 * Tenant resolution order:
 * 1. X-Tenant-ID header (API clients)
 * 2. JWT/session token claim (authenticated users)
 *
 * Routes that don't require tenant context (e.g., /health, /docs)
 * should be mounted BEFORE this middleware.
 */

import { logger } from '@revealui/core/observability/logger';
import type { MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';

// ─── Tenant Context ─────────────────────────────────────────────────────────

export interface TenantContext {
  /** Tenant ID (UUID or slug) */
  id: string;
  /** Resolved at middleware time for downstream use */
  resolvedAt: Date;
}

// ─── Middleware ──────────────────────────────────────────────────────────────

/**
 * Create multi-tenant middleware that extracts tenant context from requests.
 *
 * @param options.required - If true (default), requests without a tenant ID return 400.
 *   Set to false for routes that optionally scope by tenant.
 * @param options.headerName - Header to read tenant ID from. Defaults to 'X-Tenant-ID'.
 * @param options.validateTenant - Optional callback to verify tenant exists (e.g., DB lookup).
 *   Must return true if the tenant is valid. When omitted, only format validation is performed.
 */
export function tenantMiddleware(
  options: {
    required?: boolean;
    headerName?: string;
    validateTenant?: (tenantId: string) => Promise<boolean>;
  } = {},
): MiddlewareHandler {
  const { required = true, headerName = 'X-Tenant-ID', validateTenant } = options;

  return async (c, next) => {
    // Tenant context must come from a trusted header  -  query params are attacker-controlled
    const tenantId = c.req.header(headerName) ?? null;

    // Validate format (UUID or slug: alphanumeric + hyphens, 1-128 chars)
    if (tenantId && !/^[\w-]{1,128}$/.test(tenantId)) {
      throw new HTTPException(400, { message: 'Invalid tenant ID format' });
    }

    if (!tenantId && required) {
      throw new HTTPException(400, {
        message: `Missing tenant context. Provide the ${headerName} header.`,
      });
    }

    if (tenantId) {
      // Verify tenant existence if a validation callback is provided
      if (validateTenant) {
        const exists = await validateTenant(tenantId);
        if (!exists) {
          logger.warn('Tenant ID not found during validation', { tenantId });
          throw new HTTPException(404, { message: 'Tenant not found' });
        }
      }

      const tenant: TenantContext = {
        id: tenantId,
        resolvedAt: new Date(),
      };
      c.set('tenant', tenant);
      logger.debug('Tenant context resolved', { tenantId });
    }

    await next();
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Get the tenant context from the request, or null if not set.
 * Use this in route handlers to access the resolved tenant.
 */
export function getTenantFromContext(c: { get: (key: string) => unknown }): TenantContext | null {
  return (c.get('tenant') as TenantContext) ?? null;
}

/**
 * Require tenant context or throw 403.
 * Use in route handlers that MUST have a tenant.
 */
export function requireTenant(c: { get: (key: string) => unknown }): TenantContext {
  const tenant = getTenantFromContext(c);
  if (!tenant) {
    throw new HTTPException(403, { message: 'Tenant context required for this operation' });
  }
  return tenant;
}
