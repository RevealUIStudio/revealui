/**
 * Session Management (Server-side)
 *
 * Database-backed session management inspired by Better Auth.
 * Sessions are stored in PostgreSQL and validated on each request.
 */

import { logger } from '@revealui/core/observability/logger'
import { getClient } from '@revealui/db/client'
import { sessions, users } from '@revealui/db/schema'
import { and, eq, gt } from 'drizzle-orm'
import type { Session, User } from '../types.js'
import { hashToken } from '../utils/token.js'
import { DatabaseError, TokenError } from './errors.js'

export interface SessionData {
  session: Session
  user: User
}

/**
 * Get session from request headers (cookie)
 *
 * @param headers - Request headers containing cookies
 * @returns Session data with user, or null if invalid/expired
 */
export async function getSession(headers: Headers): Promise<SessionData | null> {
  try {
    const cookieHeader = headers.get('cookie')
    if (!cookieHeader) {
      return null
    }

    // Extract session token from cookie
    const sessionToken = extractSessionToken(cookieHeader)
    if (!sessionToken) {
      return null
    }

    // Hash token for database lookup
    let tokenHash: string
    try {
      tokenHash = hashToken(sessionToken)
    } catch {
      logger.error('Error hashing session token')
      throw new TokenError('Failed to process session token')
    }

    // Query database for session
    let db: ReturnType<typeof getClient>
    try {
      db = getClient()
    } catch (error: unknown) {
      logger.error('Error getting database client')
      throw new DatabaseError('Database connection failed', error)
    }

    let session: Session | undefined
    try {
      const result = await db
        .select()
        .from(sessions)
        .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date())))
        .limit(1)
      session = result[0] as Session | undefined
    } catch (error: unknown) {
      logger.error('Error querying session')
      throw new DatabaseError('Failed to query session', error)
    }

    if (!session) {
      return null
    }

    // Get user data
    let user: User | undefined
    try {
      const result = await db.select().from(users).where(eq(users.id, session.userId)).limit(1)
      user = result[0] as User | undefined
    } catch (error: unknown) {
      logger.error('Error querying user')
      throw new DatabaseError('Failed to query user', error)
    }

    if (!user) {
      return null
    }

    // Update last activity (non-blocking)
    try {
      await db
        .update(sessions)
        .set({ lastActivityAt: new Date() })
        .where(eq(sessions.id, session.id))
    } catch {
      // Log but don't fail - last activity update is not critical
      logger.warn('Error updating last activity')
    }

    return {
      session,
      user,
    }
  } catch (err: unknown) {
    // Re-throw known errors
    if (err instanceof DatabaseError || err instanceof TokenError) {
      throw err
    }
    // Wrap unknown errors
    logger.error('Unexpected error in getSession')
    throw new DatabaseError('Unexpected error getting session', err)
  }
}

/**
 * Create a new session for a user
 *
 * @param userId - User ID
 * @param options - Session options (persistent, userAgent, ipAddress)
 * @returns Session token and session data
 */
export async function createSession(
  userId: string,
  options?: {
    persistent?: boolean
    userAgent?: string
    ipAddress?: string
  },
): Promise<{ token: string; session: Session }> {
  try {
    let db: ReturnType<typeof getClient>
    try {
      db = getClient()
    } catch (error: unknown) {
      logger.error('Error getting database client')
      throw new DatabaseError('Database connection failed', error)
    }

    // Generate secure session token
    let token: string
    let tokenHash: string
    try {
      token = generateSessionToken()
      tokenHash = hashToken(token)
    } catch {
      logger.error('Error generating session token')
      throw new TokenError('Failed to generate session token')
    }

    // Calculate expiration (7 days for persistent, 1 day for regular)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + (options?.persistent ? 7 : 1))

    // Create session in database
    let session: Session | undefined
    try {
      const result = await db
        .insert(sessions)
        .values({
          id: crypto.randomUUID(),
          userId,
          tokenHash,
          expiresAt,
          persistent: options?.persistent ?? false,
          userAgent: options?.userAgent,
          ipAddress: options?.ipAddress,
          lastActivityAt: new Date(),
        })
        .returning()
      session = result[0] as Session | undefined
    } catch (error: unknown) {
      logger.error('Error creating session')
      throw new DatabaseError('Failed to create session', error)
    }

    if (!session) {
      throw new DatabaseError('Session creation returned no result')
    }

    return {
      token,
      session,
    }
  } catch (err: unknown) {
    // Re-throw known errors
    if (err instanceof DatabaseError || err instanceof TokenError) {
      throw err
    }
    // Wrap unknown errors
    logger.error('Unexpected error in createSession')
    throw new DatabaseError('Unexpected error creating session', err)
  }
}

/**
 * Delete a session (sign out)
 *
 * @param headers - Request headers containing session cookie
 * @returns True if session was deleted, false if not found
 */
export async function deleteSession(headers: Headers): Promise<boolean> {
  const cookieHeader = headers.get('cookie')
  if (!cookieHeader) {
    return false
  }

  const sessionToken = extractSessionToken(cookieHeader)
  if (!sessionToken) {
    return false
  }

  const tokenHash = hashToken(sessionToken)
  const db = getClient()

  const result = await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash))

  // Check if any rows were deleted - Drizzle delete returns result with rowCount or similar
  const rowCount = 'rowCount' in result && typeof result.rowCount === 'number' ? result.rowCount : 0
  return rowCount > 0
}

/**
 * Delete all sessions for a user
 *
 * @param userId - User ID
 */
export async function deleteAllUserSessions(userId: string): Promise<void> {
  try {
    let db: ReturnType<typeof getClient>
    try {
      db = getClient()
    } catch (error: unknown) {
      logger.error('Error getting database client')
      throw new DatabaseError('Database connection failed', error)
    }

    try {
      await db.delete(sessions).where(eq(sessions.userId, userId))
    } catch (error: unknown) {
      logger.error('Error deleting user sessions')
      throw new DatabaseError('Failed to delete user sessions', error)
    }
  } catch (err: unknown) {
    // Re-throw known errors
    if (err instanceof DatabaseError) {
      throw err
    }
    // Wrap unknown errors
    logger.error('Unexpected error in deleteAllUserSessions')
    throw new DatabaseError('Unexpected error deleting user sessions', err)
  }
}

/**
 * Extract session token from cookie header
 */
function extractSessionToken(cookieHeader: string): string | null {
  const cookies = cookieHeader.split(';').map((c) => c.trim())
  const sessionCookie = cookies.find((c) => c.startsWith('revealui-session='))

  if (!sessionCookie) {
    return null
  }

  return sessionCookie.substring('revealui-session='.length)
}

/**
 * Generate a secure random session token
 */
function generateSessionToken(): string {
  // Generate 32 bytes of random data and encode as base64
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Buffer.from(bytes).toString('base64url')
}
