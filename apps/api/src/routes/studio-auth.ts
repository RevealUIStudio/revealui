/**
 * Studio Auth Routes  -  Device-Based Authentication
 *
 * Enables RevealUI Studio (desktop), CLI, and terminal clients
 * to authenticate with the API using bearer tokens tied to registered devices.
 *
 * Flow:
 * 1. POST /api/studio-auth/link      -  send OTP to email, register device intent
 * 2. POST /api/studio-auth/verify    -  verify OTP, create device + bearer token
 * 3. POST /api/studio-auth/refresh   -  rotate bearer token (requires valid token)
 * 4. DELETE /api/studio-auth/revoke  -  revoke device token (requires valid token)
 * 5. GET /api/studio-auth/status     -  check current auth status (requires valid token)
 *
 * Token format: rvui_dev_<64-hex-chars> (SHA-256 hash stored in DB)
 * Token lifetime: 30 days (configurable)
 */

import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { getStorage, type Storage } from '@revealui/auth/server';
import { logger } from '@revealui/core/observability/logger';
import { getClient } from '@revealui/db';
import { userDevices } from '@revealui/db/schema';
import { users } from '@revealui/db/schema/users';
import { zValidator } from '@revealui/openapi';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod/v4';
import { sendEmail } from '../lib/email.js';

/** Escape HTML special characters to prevent XSS in email templates */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// =============================================================================
// Configuration
// =============================================================================

export interface StudioAuthConfig {
  /** OTP time-to-live in milliseconds (default: 10 minutes) */
  otpTtlMs: number;
  /** OTP length in digits (default: 6) */
  otpLength: number;
  /** Max OTP verification attempts before invalidation (default: 5) */
  maxOtpAttempts: number;
  /** Device token lifetime in milliseconds (default: 30 days) */
  tokenLifetimeMs: number;
  /** Custom storage backend (default: auto-detected) */
  storage?: Storage;
}

const DEFAULT_CONFIG: StudioAuthConfig = {
  otpTtlMs: 10 * 60 * 1000,
  otpLength: 6,
  maxOtpAttempts: 5,
  tokenLifetimeMs: 30 * 24 * 60 * 60 * 1000,
};

let config: StudioAuthConfig = { ...DEFAULT_CONFIG };

export function configureStudioAuth(overrides: Partial<StudioAuthConfig>): void {
  config = { ...DEFAULT_CONFIG, ...overrides };
}

// =============================================================================
// OTP Store
// =============================================================================

interface PendingDeviceOtp {
  code: string;
  email: string;
  deviceId: string;
  deviceName: string;
  deviceType: string;
  attempts: number;
}

const OTP_KEY_PREFIX = 'studio-otp:';

function getOtpStorage(): Storage {
  return config.storage ?? getStorage();
}

function generateOtp(): string {
  const min = 10 ** (config.otpLength - 1);
  const max = 10 ** config.otpLength;
  return randomInt(min, max).toString();
}

