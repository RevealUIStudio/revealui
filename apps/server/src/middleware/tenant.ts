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
 *
 * SECURITY: the header value is attacker-controlled. A bare format check is
 * NOT an authorization decision — mount sites must pass `validateTenant`
 * (see createTenantMembershipValidator) so a request can only act inside a
 * tenant its authenticated user actually belongs to. Downstream comparisons
 * against `c.get('tenant')` are only meaningful once that holds.
 */

import { logger } from '@revealui/core/observability/logger';
import type { getClient } from '@revealui/db';
import { accountMemberships, accounts } from '@revealui/db/schema';
import { and, eq, or } from 'drizzle-orm';
import type { MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';

// ─── Tenant Context ─────────────────────────────────────────────────────────

export interface TenantContext {
  /** Tenant ID (UUID or slug) */
  id: string;
  /** Resolved at middleware time for downstream use */
  resolvedAt: Date;
}

/**
 * Minimal request-context surface the tenant validator needs (same structural
 * shape the helpers below accept, so a Hono Context satisfies it).
 */
export interface TenantRequestContext {
  get: (key: string) => unknown;
}

type DbClient = ReturnType<typeof getClient>;

// ─── Middleware ──────────────────────────────────────────────────────────────

/**
 * Create multi-tenant middleware that extracts tenant context from requests.
 *
 * @param options.required - If true (default), requests without a tenant ID return 400.
 *   Set to false for routes that optionally scope by tenant.
 * @param options.headerName - Header to read tenant ID from. Defaults to 'X-Tenant-ID'.
 * @param options.validateTenant - Authorization callback deciding whether THIS request
 *   may act inside the claimed tenant (e.g., membership lookup). Receives the tenant id
 *   and the request context. Must return true to admit; false rejects with 403 before
 *   any tenant-scoped work runs. When omitted, only format validation is performed —
 *   downstream consumers then have NO membership guarantee.
 */
export function tenantMiddleware(
  options: {
    required?: boolean;
    headerName?: string;
    validateTenant?: (tenantId: string, c: TenantRequestContext) => Promise<boolean>;
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
      // Authorize the claimed tenant when a validation callback is provided.
      // 403 (not 404): this is an access decision about the requester, and a
      // membership-shaped 404 would double as a tenant-id existence oracle.
      if (validateTenant) {
        const allowed = await validateTenant(tenantId, c);
        if (!allowed) {
          logger.warn('Tenant access denied during validation', { tenantId });
          throw new HTTPException(403, { message: 'Tenant access denied' });
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

// ─── Membership validator ───────────────────────────────────────────────────

/**
 * Membership-based tenant validator: admits a tenant claim only when the
 * authenticated user holds an ACTIVE membership in that account. The claimed
 * id is matched against both `accounts.id` and `accounts.slug` (the header
 * accepts either form).
 *
 * Fail-closed by design:
 * - anonymous requests carrying a tenant header are rejected (no user, no
 *   membership — every in-tree tenant consumer is auth-gated);
 * - a DB error propagates and surfaces as a 500 rather than admitting.
 */
export function createTenantMembershipValidator(
  getDb: () => DbClient,
): (tenantId: string, c: TenantRequestContext) => Promise<boolean> {
  return async (tenantId, c) => {
    const user = c.get('user') as { id?: string } | undefined;
    if (!user?.id) {
      return false;
    }

    const db = getDb();
    const [membership] = await db
      .select({ accountId: accountMemberships.accountId })
      .from(accountMemberships)
      .innerJoin(accounts, eq(accounts.id, accountMemberships.accountId))
      .where(
        and(
          eq(accountMemberships.userId, user.id),
          eq(accountMemberships.status, 'active'),
          or(eq(accounts.id, tenantId), eq(accounts.slug, tenantId)),
        ),
      )
      .limit(1);

    return Boolean(membership);
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
