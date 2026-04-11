/**
 * Session Management (Server-side)
 *
 * Database-backed session management inspired by Better Auth.
 * Sessions are stored in PostgreSQL and validated on each request.
 */

import { logger } from '@revealui/core/observability/logger';
import { getClient } from '@revealui/db/client';
import { sessions, users } from '@revealui/db/schema';
import { and, eq, gt, isNull, ne } from 'drizzle-orm';
import type { Session, User } from '../types.js';
import { hashToken } from '../utils/token.js';
import { DatabaseError, TokenError } from './errors.js';

// ---------------------------------------------------------------------------
// Session binding configuration
// ---------------------------------------------------------------------------

export interface SessionBindingConfig {
  /** Invalidate session when user-agent changes (default: true) */
  enforceUserAgent: boolean;
  /** Invalidate session when IP address changes (default: false  -  users roam) */
  enforceIp: boolean;
  /** Log a warning when IP changes but don't invalidate (default: true) */
  warnOnIpChange: boolean;
}

const DEFAULT_SESSION_BINDING: SessionBindingConfig = {
  enforceUserAgent: true,
  enforceIp: false,
  warnOnIpChange: true,
};

let sessionBindingConfig: SessionBindingConfig = { ...DEFAULT_SESSION_BINDING };

/** Override session binding behaviour (useful for tests or strict deployments). */
export function configureSessionBinding(overrides: Partial<SessionBindingConfig>): void {
  sessionBindingConfig = { ...DEFAULT_SESSION_BINDING, ...overrides };
}

/** Reset to defaults (for tests). */
export function resetSessionBindingConfig(): void {
  sessionBindingConfig = { ...DEFAULT_SESSION_BINDING };
}

// ---------------------------------------------------------------------------
// Session binding validation
// ---------------------------------------------------------------------------

export interface RequestContext {
  userAgent?: string;
  ipAddress?: string;
}

/**
 * Validate that the current request context matches the session's stored
 * binding values (IP address, user-agent).
 *
 * @returns `null` when the session is valid, or a reason string when it should
 *          be invalidated.
 */
