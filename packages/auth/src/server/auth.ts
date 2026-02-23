/**
 * Authentication Functions (Server-side)
 *
 * Sign in and sign up functionality with password hashing.
 */

import { logger } from '@revealui/core'
import { getClient } from '@revealui/db/client'
import { users } from '@revealui/db/schema'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import type { SignInResult, SignUpResult, User } from '../types.js'
import { clearFailedAttempts, isAccountLocked, recordFailedAttempt } from './brute-force.js'
import { validatePasswordStrength } from './password-validation.js'
import { checkRateLimit } from './rate-limit.js'
import { createSession } from './session.js'

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
    userAgent?: string
    ipAddress?: string
  },
): Promise<SignInResult> {
  try {
    // Rate limiting by IP address
    const ipKey = options?.ipAddress || 'unknown'
    const rateLimit = await checkRateLimit(`signin:${ipKey}`)
    if (!rateLimit.allowed) {
      return {
        success: false,
        error: 'Too many login attempts. Please try again later.',
      }
    }

    // Brute force protection by email
    const bruteForceCheck = await isAccountLocked(email)
    if (bruteForceCheck.locked) {
      const lockMinutes = bruteForceCheck.lockUntil
        ? Math.ceil((bruteForceCheck.lockUntil - Date.now()) / (60 * 1000))
        : 30
      return {
        success: false,
        error: `Account locked due to too many failed attempts. Please try again in ${lockMinutes} minutes.`,
      }
    }

    let db: ReturnType<typeof getClient>
    try {
      db = getClient()
    } catch {
      logger.error('Error getting database client')
      return {
        success: false,
        error: 'Database connection failed',
      }
    }

    // Find user by email
    let user: User | undefined
    try {
      const result = await db.select().from(users).where(eq(users.email, email)).limit(1)
      user = result[0] as User | undefined
    } catch {
      logger.error('Error querying user')
      return {
        success: false,
        error: 'Database error',
      }
    }

    // Always return same error message to prevent user enumeration
    const invalidCredentialsMessage = 'Invalid email or password'

    if (!user) {
      await recordFailedAttempt(email)
      return {
        success: false,
        error: invalidCredentialsMessage,
      }
    }

    // Check if user has a password (not OAuth-only user)
    if (!user.password) {
      await recordFailedAttempt(email)
      return {
        success: false,
        error: invalidCredentialsMessage,
      }
    }

    // Verify password hash
    let isValid: boolean
    try {
      isValid = await bcrypt.compare(password, user.password)
    } catch {
      logger.error('Error comparing password')
      await recordFailedAttempt(email)
      return {
        success: false,
        error: invalidCredentialsMessage,
      }
    }

    if (!isValid) {
      await recordFailedAttempt(email)
      return {
        success: false,
        error: invalidCredentialsMessage,
      }
    }

    // Successful login - clear failed attempts
    await clearFailedAttempts(email)

    // Create session
    let token: string
    try {
      const sessionResult = await createSession(user.id, {
        userAgent: options?.userAgent || 'Unknown',
        ipAddress: options?.ipAddress || 'Unknown',
      })
      token = sessionResult.token
    } catch {
      logger.error('Error creating session')
      return {
        success: false,
        error: 'Failed to create session',
      }
    }

    return {
      success: true,
      user,
      sessionToken: token,
    }
  } catch {
    logger.error('Unexpected error in signIn')
    return {
      success: false,
      error: 'Unexpected error',
    }
  }
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
    userAgent?: string
    ipAddress?: string
  },
): Promise<SignUpResult> {
  try {
    // Rate limiting by IP address
    const ipKey = options?.ipAddress || 'unknown'
    const rateLimit = await checkRateLimit(`signup:${ipKey}`)
    if (!rateLimit.allowed) {
      return {
        success: false,
        error: 'Too many registration attempts. Please try again later.',
      }
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password)
    if (!passwordValidation.valid) {
      return {
        success: false,
        error: passwordValidation.errors.join('. '),
      }
    }

    let db: ReturnType<typeof getClient>
    try {
      db = getClient()
    } catch {
      logger.error('Error getting database client')
      return {
        success: false,
        error: 'Database connection failed',
      }
    }

    // Check if user already exists
    let existing: User | undefined
    try {
      const result = await db.select().from(users).where(eq(users.email, email)).limit(1)
      existing = result[0] as User | undefined
    } catch {
      logger.error('Error checking existing user')
      return {
        success: false,
        error: 'Database error',
      }
    }

    if (existing) {
      return {
        success: false,
        error: 'Unable to create account',
      }
    }

    // Hash password
    let hashedPassword: string
    try {
      hashedPassword = await bcrypt.hash(password, 12)
    } catch {
      logger.error('Error hashing password')
      return {
        success: false,
        error: 'Failed to process password',
      }
    }

    // Create user
    let user: User | undefined
    try {
      const result = await db
        .insert(users)
        .values({
          id: crypto.randomUUID(),
          email,
          name,
          password: hashedPassword,
        })
        .returning()
      user = result[0] as User | undefined
    } catch {
      logger.error('Error creating user')
      return {
        success: false,
        error: 'Failed to create user',
      }
    }

    if (!user) {
      return {
        success: false,
        error: 'User creation returned no result',
      }
    }

    // Create session
    let token: string
    try {
      const sessionResult = await createSession(user.id, {
        userAgent: options?.userAgent || 'Unknown',
        ipAddress: options?.ipAddress || 'Unknown',
      })
      token = sessionResult.token
    } catch {
      logger.error('Error creating session')
      return {
        success: false,
        error: 'Failed to create session',
      }
    }

    return {
      success: true,
      user,
      sessionToken: token,
    }
  } catch {
    logger.error('Unexpected error in signUp')
    return {
      success: false,
      error: 'Unexpected error',
    }
  }
}
