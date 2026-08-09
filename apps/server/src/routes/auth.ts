/**
 * Auth Routes  -  Public Signup Endpoint
 *
 * POST /api/auth/signup  -  Register a new user account
 *
 * This route is rate-limited and enforces the tier-based user limit
 * (enforceUserLimit middleware is applied in index.ts).
 *
 * GAP-256 PR-3: margin admit **before** signUp (K13); free entitlement@t0 after
 * successful hosted signup (K15). Shadow defaults → never 202 waitlist here.
 */

import { isSignupAllowed, signUp } from '@revealui/auth/server';
import { SignUpRequestSchema } from '@revealui/contracts';
import { logger } from '@revealui/core/observability/logger';
import { zValidator } from '@revealui/openapi';
import { Hono } from 'hono';
import { admitFreeIntake } from '../lib/admit-free-intake.js';
import { ensureFreeSignupEntitlement } from '../lib/ensure-free-signup-entitlement.js';

const app = new Hono();

/**
 * POST /signup
 * Creates a new user account after validating input and checking the signup whitelist.
 */
app.post('/signup', zValidator('json', SignUpRequestSchema), async (c) => {
  const { email, password, name } = c.req.valid('json');

  // Check signup whitelist before attempting creation
  if (!isSignupAllowed(email)) {
    return c.json({ success: false, error: 'Signups are currently restricted' }, 403);
  }

  // GAP-256: admit **before** any users insert (K13). Shadow → always admit.
  const admit = await admitFreeIntake({
    channel: 'free_signup',
    email,
    payingIntent: { kind: 'none' },
  });

  if (admit.decision === 'waitlist') {
    // PR-4 enforce path — PR-3 shadow should not reach here with default flags.
    return c.json(
      {
        success: false,
        error: 'WAITLISTED',
        code: admit.code,
        message: 'Free signup is temporarily waitlisted. Paid signup remains available.',
      },
      202,
    );
  }

  const result = await signUp(email, password, name, {
    userAgent: c.req.header('user-agent'),
    ipAddress: c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip'),
  });

  if (!result.success) {
    logger.warn('Signup failed', { email, error: result.error });
    return c.json({ success: false, error: result.error }, 400);
  }

  // Free entitlement@t0 (K15) — best-effort; never fail the signup response
  if (result.user?.id) {
    try {
      await ensureFreeSignupEntitlement({
        userId: result.user.id,
        cohortLimits: admit.cohortLimits,
      });
    } catch (err) {
      logger.error(
        '[signup] free entitlement@t0 failed (non-fatal)',
        err instanceof Error ? err : undefined,
        { userId: result.user.id },
      );
    }
  }

  logger.info('New user registered via API', {
    userId: result.user?.id,
    admitMode: admit.mode,
    admitReason: admit.reason,
    shadow: admit.shadow,
  });
  return c.json({ success: true, user: { id: result.user?.id, email: result.user?.email } }, 201);
});

export default app;