function generateDeviceToken(): string {
  return `rvui_dev_${randomBytes(32).toString('hex')}`;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

async function storeOtp(deviceId: string, otp: PendingDeviceOtp): Promise<void> {
  const storage = getOtpStorage();
  const ttlSeconds = Math.ceil(config.otpTtlMs / 1000);
  await storage.set(`${OTP_KEY_PREFIX}${deviceId}`, JSON.stringify(otp), ttlSeconds);
}

async function getOtp(deviceId: string): Promise<PendingDeviceOtp | null> {
  const storage = getOtpStorage();
  const data = await storage.get(`${OTP_KEY_PREFIX}${deviceId}`);
  if (!data) return null;
  return JSON.parse(data) as PendingDeviceOtp;
}

async function deleteOtp(deviceId: string): Promise<void> {
  const storage = getOtpStorage();
  await storage.del(`${OTP_KEY_PREFIX}${deviceId}`);
}

// =============================================================================
// Routes
// =============================================================================

const app = new Hono();

const linkSchema = z.object({
  email: z.email(),
  deviceId: z.string().min(1).max(128),
  deviceName: z.string().min(1).max(64),
  deviceType: z.enum(['desktop', 'cli', 'tablet', 'mobile']).default('desktop'),
});

const verifySchema = z.object({
  email: z.email(),
  deviceId: z.string().min(1).max(128),
  code: z.string().min(6).max(6),
});

/**
 * POST /api/studio-auth/link
 *
 * Initiates device authentication. Sends an OTP to the user's email.
 * The user must have an existing RevealUI account.
 */
app.post('/link', zValidator('json', linkSchema), async (c) => {
  const { email, deviceId, deviceName, deviceType } = c.req.valid('json');

  const db = getClient();

  // Verify the user exists
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    // Don't reveal whether the email exists  -  generic message, but still 200
    // to prevent email enumeration
    return c.json({ success: true, message: `If an account exists, a code was sent to ${email}` });
  }

  // Generate and store OTP keyed by deviceId
  const code = generateOtp();
  await storeOtp(deviceId, { code, email, deviceId, deviceName, deviceType, attempts: 0 });

  // Send verification email
  try {
    await sendEmail({
      to: email,
      subject: 'RevealUI Studio  -  Device Verification',
      html: `
        <h2>Studio Device Verification</h2>
        <p>A new device is requesting access to your RevealUI account:</p>
        <table style="border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 4px 12px; color: #666;">Device</td><td style="padding: 4px 12px; font-weight: bold;">${escapeHtml(deviceName)}</td></tr>
          <tr><td style="padding: 4px 12px; color: #666;">Type</td><td style="padding: 4px 12px;">${escapeHtml(deviceType)}</td></tr>
        </table>
        <p>Your verification code:</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 4px; font-family: monospace;">${code}</p>
        <p>This code expires in 10 minutes.</p>
        <p style="color: #666; font-size: 12px;">If you didn't request this, you can safely ignore this email. No access has been granted.</p>
      `,
      text: `RevealUI Studio Device Verification\n\nDevice: ${deviceName} (${deviceType})\n\nYour code: ${code}\n\nExpires in 10 minutes.`,
    });
  } catch (err) {
    logger.error('Failed to send Studio auth OTP email', err instanceof Error ? err : undefined, {
      email,
      deviceId,
    });
    return c.json({ success: false, error: 'Failed to send verification email' }, 500);
  }

  return c.json({ success: true, message: `If an account exists, a code was sent to ${email}` });
});

/**
 * POST /api/studio-auth/verify
 *
 * Verifies the OTP. On success, registers the device and returns a bearer token.
 * The bearer token should be stored securely (e.g., in Studio's encrypted vault).
 */
app.post('/verify', zValidator('json', verifySchema), async (c) => {
  const { email, deviceId, code } = c.req.valid('json');

  const pending = await getOtp(deviceId);
  if (!pending) {
    return c.json({ success: false, error: 'No pending verification or code has expired' }, 400);
  }

  // Verify the email matches
  if (pending.email !== email) {
    return c.json({ success: false, error: 'No pending verification or code has expired' }, 400);
  }

  // Enforce attempt limit
  if (pending.attempts >= config.maxOtpAttempts) {
    await deleteOtp(deviceId);
    return c.json({ success: false, error: 'Too many attempts. Please request a new code.' }, 429);
  }

  // Timing-safe code comparison
  const codeMatch =
    pending.code.length === code.length &&
    timingSafeEqual(Buffer.from(pending.code), Buffer.from(code));
  if (!codeMatch) {
    pending.attempts += 1;
    await storeOtp(deviceId, pending);
    return c.json({ success: false, error: 'Invalid verification code' }, 400);
  }

  // OTP valid  -  consume it
  await deleteOtp(deviceId);

  const db = getClient();

  // Find the user
  const [user] = await db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    return c.json({ success: false, error: 'Account not found' }, 404);
  }

  // Generate bearer token
  const token = generateDeviceToken();
  const tokenHash = hashToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + config.tokenLifetimeMs);

  // Upsert device  -  if deviceId already exists, update token
  const [existing] = await db
    .select({ id: userDevices.id })
    .from(userDevices)
    .where(eq(userDevices.deviceId, deviceId))
    .limit(1);

  if (existing) {
    await db
      .update(userDevices)
      .set({
        userId: user.id,
        deviceName: pending.deviceName,
        deviceType: pending.deviceType,
        tokenHash,
        tokenExpiresAt: expiresAt,
        tokenIssuedAt: now,
        isActive: true,
        lastSeen: now,
        updatedAt: now,
      })
      .where(eq(userDevices.id, existing.id));
  } else {
    await db.insert(userDevices).values({
      id: crypto.randomUUID(),
      userId: user.id,
      deviceId,
      deviceName: pending.deviceName,
      deviceType: pending.deviceType,
      tokenHash,
      tokenExpiresAt: expiresAt,
      tokenIssuedAt: now,
      isActive: true,
      lastSeen: now,
      createdAt: now,
      updatedAt: now,
    });
  }

  logger.info('Studio device authenticated', {
    userId: user.id,
    deviceId,
    deviceName: pending.deviceName,
  });

  return c.json({
    success: true,
    token,
    expiresAt: expiresAt.toISOString(),
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });
});

