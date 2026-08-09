/**
 * GAP-256 PR-4 — admission waitlist status + claim routes (mocked I/O).
 */
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAdmissionWaitlistByToken = vi.fn();
const getAdmissionWaitlistByTokenAnyStatus = vi.fn();
const estimateAdmissionWaitlistPosition = vi.fn();
const maskAdmissionEmail = vi.fn((e: string) => `m***@${e.split('@')[1] ?? 'x'}`);
const markAdmissionWaitlistConverted = vi.fn();
const admitFreeIntake = vi.fn();
const ensureFreeSignupEntitlement = vi.fn();
const isSignupAllowed = vi.fn(() => true);
const signUp = vi.fn();

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@revealui/auth/server', () => ({
  getAdmissionWaitlistByToken: (...a: unknown[]) => getAdmissionWaitlistByToken(...a),
  getAdmissionWaitlistByTokenAnyStatus: (...a: unknown[]) =>
    getAdmissionWaitlistByTokenAnyStatus(...a),
  estimateAdmissionWaitlistPosition: (...a: unknown[]) => estimateAdmissionWaitlistPosition(...a),
  maskAdmissionEmail: (e: string) => maskAdmissionEmail(e),
  markAdmissionWaitlistConverted: (...a: unknown[]) => markAdmissionWaitlistConverted(...a),
  admitFreeIntake: (...a: unknown[]) => admitFreeIntake(...a),
  ensureFreeSignupEntitlement: (...a: unknown[]) => ensureFreeSignupEntitlement(...a),
  isSignupAllowed: (...a: unknown[]) => isSignupAllowed(...a),
  signUp: (...a: unknown[]) => signUp(...a),
}));

import admissionRoute from '../admission/waitlist.js';

function createApp() {
  const app = new Hono();
  app.route('/admission', admissionRoute);
  return app;
}

describe('GET /admission/waitlist/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns generic 404 for unknown token', async () => {
    getAdmissionWaitlistByToken.mockResolvedValue(null);
    getAdmissionWaitlistByTokenAnyStatus.mockResolvedValue(null);

    const res = await createApp().request('/admission/waitlist/status?token=bad');
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.status).toBe('unknown');
    expect(json.positionEstimate).toBeNull();
  });

  it('returns pending status for valid token', async () => {
    getAdmissionWaitlistByToken.mockResolvedValue({
      id: 'w1',
      email: 'user@example.com',
      status: 'pending',
      position: 2,
    });

    const res = await createApp().request('/admission/waitlist/status?token=good');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('pending');
    expect(json.positionEstimate).toBe(2);
    expect(json.emailMasked).toBeTruthy();
  });
});

describe('POST /admission/waitlist/claim', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isSignupAllowed.mockReturnValue(true);
  });

  it('claims pending row: admit + signUp + convert', async () => {
    getAdmissionWaitlistByToken.mockResolvedValue({
      id: 'w1',
      email: 'claim@example.com',
      status: 'pending',
    });
    admitFreeIntake.mockResolvedValue({
      decision: 'admit',
      mode: 'open',
      cohortLimits: { maxSites: 1, maxUsers: 3, maxAgentTasks: 1000 },
      snapshotId: null,
      reason: 'waitlist_claim',
      shadow: false,
      flags: { enabled: true, shadow: false, staleHours: 36 },
    });
    signUp.mockResolvedValue({
      success: true,
      user: { id: 'u1', email: 'claim@example.com' },
      sessionToken: 'sess',
    });
    ensureFreeSignupEntitlement.mockResolvedValue({ accountId: 'a1' });
    markAdmissionWaitlistConverted.mockResolvedValue(undefined);

    const res = await createApp().request('/admission/waitlist/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: 'raw',
        password: 'SecurePass123',
        name: 'Claimer',
      }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.sessionToken).toBe('sess');
    expect(admitFreeIntake).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'waitlist_claim_free', email: 'claim@example.com' }),
    );
    expect(signUp).toHaveBeenCalled();
    expect(markAdmissionWaitlistConverted).toHaveBeenCalledWith('w1');
  });

  it('returns 409 when already converted', async () => {
    getAdmissionWaitlistByToken.mockResolvedValue(null);
    getAdmissionWaitlistByTokenAnyStatus.mockResolvedValue({
      id: 'w1',
      status: 'converted',
      email: 'x@example.com',
    });

    const res = await createApp().request('/admission/waitlist/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'old', password: 'SecurePass123', name: 'X' }),
    });

    expect(res.status).toBe(409);
    expect(signUp).not.toHaveBeenCalled();
  });
});