export function validateSessionBinding(session: Session, ctx: RequestContext): string | null {
  // User-agent enforcement
  if (
    sessionBindingConfig.enforceUserAgent &&
    ctx.userAgent &&
    session.userAgent &&
    ctx.userAgent !== session.userAgent
  ) {
    return 'user-agent mismatch';
  }

  // IP enforcement / warning
  if (ctx.ipAddress && session.ipAddress && ctx.ipAddress !== session.ipAddress) {
    if (sessionBindingConfig.enforceIp) {
      return 'ip-address mismatch';
    }
    if (sessionBindingConfig.warnOnIpChange) {
      logger.warn('Session IP changed', {
        sessionId: session.id,
        storedIp: session.ipAddress,
        currentIp: ctx.ipAddress,
      });
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface SessionData {
  session: Session;
  user: User;
}

/**
 * Check if a session is a recovery session (created via magic link recovery).
 *
 * Recovery sessions are restricted  -  they should only be used for:
 * - Changing the password (`/api/auth/change-password`)
 * - Signing out (`/api/auth/sign-out`)
 * - Viewing current session (`/api/auth/me`, `/api/auth/session`)
 *
 * All other operations (MFA management, passkey management, OAuth linking,
 * admin actions) should reject recovery sessions.
 */
export function isRecoverySession(sessionData: SessionData | null): boolean {
  if (!sessionData) return false;
  const metadata = sessionData.session.metadata as Record<string, unknown> | null;
  return metadata?.recovery === true;
}

/**
 * Get session from request headers (cookie)
 *
 * @param headers - Request headers containing cookies
 * @param requestContext - Optional IP / user-agent for session binding validation
 * @returns Session data with user, or null if invalid/expired
 */
export async function getSession(
  headers: Headers,
  requestContext?: RequestContext,
): Promise<SessionData | null> {
  try {
    const cookieHeader = headers.get('cookie');
    if (!cookieHeader) {
      return null;
    }

    // Extract session token from cookie
    const sessionToken = extractSessionToken(cookieHeader);
    if (!sessionToken) {
      return null;
    }

    // Hash token for database lookup
    let tokenHash: string;
    try {
      tokenHash = hashToken(sessionToken);
    } catch {
      logger.error('Error hashing session token');
      throw new TokenError('Failed to process session token');
    }

    // Query database for session
    let db: ReturnType<typeof getClient>;
    try {
      db = getClient();
    } catch (error: unknown) {
      logger.error('Error getting database client');
      throw new DatabaseError('Database connection failed', error);
    }

    let session: Session | undefined;
    try {
      const result = await db
        .select()
        .from(sessions)
        .where(
          and(
            eq(sessions.tokenHash, tokenHash),
            gt(sessions.expiresAt, new Date()),
            isNull(sessions.deletedAt),
          ),
        )
        .limit(1);
      session = result[0] as Session | undefined;
    } catch (error: unknown) {
      logger.error('Error querying session');
      throw new DatabaseError('Failed to query session', error);
    }

    if (!session) {
      return null;
    }

    // Session binding validation (IP / user-agent)
    if (requestContext) {
      const bindingError = validateSessionBinding(session, requestContext);
      if (bindingError) {
        logger.warn('Session binding violation  -  invalidating session', {
          sessionId: session.id,
          reason: bindingError,
        });
        // Delete the compromised session
        try {
          await db.delete(sessions).where(eq(sessions.id, session.id));
        } catch {
          logger.error('Failed to delete session after binding violation');
        }
        return null;
      }
    }

    // Get user data
    let user: User | undefined;
    try {
      const result = await db
        .select()
        .from(users)
        .where(and(eq(users.id, session.userId), isNull(users.deletedAt)))
        .limit(1);
      user = result[0] as User | undefined;
    } catch (error: unknown) {
      logger.error('Error querying user');
      throw new DatabaseError('Failed to query user', error);
    }

    if (!user) {
      return null;
    }

    // Update last activity (non-blocking)
    try {
      await db
        .update(sessions)
        .set({ lastActivityAt: new Date() })
        .where(eq(sessions.id, session.id));
    } catch {
      // Log but don't fail - last activity update is not critical
      logger.warn('Error updating last activity');
    }

    return {
      session,
      user,
    };
  } catch (err: unknown) {
    // Re-throw known errors
    if (err instanceof DatabaseError || err instanceof TokenError) {
      throw err;
    }
    // Wrap unknown errors
    logger.error('Unexpected error in getSession');
    throw new DatabaseError('Unexpected error getting session', err);
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
    persistent?: boolean;
    userAgent?: string;
    ipAddress?: string;
    expiresAt?: Date;
    metadata?: Record<string, unknown>;
  },
): Promise<{ token: string; session: Session }> {
  try {
    let db: ReturnType<typeof getClient>;
    try {
      db = getClient();
    } catch (error: unknown) {
      logger.error('Error getting database client');
      throw new DatabaseError('Database connection failed', error);
    }

    // Generate secure session token
    let token: string;
    let tokenHash: string;
    try {
      token = generateSessionToken();
      tokenHash = hashToken(token);
    } catch {
      logger.error('Error generating session token');
      throw new TokenError('Failed to generate session token');
    }

    // Calculate expiration (custom override, 7 days for persistent, 1 day for regular)
    const expiresAt = options?.expiresAt ?? new Date();
    if (!options?.expiresAt) {
      expiresAt.setDate(expiresAt.getDate() + (options?.persistent ? 7 : 1));
    }

    // Create session in database
    let session: Session | undefined;
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
          metadata: options?.metadata ?? null,
        })
        .returning();
      session = result[0] as Session | undefined;
    } catch (error: unknown) {
      logger.error('Error creating session');
      throw new DatabaseError('Failed to create session', error);
    }

    if (!session) {
      throw new DatabaseError('Session creation returned no result');
    }

    return {
      token,
      session,
    };
  } catch (err: unknown) {
    // Re-throw known errors
    if (err instanceof DatabaseError || err instanceof TokenError) {
      throw err;
    }
    // Wrap unknown errors
    logger.error('Unexpected error in createSession');
    throw new DatabaseError('Unexpected error creating session', err);
  }
}

/**
 * Rotate a user's session to prevent session fixation attacks.
 *
 * Deletes the old session (by token hash) or all sessions for the user,
 * then creates a fresh session with a new token.
 *
 * @param userId - User ID to rotate sessions for
 * @param options - Rotation options
 * @returns New session token and session data
 */
