/**
 * GAP-256 PR-4 HC2 — enforce waitlist → 202 WAITLISTED, no signUp, never margin 403.
 */
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const admitFreeIntake = vi.fn();
const signUp = vi.fn();
const isSignupAllowed = vi.fn(() => true);
const ensureFreeSignupEntitlement = vi.fn();

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@revealui/auth/server', () => ({
  isSignupAllowed: (...args: unknown[]) => isSignupAllowed(...args),
  signUp: (...args: unknown[]) => signUp(...args),
}));

vi.mock('../../lib/admit-free-intake.js', () => ({
  admitFreeIntake: (...args: unknown[]) => admitFreeIntake(...args),
}));

vi.mock('../../lib/ensure-free-signup-entitlement.js', () => ({
  ensureFreeSignupEntitlement: (...args: unknown[]) => ensureFreeSignupEntitlement(...args),
}));

import authRoute from '../auth.js';

function createApp() {
  const app = new Hono();
  app.route('/auth', authRoute);
  return app;
}

async function postSignup(body: unknown) {
  return createApp().request('/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const validBody = {
  email: 'new@example.com',
  password: 'SecurePass123',
  name: 'New User',
  tosAccepted: true as const,
};

describe('POST /auth/signup waitlist (HC2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isSignupAllowed.mockReturnValue(true);
  });

  it('returns 202 WAITLISTED with token and does not call signUp', async () => {
    admitFreeIntake.mockResolvedValue({
      decision: 'waitlist',
      mode: 'waitlist',
      reason: 'snapshot_waitlist',
      snapshotId: 'snap-1',
      shadow: false,
      httpStatus: 202,
      code: 'WAITLISTED',
      flags: { enabled: true, shadow: false, staleHours: 36 },
      waitlistToken: 'raw-token-hex',
      positionEstimate: 3,
    });

    const res = await postSignup(validBody);

    expect(res.status).toBe(202);
    const json = await res.json();
    expect(json).toMatchObject({
      success: false,
      error: 'WAITLISTED',
      code: 'WAITLISTED',
      waitlistToken: 'raw-token-hex',
      positionEstimate: 3,
    });
    expect(json.message).toContain('waitlisted');
    expect(signUp).not.toHaveBeenCalled();
    expect(ensureFreeSignupEntitlement).not.toHaveBeenCalled();
  });

  it('is never margin 403 under waitlist', async () => {
    admitFreeIntake.mockResolvedValue({
      decision: 'waitlist',
      mode: 'waitlist',
      reason: 'snapshot_waitlist',
      snapshotId: null,
      shadow: false,
      httpStatus: 202,
      code: 'WAITLISTED',
      flags: { enabled: true, shadow: false, staleHours: 36 },
      waitlistToken: 't',
      positionEstimate: null,
    });

    const res = await postSignup({
      ...validBody,
      email: 'x@example.com',
    });

    expect(res.status).not.toBe(403);
    expect(res.status).toBe(202);
  });
});
