/**
 * Authentication Middleware for Hono API
 *
 * Supports two auth mechanisms:
 * 1. Session cookie (browsers, admin dashboard) — via @revealui/auth
 * 2. Bearer token (Studio desktop, CLI, terminal) — via device token in userDevices
 *
 * Bearer tokens are checked first (fast path for API clients).
 * Session cookies are checked second (browser requests).
 */

import { createHash } from 'node:crypto';
import { getSession } from '@revealui/auth/server';
import { getClient } from '@revealui/db';
import { userDevices, users } from '@revealui/db/schema';
import { and, eq } from 'drizzle-orm';
import type { MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';

export interface AuthOptions {
  /** If true, unauthenticated requests get 401. If false, session is set but not required. */
  required?: boolean;
}

/** Hash a bearer token for comparison against stored tokenHash. */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Resolve user from a Bearer token. Returns null if token is invalid or expired.
 * Updates lastSeen on the device row (fire-and-forget).
 */
async function resolveDeviceToken(
  token: string,
): Promise<{ id: string; email: string | null; name: string | null; role: string } | null> {
  const db = getClient();
  const hash = hashToken(token);
  const now = new Date();

  const [device] = await db
    .select({
      userId: userDevices.userId,
      deviceId: userDevices.deviceId,
      tokenExpiresAt: userDevices.tokenExpiresAt,
      isActive: userDevices.isActive,
    })
    .from(userDevices)
    .where(and(eq(userDevices.tokenHash, hash), eq(userDevices.isActive, true)))
    .limit(1);

  if (!device) return null;
  if (device.tokenExpiresAt && device.tokenExpiresAt < now) return null;

  const [user] = await db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role })
    .from(users)
    .where(eq(users.id, device.userId))
    .limit(1);

  if (!user) return null;

  // Update lastSeen (fire-and-forget — don't block the request)
  db.update(userDevices)
    .set({ lastSeen: now })
    .where(eq(userDevices.deviceId, device.deviceId))
    .catch(() => {
      /* best-effort lastSeen update */
    });

  return user;
}

/**
 * Auth middleware that reads the session cookie or Bearer token
 * and populates c.set('user') and c.set('session').
 */
export const authMiddleware = (options: AuthOptions = {}): MiddlewareHandler => {
  const { required = true } = options;
  return async (c, next) => {
    // 1. Check Bearer token first (Studio, CLI, terminal)
    const authHeader = c.req.header('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      if (token.startsWith('rvui_dev_')) {
        const user = await resolveDeviceToken(token);
        if (user) {
          c.set('user', user);
          // No session object for device auth — set a synthetic marker
          c.set('session', { id: 'device-token', deviceAuth: true });
          await next();
          return;
        }
        // Token present but invalid — don't fall through to cookie auth
        if (required) {
          throw new HTTPException(401, { message: 'Invalid or expired device token' });
        }
      }
    }

    // 2. Fall back to session cookie (browsers, admin dashboard)
    const sessionData = await getSession(c.req.raw.headers);
    if (sessionData) {
      c.set('user', sessionData.user);
      c.set('session', sessionData.session);
    } else if (required) {
      throw new HTTPException(401, { message: 'Authentication required' });
    }
    await next();
  };
};

/**
 * Require specific roles. Must be used after authMiddleware({ required: true }).
 */
export const requireRole = (...roles: string[]): MiddlewareHandler => {
  return async (c, next) => {
    const user = c.get('user');
    if (!user) {
      throw new HTTPException(401, { message: 'Authentication required' });
    }
    if (!roles.includes(user.role)) {
      throw new HTTPException(403, { message: 'Insufficient permissions' });
    }
    await next();
  };
};
