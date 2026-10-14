import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  gate: vi.fn(),
  recovery: vi.fn(),
  service: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  stage: vi.fn(),
}));
vi.mock('@/lib/auth/require-mfa', () => ({ requireSessionWithMfa: mocks.gate }));
vi.mock('@/lib/utils/recovery-guard', () => ({ rejectRecoverySession: mocks.recovery }));
vi.mock('@revealui/db/client', () => ({ getRestClient: () => ({}) }));
vi.mock('@revealui/db/crm-service', () => ({
  createCrmService: mocks.service,
  CrmError: class extends Error {
    status = 403;
  },
}));
vi.mock('@revealui/utils/logger', () => ({ logger: { error: vi.fn() } }));

import { GET, POST } from '../route';

function request(path: string, method = 'GET', body?: unknown, extra: Record<string, string> = {}) {
  return new NextRequest(`https://admin.example/api/crm/${path}`, {
    method,
    headers: { 'X-Account-ID': 'account', origin: 'https://admin.example', ...extra },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
const context = (...path: string[]) => ({ params: Promise.resolve({ path }) });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.gate.mockResolvedValue({ ok: true, session: { user: { id: 'session-user' } } });
  mocks.recovery.mockReturnValue(null);
  mocks.list.mockResolvedValue([]);
  mocks.create.mockResolvedValue({ id: 'record' });
  mocks.stage.mockResolvedValue({ stage: 'qualified' });
  mocks.service.mockReturnValue({
    list: mocks.list,
    createOrganization: mocks.create,
    transition: mocks.stage,
  });
});
describe('CRM session boundary', () => {
  it('requires a session before constructing CRM services', async () => {
    mocks.gate.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });
    expect((await GET(request('contacts'), context('contacts'))).status).toBe(401);
    expect(mocks.service).not.toHaveBeenCalled();
  });
  it('rejects recovery and forced-rotation sessions', async () => {
    mocks.recovery.mockReturnValue(NextResponse.json({ error: 'Recovery' }, { status: 403 }));
    expect((await GET(request('contacts'), context('contacts'))).status).toBe(403);
    mocks.recovery.mockReturnValue(null);
    mocks.gate.mockResolvedValue({
      ok: true,
      session: { user: { id: 'session-user', mustRotatePassword: true } },
    });
    expect((await GET(request('contacts'), context('contacts'))).status).toBe(403);
  });
  it('uses only server session identity; account claims are passed for service reauthorization', async () => {
    const response = await GET(request('contacts'), context('contacts'));
    expect(response.status).toBe(200);
    expect(mocks.service).toHaveBeenCalledWith(
      {},
      { userId: 'session-user', accountId: 'account' },
    );
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });
  it('rejects cross-origin and missing-origin mutations', async () => {
    expect(
      (
        await POST(
          request('organizations', 'POST', {}, { origin: 'https://attacker.example' }),
          context('organizations'),
        )
      ).status,
    ).toBe(403);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it('routes only explicitly supported actions, never a send operation', async () => {
    expect(
      (await POST(request('campaigns/id/send', 'POST', {}), context('campaigns', 'id', 'send')))
        .status,
    ).toBe(404);
    expect(
      (
        await POST(
          request('opportunities/id/stage', 'POST', { stage: 'qualified', version: 1 }),
          context('opportunities', 'id', 'stage'),
        )
      ).status,
    ).toBe(200);
    expect(mocks.stage).toHaveBeenCalledWith('id', { stage: 'qualified', version: 1 });
  });
});
