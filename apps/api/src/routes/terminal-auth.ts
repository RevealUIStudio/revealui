/**
 * Terminal Auth Routes
 *
 * Links SSH key fingerprints to RevealUI accounts for the
 * `ssh terminal.revealui.com` payment TUI.
 *
 * Endpoints:
 * - POST /api/terminal-auth/link   — link SSH fingerprint to account (sends OTP)
 * - POST /api/terminal-auth/verify — verify email OTP and confirm link
 * - GET  /api/terminal-auth/lookup — lookup user by SSH fingerprint
 */

import { randomInt } from 'node:crypto'
import { zValidator } from '@hono/zod-validator'
import { logger } from '@revealui/core/observability/logger'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod/v4'
import { sendEmail } from '../lib/email.js'

// =============================================================================
// Configuration
// =============================================================================

export interface TerminalAuthConfig {
  /** OTP time-to-live in milliseconds (default: 5 minutes) */
  otpTtlMs: number
  /** OTP length in digits (default: 6) */
  otpLength: number
  /** Max pending OTPs before forced cleanup (default: 10_000) */
  maxPending: number
}

const DEFAULT_CONFIG: TerminalAuthConfig = {
  otpTtlMs: 5 * 60 * 1000,
  otpLength: 6,
  maxPending: 10_000,
}

let config: TerminalAuthConfig = { ...DEFAULT_CONFIG }

/** Override default terminal auth config (useful for testing) */
export function configureTerminalAuth(overrides: Partial<TerminalAuthConfig>): void {
  config = { ...DEFAULT_CONFIG, ...overrides }
}

// =============================================================================
// OTP Store (in-memory with TTL — single instance only)
// Production: replace with DB-backed store for multi-instance deployments
// =============================================================================

interface PendingOtp {
  code: string
  fingerprint: string
  email: string
  expiresAt: number
}

const otpStore = new Map<string, PendingOtp>()

function generateOtp(): string {
  const min = 10 ** (config.otpLength - 1)
  const max = 10 ** config.otpLength
  return randomInt(min, max).toString()
}

function cleanupExpired(): void {
  const now = Date.now()
  for (const [key, entry] of otpStore) {
    if (entry.expiresAt < now) {
      otpStore.delete(key)
    }
  }
  // Safety valve: clear all if store grows too large
  if (otpStore.size > config.maxPending) {
    logger.warn('OTP store exceeded max pending, clearing all entries', {
      size: otpStore.size,
      max: config.maxPending,
    })
    otpStore.clear()
  }
}

/** Clear OTP store (for testing) */
export function clearOtpStore(): void {
  otpStore.clear()
}

// =============================================================================
// Routes
// =============================================================================

const terminalAuth = new Hono()

const linkSchema = z.object({
  fingerprint: z.string().min(1),
  email: z.email(),
})

const verifySchema = z.object({
  email: z.email(),
  code: z.string().min(6).max(6),
})

/**
 * POST /api/terminal-auth/link
 *
 * Associates an SSH key fingerprint with an email address.
 * Sends a one-time verification code to the email.
 */
terminalAuth.post('/link', zValidator('json', linkSchema), async (c) => {
  const { fingerprint, email } = c.req.valid('json')

  cleanupExpired()

  // Check if fingerprint already linked to a user
  const db = c.get('db')
  if (db) {
    const { users } = await import('@revealui/db/schema/users')
    const [existing] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.sshKeyFingerprint, fingerprint))
      .limit(1)

    if (existing) {
      return c.json(
        {
          success: false,
          error: `This SSH key is already linked to ${existing.email}`,
        },
        409,
      )
    }
  }

  // Generate and store OTP
  const code = generateOtp()
  otpStore.set(email, {
    code,
    fingerprint,
    email,
    expiresAt: Date.now() + config.otpTtlMs,
  })

  // Send verification email
  try {
    await sendEmail({
      to: email,
      subject: 'RevealUI Terminal — Verification Code',
      html: `
        <h2>Terminal Verification</h2>
        <p>Your verification code for <code>ssh terminal.revealui.com</code>:</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 4px; font-family: monospace;">${code}</p>
        <p>This code expires in 5 minutes.</p>
        <p style="color: #666; font-size: 12px;">If you didn't request this, you can safely ignore this email.</p>
      `,
      text: `Your RevealUI Terminal verification code: ${code}\n\nThis code expires in 5 minutes.`,
    })
  } catch (err) {
    logger.error('Failed to send terminal auth OTP email', { email, error: err })
    return c.json({ success: false, error: 'Failed to send verification email' }, 500)
  }

  return c.json({
    success: true,
    message: `Verification code sent to ${email}`,
  })
})

/**
 * POST /api/terminal-auth/verify
 *
 * Verifies the email OTP and confirms the SSH key → account link.
 * On success, stores the fingerprint in the user's record.
 */
terminalAuth.post('/verify', zValidator('json', verifySchema), async (c) => {
  const { email, code } = c.req.valid('json')

  cleanupExpired()

  // Validate OTP
  const pending = otpStore.get(email)
  if (!pending) {
    return c.json({ success: false, error: 'No pending verification for this email' }, 400)
  }

  if (pending.expiresAt < Date.now()) {
    otpStore.delete(email)
    return c.json({ success: false, error: 'Verification code has expired' }, 400)
  }

  if (pending.code !== code) {
    return c.json({ success: false, error: 'Invalid verification code' }, 400)
  }

  // OTP valid — consume it
  otpStore.delete(email)

  // Link fingerprint to user
  const db = c.get('db')
  if (!db) {
    return c.json({ success: false, error: 'Database not available' }, 503)
  }

  const { users } = await import('@revealui/db/schema/users')

  // Find user by email
  const [user] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  if (!user) {
    return c.json({ success: false, error: 'No account found for this email' }, 404)
  }

  // Store SSH fingerprint on user record
  await db
    .update(users)
    .set({
      sshKeyFingerprint: pending.fingerprint,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id))

  logger.info('SSH key linked to user via terminal auth', {
    userId: user.id,
    fingerprint: pending.fingerprint,
  })

  return c.json({
    success: true,
    email,
    userId: user.id,
    message: 'SSH key linked successfully',
  })
})

/**
 * GET /api/terminal-auth/lookup
 *
 * Looks up a user by SSH key fingerprint.
 * Returns 404 if the fingerprint is not linked to any account.
 */
terminalAuth.get('/lookup', async (c) => {
  const fingerprint = c.req.query('fingerprint')

  if (!fingerprint) {
    return c.json({ error: 'fingerprint query parameter required' }, 400)
  }

  const db = c.get('db')
  if (!db) {
    return c.json({ error: 'Database not available' }, 503)
  }

  const { users } = await import('@revealui/db/schema/users')

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
    })
    .from(users)
    .where(eq(users.sshKeyFingerprint, fingerprint))
    .limit(1)

  if (!user) {
    return c.json({ error: 'User not found' }, 404)
  }

  return c.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  })
})

export default terminalAuth
