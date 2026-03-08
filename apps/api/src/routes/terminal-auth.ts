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

import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod/v4'

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

  // TODO: Phase E implementation
  // 1. Check if fingerprint already linked
  // 2. Generate 6-digit OTP
  // 3. Store OTP with fingerprint + email (5-minute TTL)
  // 4. Send OTP to email via Resend
  // 5. Return success

  return c.json({
    success: true,
    message: `Verification code sent to ${email}`,
    fingerprint,
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

  // TODO: Phase E implementation
  // 1. Look up pending OTP by email
  // 2. Validate code matches and hasn't expired
  // 3. Find or create user by email
  // 4. Store SSH fingerprint on user record
  // 5. Return user info + tier

  return c.json({
    success: true,
    email,
    tier: 'free',
    message: 'SSH key linked successfully',
    _code: code,
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

  // TODO: Phase E implementation
  // 1. Query users table for matching sshKeyFingerprint
  // 2. Return user info (id, email, tier) or 404

  return c.json({ error: 'User not found' }, 404)
})

export default terminalAuth
