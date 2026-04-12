/**
 * Authorization Middleware for Hono API
 *
 * Bridges @revealui/core's AuthorizationSystem (RBAC + ABAC) with Hono.
 * Uses PermissionCache for performance. Must run after authMiddleware.
 */

import {
  type AuthorizationContext,
  AuthorizationSystem,
  CommonRoles,
  PermissionCache,
} from '@revealui/core/security';
import type { MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';

/** Shared authorization instance  -  bootstrapped with CommonRoles at import time */
const authz = new AuthorizationSystem();
const cache = new PermissionCache(5 * 60_000); // 5-minute TTL

// Register all CommonRoles so hasPermission() resolves them
for (const role of Object.values(CommonRoles)) {
  authz.registerRole(role);
}

/**
 * Require permission on a resource/action pair.
 * Falls back to PermissionCache for repeat checks.
 *
 * Must be used after `authMiddleware({ required: true })`.
 */
export const requirePermission = (resource: string, action: string): MiddlewareHandler => {
  return async (c, next) => {
    const user = c.get('user') as { id: string; role: string } | undefined;

    if (!user) {
      throw new HTTPException(401, { message: 'Authentication required' });
    }

    // Check cache first
    const cached = cache.get(user.id, resource, action);
    if (cached === true) {
      await next();
      return;
    }
    if (cached === false) {
      throw new HTTPException(403, {
        message: `Permission denied: ${resource}:${action}`,
      });
    }

    // Evaluate via AuthorizationSystem
    const allowed = authz.hasPermission([user.role], resource, action);
    cache.set(user.id, resource, action, allowed);

    if (!allowed) {
      throw new HTTPException(403, {
        message: `Permission denied: ${resource}:${action}`,
      });
    }

    await next();
  };
};

/**
 * Full ABAC policy check with environment context.
 * Use for fine-grained rules that depend on IP, time, or resource attributes.
 */
export const requireAccess = (
  resource: string,
  action: string,
  getResourceAttrs?: (c: Parameters<MiddlewareHandler>[0]) => {
    id?: string;
    owner?: string;
    attributes?: Record<string, unknown>;
  },
): MiddlewareHandler => {
  return async (c, next) => {
    const user = c.get('user') as { id: string; role: string } | undefined;

    if (!user) {
      throw new HTTPException(401, { message: 'Authentication required' });
    }

    const context: AuthorizationContext = {
      user: {
        id: user.id,
        roles: [user.role],
      },
      resource: {
        type: resource,
        ...(getResourceAttrs?.(c) ?? {}),
      },
      environment: {
        ip:
          c.req.header('x-real-ip')?.trim() ||
          c.req.header('x-forwarded-for')?.split(',')[0]?.trim(),
        userAgent: c.req.header('user-agent'),
      },
    };

    const { allowed, reason } = authz.checkAccess(context, resource, action);

    if (!allowed) {
      throw new HTTPException(403, {
        message: reason ?? `Access denied: ${resource}:${action}`,
      });
    }

    await next();
  };
};

/**
 * Invalidate permission cache for a user (call on role changes).
 */
export function invalidateUserPermissions(userId: string): void {
  cache.clearUser(userId);
}

/** Expose the shared instance for policy registration at startup */
export { authz as authorizationSystem };
