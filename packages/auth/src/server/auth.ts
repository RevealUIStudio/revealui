/**
 * Authentication Functions (Server-side)
 *
 * Sign in and sign up functionality with password hashing.
 */

import { createHash, randomBytes } from 'node:crypto';
import { logger } from '@revealui/core/observability/logger';
import { getClient } from '@revealui/db/client';
import { oauthAccounts, users } from '@revealui/db/schema';
import bcrypt from 'bcryptjs';
import { and, eq, isNull } from 'drizzle-orm';
import type { SignInResult, SignUpResult, User } from '../types.js';
import { clearFailedAttempts, isAccountLocked, recordFailedAttempt } from './brute-force.js';
import { validatePasswordStrength } from './password-validation.js';
import { checkRateLimit } from './rate-limit.js';
import { createSession, rotateSession } from './session.js';

/** Grace period after signup during which unverified users can still sign in (24 hours) */
const EMAIL_VERIFICATION_GRACE_PERIOD_MS = 24 * 60 * 60 * 1000;

/**
 * Sign in with email and password
 *
 * @param email - User email
 * @param password - User password
 * @param options - Additional options (userAgent, ipAddress)
 * @returns Sign in result with user and session token
 */
export async function signIn(
  email: string,
  password: string,
  options?: {
    userAgent?: string;
    ipAddress?: string;
  },
): Promise<SignInResult> {
  try {
    // Rate limiting by IP address
    const ipKey = options?.ipAddress || 'unknown';
    const rateLimit = await checkRateLimit(`signin:${ipKey}`);
    if (!rateLimit.allowed) {
      return {
        success: false,
        reason: 'rate_limited',
        error: 'Too many login attempts. Please try again later.',
      };
    }

    // Brute force protection by email
    const bruteForceCheck = await isAccountLocked(email);
    if (bruteForceCheck.locked) {
      const lockMinutes = bruteForceCheck.lockUntil
        ? Math.ceil((bruteForceCheck.lockUntil - Date.now()) / (60 * 1000))
        : 30;
      return {
        success: false,
        reason: 'account_locked',
        error: `Account locked due to too many failed attempts. Please try again in ${lockMinutes} minutes.`,
      };
    }

    let db: ReturnType<typeof getClient>;
    try {
      db = getClient();
    } catch (clientError) {
      logger.error(
        'Error getting database client',
        clientError instanceof Error ? clientError : undefined,
        {
          message: clientError instanceof Error ? clientError.message : String(clientError),
        },
      );
      return {
        success: false,
        reason: 'database_error',
        error: 'Database connection failed',
      };
    }

    // Find user by email
    let user: User | undefined;
    try {
      const result = await db
        .select()
        .from(users)
        .where(and(eq(users.email, email), isNull(users.deletedAt)))
        .limit(1);
      user = result[0] as User | undefined;
    } catch (dbError) {
      logger.error('Error querying user', dbError instanceof Error ? dbError : undefined, {
        message: dbError instanceof Error ? dbError.message : String(dbError),
        name: dbError instanceof Error ? dbError.name : 'unknown',
        stack: dbError instanceof Error ? dbError.stack : undefined,
      });
      return {
        success: false,
        reason: 'database_error',
        error: 'Database error',
      };
    }

    // Always return same error message to prevent user enumeration
    const invalidCredentialsMessage = 'Invalid email or password';

    if (!user) {
      await recordFailedAttempt(email);
      return {
        success: false,
        reason: 'invalid_credentials',
        error: invalidCredentialsMessage,
      };
    }

    // Check if user has a password (not OAuth-only user)
    if (!user.password) {
      await recordFailedAttempt(email);
      return {
        success: false,
        reason: 'invalid_credentials',
        error: invalidCredentialsMessage,
      };
    }

    // Verify password hash
    let isValid: boolean;
    try {
      isValid = await bcrypt.compare(password, user.password);
    } catch {
      logger.error('Error comparing password');
      await recordFailedAttempt(email);
      return {
        success: false,
        reason: 'invalid_credentials',
        error: invalidCredentialsMessage,
      };
    }

    if (!isValid) {
      await recordFailedAttempt(email);
      return {
        success: false,
        reason: 'invalid_credentials',
        error: invalidCredentialsMessage,
      };
    }

    // Successful login - clear failed attempts
    await clearFailedAttempts(email);

    // Check email verification (with grace period for new accounts)
    if (!user.emailVerified) {
      const accountAge = Date.now() - user.createdAt.getTime();
      if (accountAge > EMAIL_VERIFICATION_GRACE_PERIOD_MS) {
        return {
          success: false,
          reason: 'email_not_verified',
          error: 'Please verify your email address before signing in.',
        };
      }
    }

    // Check if MFA is enabled  -  if so, return early and require TOTP verification
    if (user.mfaEnabled) {
      return {
        success: true,
        requiresMfa: true,
        mfaUserId: user.id,
      };
    }

    // Rotate session: delete all existing sessions for this user, then create
    // a fresh one. This prevents session fixation attacks where an attacker
    // plants a session token that the victim later authenticates.
    let token: string;
    try {
      const sessionResult = await rotateSession(user.id, {
        userAgent: options?.userAgent || 'Unknown',
        ipAddress: options?.ipAddress || 'Unknown',
      });
      token = sessionResult.token;
    } catch {
      logger.error('Error creating session');
      return {
        success: false,
        reason: 'session_error',
        error: 'Failed to create session',
      };
    }

    // Check if password rotation is required (e.g., bootstrapped admin accounts)
    if (user.mustRotatePassword) {
      return {
        success: true,
        requiresPasswordRotation: true,
        user,
        sessionToken: token,
      };
    }

    return {
      success: true,
      user,
      sessionToken: token,
    };
  } catch {
    logger.error('Unexpected error in signIn');
    return {
      success: false,
      reason: 'unexpected_error',
      error: 'Unexpected error',
    };
  }
}

