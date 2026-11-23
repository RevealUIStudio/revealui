/**
 * Agent-stream kill switch runs before task-quota admission.
 * A disabled call returns 503 and does not reserve a monthly slot.
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const admit = vi.fn();

vi.mock('@revealui/db', () => ({
  getClient: vi.fn(() => ({})),
}));

vi.mock('@revealui/db/agent-task-quota', () => ({
  admitAgentTask: (...args: unknown[]) => admit(...args),
}));

vi.mock('@revealui/core/license', () => ({
  getMaxAgentTasks: () => 1_000,
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../x402.js', () => ({
  getX402Config: () => ({ enabled: false, receivingAddress: '' }),
  buildPaymentRequired: () => ({ accepts: [] }),
  encodePaymentRequired: () => 'encoded',
  verifyPayment: async () => ({ valid: false }),
  getAdvertisedCurrencyLabel: () => 'usdc-only',
}));

import { rejectWhenAiDisabled } from '../ai-disabled.js';
import { requireTaskQuota } from '../task-quota.js';

function createApp() {
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('user', { id: 'user-1', email: null, name: 'User', role: 'admin' });
    await next();
  });
  app.post('/api/agent-stream', rejectWhenAiDisabled);
  app.post('/api/agent-stream', requireTaskQuota);
  app.post('/api/agent-stream', (c) => c.json({ ok: true }));
  return app;
}

describe('agent-stream kill switch before task quota', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.REVEALUI_AI_DISABLED;
  });

  it('does not consume quota when REVEALUI_AI_DISABLED blocks the call', async () => {
    process.env.REVEALUI_AI_DISABLED = 'true';
    const res = await createApp().request('/api/agent-stream', { method: 'POST' });
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.code).toBe('AI_DISABLED');
    expect(admit).not.toHaveBeenCalled();
    delete process.env.REVEALUI_AI_DISABLED;
  });

  it('admits a task when the kill switch is off', async () => {
    admit.mockResolvedValue({ admitted: true });
    const res = await createApp().request('/api/agent-stream', { method: 'POST' });
    expect(res.status).toBe(200);
    expect(admit).toHaveBeenCalledOnce();
  });
});
