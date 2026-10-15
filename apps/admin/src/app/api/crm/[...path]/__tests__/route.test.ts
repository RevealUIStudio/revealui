import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  gate: vi.fn(),
  recovery: vi.fn(),
  service: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  stage: vi.fn(),
  target: vi.fn(),
  operator: vi.fn(),
  superAdmin: vi.fn(),
  source: vi.fn(),
  sync: vi.fn(),
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
vi.mock('@revealui/db/queries/sites', () => ({ getSiteContentActor: mocks.operator }));
vi.mock('@revealui/utils/validation', () => ({ isPlatformSuperAdmin: mocks.superAdmin }));
vi.mock('@/lib/crm/booking-source', () => ({ readCrmBookingSource: mocks.source }));
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
  mocks.target.mockResolvedValue({ id: 'opportunity' });
  mocks.operator.mockResolvedValue({ id: 'session-user' });
  mocks.superAdmin.mockReturnValue(false);
  mocks.service.mockReturnValue({
    list: mocks.list,
    createOrganization: mocks.create,
    transition: mocks.stage,
    verifyBookingSyncTarget: mocks.target,
    syncSourceBooking: mocks.sync,
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
  it('does not release the Studio owner credential to ordinary account operators', async () => {
    const response = await POST(
      request('bookings/sync', 'POST', { opportunityId: 'opportunity', bookingId: 'booking' }),
      context('bookings', 'sync'),
    );
    expect(response.status).toBe(403);
    expect(mocks.target).toHaveBeenCalledWith('opportunity');
    expect(mocks.source).not.toHaveBeenCalled();
    expect(mocks.sync).not.toHaveBeenCalled();
  });
  it('fails closed before source IO on account denial and never treats provider failure as cancellation', async () => {
    mocks.target.mockRejectedValueOnce(new Error('Account unavailable'));
    expect(
      (
        await POST(
          request('bookings/sync', 'POST', { opportunityId: 'opportunity', bookingId: 'booking' }),
          context('bookings', 'sync'),
        )
      ).status,
    ).toBe(503);
    expect(mocks.source).not.toHaveBeenCalled();
    mocks.superAdmin.mockReturnValue(true);
    mocks.source.mockRejectedValueOnce(new Error('Provider unavailable'));
    expect(
      (
        await POST(
          request('bookings/sync', 'POST', { opportunityId: 'opportunity', bookingId: 'booking' }),
          context('bookings', 'sync'),
        )
      ).status,
    ).toBe(503);
    expect(mocks.sync).not.toHaveBeenCalled();
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
