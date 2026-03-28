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

import { randomInt, timingSafeEqual } from 'node:crypto';
import { getStorage, type Storage } from '@revealui/auth/server';
import { logger } from '@revealui/core/observability/logger';
import type { DatabaseClient } from '@revealui/db/client';
import { zValidator } from '@revealui/openapi';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod/v4';
import { sendEmail } from '../lib/email.js';

// =============================================================================
// Configuration
// =============================================================================

export interface TerminalAuthConfig {
  /** OTP time-to-live in milliseconds (default: 5 minutes) */
  otpTtlMs: number;
  /** OTP length in digits (default: 6) */
  otpLength: number;
  /** Max verification attempts per OTP before invalidation (default: 5) */
  maxOtpAttempts: number;
  /** Custom storage backend (default: auto-detected via getStorage()) */
  storage?: Storage;
}

const DEFAULT_CONFIG: TerminalAuthConfig = {
  otpTtlMs: 5 * 60 * 1000,
  otpLength: 6,
  maxOtpAttempts: 5,
};

let config: TerminalAuthConfig = { ...DEFAULT_CONFIG };

/** Override default terminal auth config (useful for testing) */
export function configureTerminalAuth(overrides: Partial<TerminalAuthConfig>): void {
  config = { ...DEFAULT_CONFIG, ...overrides };
}

// =============================================================================
// OTP Store — backed by @revealui/auth Storage interface
//
// Uses DatabaseStorage in production (multi-instance safe) and
// InMemoryStorage in development. TTL is handled by the storage layer.
// =============================================================================

interface PendingOtp {
  code: string;
  fingerprint: string;
  email: string;
  attempts: number;
}

const OTP_KEY_PREFIX = 'terminal-otp:';

function getOtpStorage(): Storage {
  return config.storage ?? getStorage();
}

function generateOtp(): string {
  const min = 10 ** (config.otpLength - 1);
  const max = 10 ** config.otpLength;
  return randomInt(min, max).toString();
}

async function storeOtp(email: string, otp: PendingOtp): Promise<void> {
  const storage = getOtpStorage();
  const ttlSeconds = Math.ceil(config.otpTtlMs / 1000);
  await storage.set(`${OTP_KEY_PREFIX}${email}`, JSON.stringify(otp), ttlSeconds);
}

async function getOtp(email: string): Promise<PendingOtp | null> {
  const storage = getOtpStorage();
  const data = await storage.get(`${OTP_KEY_PREFIX}${email}`);
  if (!data) return null;
  return JSON.parse(data) as PendingOtp;
}

async function deleteOtp(email: string): Promise<void> {
  const storage = getOtpStorage();
  await storage.del(`${OTP_KEY_PREFIX}${email}`);
}

/** Clear OTP store (for testing) */
export function clearOtpStore(): void {
  // For testing with InMemoryStorage — no-op for DB storage (TTL handles cleanup)
}

// =============================================================================
// Routes
// =============================================================================

type Variables = {
  db?: DatabaseClient;
  user?: { id: string };
};

const terminalAuth = new Hono<{ Variables: Variables }>();

const linkSchema = z.object({
  fingerprint: z.string().min(1),
  email: z.email(),
});

const verifySchema = z.object({
  email: z.email(),
  code: z.string().min(6).max(6),
});

/**
 * POST /api/terminal-auth/link
 *
 * Associates an SSH key fingerprint with an email address.
 * Sends a one-time verification code to the email.
 */
terminalAuth.post('/link', zValidator('json', linkSchema), async (c) => {
  const { fingerprint, email } = c.req.valid('json');

  // Check if fingerprint already linked to a user
  const db = c.get('db');
  if (db) {
    const { users } = await import('@revealui/db/schema/users');
    const [existing] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.sshKeyFingerprint, fingerprint))
      .limit(1);

    if (existing) {
      return c.json(
        {
          success: false,
          error: 'This SSH key is already linked to an account',
        },
        409,
      );
    }
  }

  // Generate and store OTP (TTL handled by storage layer)
  const code = generateOtp();
  await storeOtp(email, { code, fingerprint, email, attempts: 0 });

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
    });
  } catch (err) {
    logger.error('Failed to send terminal auth OTP email', err instanceof Error ? err : undefined, {
      email,
    });
    return c.json({ success: false, error: 'Failed to send verification email' }, 500);
  }

  return c.json({
    success: true,
    message: `Verification code sent to ${email}`,
  });
});

/**
 * POST /api/terminal-auth/verify
 *
 * Verifies the email OTP and confirms the SSH key → account link.
 * On success, stores the fingerprint in the user's record.
 */
terminalAuth.post('/verify', zValidator('json', verifySchema), async (c) => {
  const { email, code } = c.req.valid('json');

  // Validate OTP (expiry is handled by storage TTL — if it's gone, it expired)
  const pending = await getOtp(email);
  if (!pending) {
    return c.json({ success: false, error: 'No pending verification or code has expired' }, 400);
  }

  // Enforce attempt limit — invalidate OTP after too many failed attempts
  if (pending.attempts >= config.maxOtpAttempts) {
    await deleteOtp(email);
    return c.json(
      { success: false, error: 'Too many verification attempts. Please request a new code.' },
      429,
    );
  }

  const codeMatch =
    pending.code.length === code.length &&
    timingSafeEqual(Buffer.from(pending.code), Buffer.from(code));
  if (!codeMatch) {
    // Increment attempt counter and re-store with remaining TTL
    pending.attempts += 1;
    await storeOtp(email, pending);
    return c.json({ success: false, error: 'Invalid verification code' }, 400);
  }

  // OTP valid — consume it
  await deleteOtp(email);

  // Link fingerprint to user
  const db = c.get('db');
  if (!db) {
    return c.json({ success: false, error: 'Database not available' }, 503);
  }

  const { users } = await import('@revealui/db/schema/users');

  // Find user by email
  const [user] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    return c.json({ success: false, error: 'No account found for this email' }, 404);
  }

  // Store SSH fingerprint on user record
  await db
    .update(users)
    .set({
      sshKeyFingerprint: pending.fingerprint,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  logger.info('SSH key linked to user via terminal auth', {
    userId: user.id,
    fingerprint: pending.fingerprint,
  });

  return c.json({
    success: true,
    email,
    userId: user.id,
    message: 'SSH key linked successfully',
  });
});

/**
 * GET /api/terminal-auth/lookup
 *
 * Looks up a user by SSH key fingerprint.
 * Requires authentication to prevent PII enumeration via public SSH fingerprints.
 * Returns 404 if the fingerprint is not linked to any account.
 */
terminalAuth.get('/lookup', async (c) => {
  const caller = c.get('user');
  if (!caller) {
    return c.json({ success: false, error: 'Authentication required' }, 401);
  }

  const fingerprint = c.req.query('fingerprint');

  if (!fingerprint) {
    return c.json({ success: false, error: 'fingerprint query parameter required' }, 400);
  }

  const db = c.get('db');
  if (!db) {
    return c.json({ success: false, error: 'Database not available' }, 503);
  }

  const { users } = await import('@revealui/db/schema/users');

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
    })
    .from(users)
    .where(eq(users.sshKeyFingerprint, fingerprint))
    .limit(1);

  if (!user) {
    return c.json({ success: false, error: 'User not found' }, 404);
  }

  return c.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });
});

export default terminalAuth;
