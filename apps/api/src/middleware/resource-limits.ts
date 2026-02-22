/**
 * Resource Limit Middleware for Hono API
 *
 * Enforces tier-based limits on sites and users.
 * Uses getMaxSites() / getMaxUsers() from @revealui/core/license
 * to determine limits based on the current license tier.
 */

import { getMaxSites, getMaxUsers } from '@revealui/core/license'
import { count, eq } from 'drizzle-orm'
import type { MiddlewareHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'

/**
 * Enforce site creation limit based on the current license.
 * Must be placed AFTER dbMiddleware and authMiddleware({ required: true }).
 *
 * @param getSitesTable - Returns the sites table reference (avoids top-level import of DB schema)
 */
export const enforceSiteLimit = (
  getSitesTable: () => { ownerId: { name: string } },
): MiddlewareHandler => {
  return async (c, next) => {
    const db = c.get('db')
    const user = c.get('user')

    if (!(db && user)) {
      throw new HTTPException(401, { message: 'Authentication required' })
    }

    const sitesTable = getSitesTable()
    const max = getMaxSites()

    if (max === Number.POSITIVE_INFINITY) {
      await next()
      return
    }

    // biome-ignore lint/suspicious/noExplicitAny: DB typing is dynamic across middleware boundary
    const result = await (db as any)
      .select({ count: count() })
      .from(sitesTable)
      // biome-ignore lint/suspicious/noExplicitAny: DB typing is dynamic across middleware boundary
      .where(eq((sitesTable as any).ownerId, user.id))

    const currentCount = result[0]?.count ?? 0

    if (currentCount >= max) {
      throw new HTTPException(403, {
        message: `Site limit reached (${currentCount}/${max}). Upgrade your license for more sites.`,
      })
    }

    await next()
  }
}

/**
 * Enforce user creation limit based on the current license.
 * Must be placed AFTER dbMiddleware.
 *
 * @param getUsersTable - Returns the users table reference
 */
export const enforceUserLimit = (
  getUsersTable: () => { status: { name: string } },
): MiddlewareHandler => {
  return async (c, next) => {
    const db = c.get('db')

    if (!db) {
      throw new HTTPException(500, { message: 'Database not available' })
    }

    const usersTable = getUsersTable()
    const max = getMaxUsers()

    if (max === Number.POSITIVE_INFINITY) {
      await next()
      return
    }

    // biome-ignore lint/suspicious/noExplicitAny: DB typing is dynamic across middleware boundary
    const result = await (db as any)
      .select({ count: count() })
      .from(usersTable)
      // biome-ignore lint/suspicious/noExplicitAny: DB typing is dynamic across middleware boundary
      .where(eq((usersTable as any).status, 'active'))

    const currentCount = result[0]?.count ?? 0

    if (currentCount >= max) {
      throw new HTTPException(403, {
        message: `User limit reached (${currentCount}/${max}). Upgrade your license for more users.`,
      })
    }

    await next()
  }
}
