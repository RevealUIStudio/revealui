/**
 * GAP-256 PR-4 — public admission waitlist status + claim.
 *
 * Paths (mounted under /api/admission and /api/v1/admission):
 *   GET  /waitlist/status?token=
 *   POST /waitlist/claim  { token, password, name }
 *
 * Distinct from marketing POST /api/waitlist (email capture).
 */

import {
  admitFreeIntake,
  ensureFreeSignupEntitlement,
  estimateAdmissionWaitlistPosition,
  getAdmissionWaitlistByToken,
  getAdmissionWaitlistByTokenAnyStatus,
  isSignupAllowed,
  markAdmissionWaitlistConverted,
  maskAdmissionEmail,
  signUp,
} from '@revealui/auth/server';
import { logger } from '@revealui/core/observability/logger';
import { zValidator } from '@revealui/openapi';
import { Hono } from 'hono';
import { z } from 'zod';

const app = new Hono();

/** Generic anti-enumeration payload for unknown / expired tokens. */
const GENERIC_STATUS = {
  status: 'unknown' as const,
  positionEstimate: null as number | null,
  emailMasked: null as string | null,
};

const ClaimBodySchema = z.object({
  token: z.string().min(1).max(256),
  // Lockstep with SignUpRequestSchema (GAP-244): min 12
  password: z.string().min(12).max(128),
  name: z.string().min(1).max(100),
});

/**
 * GET /waitlist/status?token=
 * Valid token → real status; bad/expired → same generic shape (no 404 body variance).
 */
app.get('/waitlist/status', async (c) => {
  const token = c.req.query('token')?.trim() ?? '';
  if (!token) {
    return c.json(GENERIC_STATUS, 404);
  }

  try {
    const active = await getAdmissionWaitlistByToken(token);
    if (active) {
      const positionEstimate =
        active.position ?? (await estimateAdmissionWaitlistPosition(active.id));
      return c.json({
        status: active.status,
        positionEstimate,
        emailMasked: maskAdmissionEmail(active.email),
      });
    }

    const prior = await getAdmissionWaitlistByTokenAnyStatus(token);
    if (prior?.status === 'converted') {
      return c.json({
        status: 'converted' as const,
        positionEstimate: null,
        emailMasked: maskAdmissionEmail(prior.email),
      });
    }
    if (prior?.status === 'expired' || prior?.status === 'cancelled') {
      return c.json({
        status: prior.status,
        positionEstimate: null,
        emailMasked: null,
      });
    }
  } catch (err) {
    logger.warn('[admission-waitlist] status lookup failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return c.json(GENERIC_STATUS, 404);
});

/**
 * POST /waitlist/claim
 * Admit free (waitlist_claim_free never re-waitlists), signUp, free entitlement, mark converted.
 */
app.post('/waitlist/claim', zValidator('json', ClaimBodySchema), async (c) => {
  const { token, password, name } = c.req.valid('json');

  let row: Awaited<ReturnType<typeof getAdmissionWaitlistByToken>>;
  try {
    row = await getAdmissionWaitlistByToken(token);
  } catch (err) {
    logger.error(
      '[admission-waitlist] claim token lookup failed',
      err instanceof Error ? err : undefined,
    );
    return c.json({ success: false, error: 'Unable to process claim', code: 'CLAIM_FAILED' }, 500);
  }

  if (!row) {
    const prior = await getAdmissionWaitlistByTokenAnyStatus(token).catch(() => null);
    if (prior?.status === 'converted') {
      return c.json(
        {
          success: false,
          error: 'Already converted. Sign in with your existing account.',
          code: 'ALREADY_CONVERTED',
        },
        409,
      );
    }
    return c.json(
      { success: false, error: 'Invalid or expired waitlist token', code: 'INVALID_TOKEN' },
      404,
    );
  }

  if (!isSignupAllowed(row.email)) {
    return c.json(
      { success: false, error: 'Signups are currently restricted', code: 'SIGNUP_RESTRICTED' },
      403,
    );
  }

  const admit = await admitFreeIntake({
    channel: 'waitlist_claim_free',
    email: row.email,
    payingIntent: { kind: 'none' },
  });

  if (admit.decision !== 'admit') {
    logger.warn('[admission-waitlist] claim did not admit', {
      reason: admit.reason,
      decision: admit.decision,
    });
    return c.json(
      {
        success: false,
        error: 'Unable to claim waitlist entry right now',
        code: 'CLAIM_NOT_ADMITTED',
      },
      503,
    );
  }

  const result = await signUp(row.email, password, name, {
    userAgent: c.req.header('user-agent'),
    ipAddress: c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip'),
  });

  if (!result.success) {
    // Email already registered after concurrent claim / paid path
    if (
      result.error?.toLowerCase().includes('already') ||
      result.error?.toLowerCase().includes('exist')
    ) {
      return c.json(
        {
          success: false,
          error: 'Already converted. Sign in with your existing account.',
          code: 'ALREADY_CONVERTED',
        },
        409,
      );
    }
    logger.warn('[admission-waitlist] claim signUp failed', { error: result.error });
    return c.json(
      { success: false, error: result.error ?? 'Sign up failed', code: 'SIGNUP_FAILED' },
      400,
    );
  }

  if (result.user?.id) {
    try {
      await ensureFreeSignupEntitlement({
        userId: result.user.id,
        cohortLimits: admit.cohortLimits,
        displayName: name,
      });
    } catch (err) {
      logger.error(
        '[admission-waitlist] free entitlement@t0 failed (non-fatal)',
        err instanceof Error ? err : undefined,
        { userId: result.user.id },
      );
    }
  }

  try {
    await markAdmissionWaitlistConverted(row.id);
  } catch (err) {
    logger.error(
      '[admission-waitlist] mark converted failed (user already created)',
      err instanceof Error ? err : undefined,
      { waitlistId: row.id, userId: result.user?.id },
    );
  }

  logger.info('[admission-waitlist] claim converted', {
    waitlistId: row.id,
    userId: result.user?.id,
    admitReason: admit.reason,
  });

  return c.json(
    {
      success: true,
      user: { id: result.user?.id, email: result.user?.email },
      sessionToken: result.sessionToken,
    },
    201,
  );
});

export default app;
