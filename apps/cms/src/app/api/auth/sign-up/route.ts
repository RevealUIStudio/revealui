/**
 * Sign Up API Route
 *
 * POST /api/auth/sign-up
 *
 * Creates a new user account.
 */

import { isSignupAllowed, signUp } from '@revealui/auth/server';
import { SignUpRequestContract } from '@revealui/contracts';
import { getMaxUsers, initializeLicense } from '@revealui/core/license';
import { getClient } from '@revealui/db';
import { users } from '@revealui/db/schema';
import { logger } from '@revealui/utils/logger';
import { count, eq, sql } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { sendVerificationEmail } from '@/lib/email/verification';
import { withRateLimit } from '@/lib/middleware/rate-limit';
import {
  createApplicationErrorResponse,
  createErrorResponse,
  createValidationErrorResponse,
} from '@/lib/utils/error-response';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function signUpHandler(request: NextRequest): Promise<NextResponse> {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch (jsonError) {
      return createValidationErrorResponse('Invalid JSON in request body', 'body', null, {
        parseError: jsonError instanceof Error ? jsonError.message : 'Malformed JSON',
      });
    }

    // Validate request body using contract
    const validationResult = SignUpRequestContract.validate(body);

    if (!validationResult.success) {
      // Extract first validation error for user-friendly response
      const firstIssue = validationResult.errors.issues[0];
      return createValidationErrorResponse(
        firstIssue?.message || 'Validation failed',
        firstIssue?.path?.join('.') || 'body',
        body,
        {
          issues: validationResult.errors.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      );
    }

    // Contract automatically sanitizes email (lowercase, trim) and name (trim, normalize spaces)
    const { email: sanitizedEmail, password, name: sanitizedName } = validationResult.data;
    const tosAcceptedAt = new Date();
    const tosVersion = process.env.TOS_VERSION ?? '2026-03-01';

    // Check signup whitelist before proceeding
    if (!isSignupAllowed(sanitizedEmail)) {
      return createApplicationErrorResponse(
        'Signups are currently restricted. Contact the administrator for access.',
        'SIGNUP_RESTRICTED',
        403,
      );
    }

    // Enforce user limit based on license tier (free: 3, pro: 25, enterprise: unlimited)
    // Also track whether this is the first user — they get admin role automatically.
    let isFirstUser = false;
    try {
      await initializeLicense();
      const maxUsers = getMaxUsers();
      const db = getClient();
      if (maxUsers !== Infinity) {
        // Check user limit. Prefer advisory lock inside a transaction to serialize
        // concurrent sign-up limit checks (prevents TOCTOU race). Falls back to a
        // non-atomic count when the driver doesn't support transactions (e.g. Neon HTTP).
        let limitExceeded = false;
        let limitMsg = '';
        try {
          await db.transaction(async (tx) => {
            await tx.execute(sql`SELECT pg_advisory_xact_lock(42000001)`);
            const [row] = await tx
              .select({ total: count() })
              .from(users)
              .where(eq(users.status, 'active'));
            const activeCount = row?.total ?? 0;
            isFirstUser = activeCount === 0;
            if (activeCount >= maxUsers) {
              limitExceeded = true;
              limitMsg = `User limit reached (${activeCount}/${maxUsers}). Upgrade your license to add more users.`;
            }
          });
        } catch (txError) {
          // Neon HTTP driver doesn't support transactions — fall back to simple count.
          // Safe for single-instance CMS; concurrent sign-ups have a small TOCTOU window.
          logger.warn('Transaction not supported, falling back to non-atomic user count', {
            error: txError instanceof Error ? txError.message : String(txError),
          });
          const [row] = await db
            .select({ total: count() })
            .from(users)
            .where(eq(users.status, 'active'));
          const activeCount = row?.total ?? 0;
          isFirstUser = activeCount === 0;
          if (activeCount >= maxUsers) {
            limitExceeded = true;
            limitMsg = `User limit reached (${activeCount}/${maxUsers}). Upgrade your license to add more users.`;
          }
        }
        if (limitExceeded) {
          return createApplicationErrorResponse(limitMsg, 'USER_LIMIT_REACHED', 403);
        }
      } else {
        // No per-tier limit — still need to know if this is the first user
        const [row] = await db
          .select({ total: count() })
          .from(users)
          .where(eq(users.status, 'active'));
        isFirstUser = (row?.total ?? 0) === 0;
      }
    } catch (limitError) {
      logger.error('User limit check failed during sign-up', {
        error: limitError instanceof Error ? limitError.message : String(limitError),
      });
      return createApplicationErrorResponse(
        'Unable to verify account limits. Please try again.',
        'LIMIT_CHECK_FAILED',
        503,
      );
    }

    // Get user agent and IP address for session tracking
    const userAgent = request.headers.get('user-agent') || undefined;
    const ipAddress =
      request.headers.get('x-real-ip') ||
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      undefined;

    const result = await signUp(sanitizedEmail, password, sanitizedName, {
      userAgent,
      ipAddress,
      tosAcceptedAt,
      tosVersion,
    });

    if (!result.success) {
      return createApplicationErrorResponse(
        result.error || 'Unable to create account',
        'SIGNUP_FAILED',
        400,
      );
    }

    // First user automatically becomes admin with verified email so they can
    // access /admin immediately without waiting for email verification.
    let resolvedUser = result.user;
    if (isFirstUser && result.user?.id) {
      try {
        const db = getClient();
        const [updatedUser] = await db
          .update(users)
          .set({ role: 'admin', emailVerified: true, emailVerifiedAt: new Date() })
          .where(eq(users.id, result.user.id))
          .returning();
        if (updatedUser) {
          resolvedUser = {
            ...updatedUser,
            emailVerificationToken: result.user.emailVerificationToken,
          };
        }
      } catch (upgradeError) {
        // Non-fatal — user was created, couldn't promote to admin
        logger.warn('Failed to promote first user to admin', {
          userId: result.user.id,
          error: upgradeError instanceof Error ? upgradeError.message : String(upgradeError),
        });
      }
    }

    // Send verification email (fire-and-forget — don't block signup)
    if (!isFirstUser && resolvedUser?.email && resolvedUser?.emailVerificationToken) {
      sendVerificationEmail(resolvedUser.email, resolvedUser.emailVerificationToken).catch(
        (emailError) => {
          logger.warn('Failed to send verification email', {
            userId: resolvedUser?.id,
            error: emailError,
          });
        },
      );
    }

    // Create response with user data
    const response = NextResponse.json({
      user: {
        id: resolvedUser?.id,
        email: resolvedUser?.email,
        name: resolvedUser?.name,
        avatarUrl: resolvedUser?.avatarUrl,
        role: resolvedUser?.role,
        emailVerified: resolvedUser?.emailVerified ?? false,
      },
    });

    // Grant session if email is verified. First-user admin accounts are verified
    // immediately above. Other new signups must verify their email first.
    const isVerified = resolvedUser?.emailVerified ?? false;

    if (result.sessionToken && isVerified) {
      // Set role hint cookie for proxy.ts admin gate (defense-in-depth).
      const userRole = resolvedUser?.role ?? 'user';
      const isAdminRole = ['admin', 'super-admin', 'user-admin', 'user-super-admin'].includes(
        userRole,
      );
      response.cookies.set('revealui-role', isAdminRole ? 'admin' : 'user', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
        domain:
          process.env.NODE_ENV === 'production'
            ? process.env.SESSION_COOKIE_DOMAIN || undefined
            : undefined,
      });

      response.cookies.set('revealui-session', result.sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        domain:
          process.env.NODE_ENV === 'production'
            ? (() => {
                if (!process.env.SESSION_COOKIE_DOMAIN) {
                  logger.error(
                    'SESSION_COOKIE_DOMAIN env var is required in production — session cookie will not be set cross-subdomain',
                  );
                }
                return process.env.SESSION_COOKIE_DOMAIN || undefined;
              })()
            : undefined,
      });
    }

    return response;
  } catch (error) {
    logger.error('Error signing up', { error });
    return createErrorResponse(error, {
      endpoint: '/api/auth/sign-up',
      operation: 'sign_up',
    });
  }
}

// Export rate-limited handler
export const POST = withRateLimit(signUpHandler, {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
  keyPrefix: 'signup',
  failClosed: true,
});