export async function rotateSession(
  userId: string,
  options?: {
    /** Raw token of the old session to invalidate. When omitted, all user sessions are deleted. */
    oldSessionToken?: string;
    persistent?: boolean;
    userAgent?: string;
    ipAddress?: string;
  },
): Promise<{ token: string; session: Session }> {
  try {
    let db: ReturnType<typeof getClient>;
    try {
      db = getClient();
    } catch (error: unknown) {
      logger.error('Error getting database client in rotateSession');
      throw new DatabaseError('Database connection failed', error);
    }

    // Invalidate old session(s)
    try {
      if (options?.oldSessionToken) {
        const oldTokenHash = hashToken(options.oldSessionToken);
        await db.delete(sessions).where(eq(sessions.tokenHash, oldTokenHash));
      } else {
        await db.delete(sessions).where(eq(sessions.userId, userId));
      }
    } catch (error: unknown) {
      logger.error('Error deleting old session(s) during rotation');
      throw new DatabaseError('Failed to delete old session(s)', error);
    }

    // Create a fresh session
    return await createSession(userId, {
      persistent: options?.persistent,
      userAgent: options?.userAgent,
      ipAddress: options?.ipAddress,
    });
  } catch (err: unknown) {
    if (err instanceof DatabaseError || err instanceof TokenError) {
      throw err;
    }
    logger.error('Unexpected error in rotateSession');
    throw new DatabaseError('Unexpected error rotating session', err);
  }
}

/**
 * Delete a session (sign out)
 *
 * @param headers - Request headers containing session cookie
 * @returns True if session was deleted, false if not found
 */
export async function deleteSession(headers: Headers): Promise<boolean> {
  const cookieHeader = headers.get('cookie');
  if (!cookieHeader) {
    return false;
  }

  const sessionToken = extractSessionToken(cookieHeader);
  if (!sessionToken) {
    return false;
  }

  const tokenHash = hashToken(sessionToken);
  const db = getClient();

  const result = await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));

  // Check if any rows were deleted - Drizzle delete returns result with rowCount or similar
  const rowCount =
    'rowCount' in result && typeof result.rowCount === 'number' ? result.rowCount : 0;
  return rowCount > 0;
}

/**
 * Delete all sessions for a user
 *
 * @param userId - User ID
 */
/**
 * Delete all sessions for a user EXCEPT the specified session.
 * Used for "sign out all other devices" functionality.
 */
export async function deleteOtherUserSessions(
  userId: string,
  exceptSessionId: string,
): Promise<void> {
  try {
    let db: ReturnType<typeof getClient>;
    try {
      db = getClient();
    } catch (error: unknown) {
      logger.error('Error getting database client');
      throw new DatabaseError('Database connection failed', error);
    }

    try {
      await db
        .delete(sessions)
        .where(and(eq(sessions.userId, userId), ne(sessions.id, exceptSessionId)));
    } catch (error: unknown) {
      logger.error('Error deleting other user sessions');
      throw new DatabaseError('Failed to delete other user sessions', error);
    }
  } catch (err: unknown) {
    if (err instanceof DatabaseError) {
      throw err;
    }
    logger.error('Unexpected error in deleteOtherUserSessions');
    throw new DatabaseError('Unexpected error deleting other user sessions', err);
  }
}

export async function deleteAllUserSessions(userId: string): Promise<void> {
  try {
    let db: ReturnType<typeof getClient>;
    try {
      db = getClient();
    } catch (error: unknown) {
      logger.error('Error getting database client');
      throw new DatabaseError('Database connection failed', error);
    }

    try {
      await db.delete(sessions).where(eq(sessions.userId, userId));
    } catch (error: unknown) {
      logger.error('Error deleting user sessions');
      throw new DatabaseError('Failed to delete user sessions', error);
    }
  } catch (err: unknown) {
    // Re-throw known errors
    if (err instanceof DatabaseError) {
      throw err;
    }
    // Wrap unknown errors
    logger.error('Unexpected error in deleteAllUserSessions');
    throw new DatabaseError('Unexpected error deleting user sessions', err);
  }
}

/**
 * Extract session token from cookie header
 */
function extractSessionToken(cookieHeader: string): string | null {
  const cookies = cookieHeader.split(';').map((c) => c.trim());
  const sessionCookie = cookies.find((c) => c.startsWith('revealui-session='));

  if (!sessionCookie) {
    return null;
  }

  return decodeURIComponent(sessionCookie.substring('revealui-session='.length));
}

/**
 * Generate a secure random session token
 */
function generateSessionToken(): string {
  // Generate 32 bytes of random data and encode as base64
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString('base64url');
}