/**
 * POST /api/studio-auth/refresh
 *
 * Rotates the device bearer token. Requires a valid (non-expired) token.
 * The old token is immediately invalidated.
 */
app.post('/refresh', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer rvui_dev_')) {
    return c.json({ success: false, error: 'Valid device token required' }, 401);
  }

  const oldToken = authHeader.slice(7);
  const oldHash = hashToken(oldToken);
  const db = getClient();
  const now = new Date();

  const [device] = await db
    .select({
      id: userDevices.id,
      userId: userDevices.userId,
      tokenExpiresAt: userDevices.tokenExpiresAt,
    })
    .from(userDevices)
    .where(and(eq(userDevices.tokenHash, oldHash), eq(userDevices.isActive, true)))
    .limit(1);

  if (!device || (device.tokenExpiresAt && device.tokenExpiresAt < now)) {
    return c.json({ success: false, error: 'Invalid or expired token' }, 401);
  }

  // Generate new token
  const newToken = generateDeviceToken();
  const newHash = hashToken(newToken);
  const expiresAt = new Date(now.getTime() + config.tokenLifetimeMs);

  await db
    .update(userDevices)
    .set({
      tokenHash: newHash,
      tokenExpiresAt: expiresAt,
      tokenIssuedAt: now,
      lastSeen: now,
      updatedAt: now,
    })
    .where(eq(userDevices.id, device.id));

  return c.json({
    success: true,
    token: newToken,
    expiresAt: expiresAt.toISOString(),
  });
});

/**
 * DELETE /api/studio-auth/revoke
 *
 * Revokes the device token (sign out). The device must re-verify to get a new token.
 */
app.delete('/revoke', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer rvui_dev_')) {
    return c.json({ success: false, error: 'Valid device token required' }, 401);
  }

  const token = authHeader.slice(7);
  const hash = hashToken(token);
  const db = getClient();

  await db
    .update(userDevices)
    .set({
      tokenHash: null,
      tokenExpiresAt: null,
      tokenIssuedAt: null,
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(userDevices.tokenHash, hash));

  return c.json({ success: true, message: 'Device token revoked' });
});

/**
 * GET /api/studio-auth/status
 *
 * Returns current auth status and subscription info for the authenticated device.
 * This is the primary endpoint Studio calls on launch to check if auth is still valid.
 */
app.get('/status', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer rvui_dev_')) {
    return c.json({ authenticated: false });
  }

  const token = authHeader.slice(7);
  const hash = hashToken(token);
  const db = getClient();
  const now = new Date();

  const [device] = await db
    .select({
      deviceId: userDevices.deviceId,
      deviceName: userDevices.deviceName,
      userId: userDevices.userId,
      tokenExpiresAt: userDevices.tokenExpiresAt,
      isActive: userDevices.isActive,
    })
    .from(userDevices)
    .where(and(eq(userDevices.tokenHash, hash), eq(userDevices.isActive, true)))
    .limit(1);

  if (!device || (device.tokenExpiresAt && device.tokenExpiresAt < now)) {
    return c.json({ authenticated: false });
  }

  const [user] = await db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role })
    .from(users)
    .where(eq(users.id, device.userId))
    .limit(1);

  if (!user) {
    return c.json({ authenticated: false });
  }

  return c.json({
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    device: {
      id: device.deviceId,
      name: device.deviceName,
    },
    tokenExpiresAt: device.tokenExpiresAt?.toISOString() ?? null,
  });
});

export default app;
