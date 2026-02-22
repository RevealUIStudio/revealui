/**
 * Authentication Middleware for Hono API
 *
 * Reads the session cookie via @revealui/auth and populates
 * user/session context on the request.
 */

import { getSession } from '@revealui/auth/server'
import type { MiddlewareHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'

export interface AuthOptions {
  /** If true, unauthenticated requests get 401. If false, session is set but not required. */
  required?: boolean
}

/**
 * Auth middleware that reads the session cookie and populates c.set('user') and c.set('session').
 */
export const authMiddleware = (options: AuthOptions = {}): MiddlewareHandler => {
  const { required = true } = options
  return async (c, next) => {
    const sessionData = await getSession(c.req.raw.headers)
    if (sessionData) {
      c.set('user', sessionData.user)
      c.set('session', sessionData.session)
    } else if (required) {
      throw new HTTPException(401, { message: 'Authentication required' })
    }
    await next()
  }
}

/**
 * Require specific roles. Must be used after authMiddleware({ required: true }).
 */
export const requireRole = (...roles: string[]): MiddlewareHandler => {
  return async (c, next) => {
    const user = c.get('user')
    if (!user) {
      throw new HTTPException(401, { message: 'Authentication required' })
    }
    if (!roles.includes(user.role)) {
      throw new HTTPException(403, { message: 'Insufficient permissions' })
    }
    await next()
  }
}