/**
 * Check if a given email is allowed to sign up.
 *
 * Behavior:
 * - If REVEALUI_SIGNUP_OPEN is 'true', all emails are allowed.
 * - If REVEALUI_SIGNUP_WHITELIST is set (comma-separated emails), only listed emails pass.
 * - If neither env var is set, signups are CLOSED (security default).
 *   Set REVEALUI_SIGNUP_OPEN=true explicitly to open registration.
 *
 * @param email - Lowercase, trimmed email to check
 * @returns true if signup is allowed
 */
export function isSignupAllowed(email: string): boolean {
  const signupOpen = process.env.REVEALUI_SIGNUP_OPEN;
  if (signupOpen === 'true') {
    return true;
  }

  const whitelist = process.env.REVEALUI_SIGNUP_WHITELIST;
  if (!whitelist) {
    // Default to closed — require explicit REVEALUI_SIGNUP_OPEN=true
    // or a whitelist to allow signups. Prevents accidental open
    // registration on new deployments.
    return false;
  }

  const allowedEmails = whitelist
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return allowedEmails.includes(email.toLowerCase());
}

/**
 * Sign up a new user
 *
 * @param email - User email
 * @param password - User password
 * @param name - User name
 * @param options - Additional options
 * @returns Sign up result with user and session token
 */
export async function signUp(
  email: string,
  password: string,
  name: string,
  options?: {
    userAgent?: string;
    ipAddress?: string;
    tosAcceptedAt?: Date;
    tosVersion?: string;
  },
): Promise<SignUpResult> {
  try {
    // Signup gating: check email whitelist before anything else
    if (!isSignupAllowed(email)) {
      return {
        success: false,
        error: 'Signups are currently restricted. Contact the administrator for access.',
      };
    }

    // Rate limiting by IP address
    const ipKey = options?.ipAddress || 'unknown';
    const rateLimit = await checkRateLimit(`signup:${ipKey}`);
    if (!rateLimit.allowed) {
      return {
        success: false,
        error: 'Too many registration attempts. Please try again later.',
      };
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      return {
        success: false,
        error: passwordValidation.errors.join('. '),
      };
    }

    // Check password against known data breaches (non-blocking on failure)
    const { checkPasswordBreach } = await import('./password-validation.js');
    const breachCount = await checkPasswordBreach(password);
    if (breachCount > 0) {
      return {
        success: false,
        error: `This password has appeared in ${breachCount.toLocaleString()} data breaches. Please choose a different password.`,
      };
    }

    let db: ReturnType<typeof getClient>;
    try {
      db = getClient();
    } catch {
      logger.error('Error getting database client');
      return {
        success: false,
        error: 'Database connection failed',
      };
    }

    // Check if user already exists (by email in users table or OAuth accounts).
    // Both checks prevent account collision: a password signup must not collide
    // with an existing OAuth identity for the same email address.
    let existing: User | undefined;
    try {
      const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
      existing = result[0] as User | undefined;
    } catch {
      logger.error('Error checking existing user');
      return {
        success: false,
        error: 'Database error',
      };
    }

    if (existing) {
      return {
        success: false,
        error: 'Unable to create account',
      };
    }

    // Block signup if an OAuth account already uses this email.
    // Without this check, an attacker could create a password account
    // for an email that was registered via OAuth, enabling account takeover.
    try {
      const [existingOAuth] = await db
        .select({ id: oauthAccounts.id })
        .from(oauthAccounts)
        .where(eq(oauthAccounts.providerEmail, email))
        .limit(1);

      if (existingOAuth) {
        return {
          success: false,
          error: 'Unable to create account',
        };
      }
    } catch {
      logger.error('Error checking OAuth accounts');
      return {
        success: false,
        error: 'Database error',
      };
    }

    // Hash password
    let hashedPassword: string;
    try {
      hashedPassword = await bcrypt.hash(password, 12);
    } catch {
      logger.error('Error hashing password');
      return {
        success: false,
        error: 'Failed to process password',
      };
    }

    // Generate email verification token.
    // Store the SHA-256 hash in the DB; send the raw token in the email link.
    // A DB breach cannot be used to verify arbitrary emails without the raw token.
    const rawEmailVerificationToken = randomBytes(32).toString('hex');
    const emailVerificationToken = createHash('sha256')
      .update(rawEmailVerificationToken)
      .digest('hex');
    const emailVerificationTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    // Create user
    let user: User | undefined;
    try {
      const result = await db
        .insert(users)
        .values({
          id: crypto.randomUUID(),
          email,
          name,
          password: hashedPassword,
          emailVerified: false,
          emailVerificationToken,
          emailVerificationTokenExpiresAt,
          tosAcceptedAt: options?.tosAcceptedAt ?? null,
          tosVersion: options?.tosVersion ?? null,
        })
        .returning();
      user = result[0] as User | undefined;
    } catch {
      logger.error('Error creating user');
      return {
        success: false,
        error: 'Failed to create user',
      };
    }

    if (!user) {
      return {
        success: false,
        error: 'User creation returned no result',
      };
    }

    // Create session
    let token: string;
    try {
      const sessionResult = await createSession(user.id, {
        userAgent: options?.userAgent || 'Unknown',
        ipAddress: options?.ipAddress || 'Unknown',
      });
      token = sessionResult.token;
    } catch {
      logger.error('Error creating session');
      // Clean up orphaned user so the email isn't permanently locked out.
      // Without this, a retry would fail with "Unable to create account"
      // because the user row already exists but has no valid session.
      try {
        await db.delete(users).where(eq(users.id, user.id));
      } catch {
        logger.error('Failed to clean up orphaned user after session creation failure', undefined, {
          userId: user.id,
        });
      }
      return {
        success: false,
        error: 'Failed to create session',
      };
    }

    // Return the raw (unhashed) token so the caller can include it in the
    // verification email link. The DB holds only the hash.
    const userWithRawToken = { ...user, emailVerificationToken: rawEmailVerificationToken };

    return {
      success: true,
      user: userWithRawToken,
      sessionToken: token,
    };
  } catch {
    logger.error('Unexpected error in signUp');
    return {
      success: false,
      error: 'Unexpected error',
    };
  }
}
