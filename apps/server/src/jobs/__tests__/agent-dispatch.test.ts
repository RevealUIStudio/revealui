/**
 * GAP-360 §5.6 / §6.1 — the durable worker gates per-account and derives the
 * dispatch identity from the task's OWNING ACCOUNT row (ticket.reporterId),
 * never from the job payload. A poisoned `data.userId` must be ignored.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetTicketById,
  mockUpdateTicket,
  mockBuildDispatcher,
  mockAccountHasAiFeature,
  mockDetectDeploymentMode,
  mockIsFeatureEnabled,
  mockDispatch,
} = vi.hoisted(() => ({
  mockGetTicketById: vi.fn(),
  mockUpdateTicket: vi.fn(),
  mockBuildDispatcher: vi.fn(),
  mockAccountHasAiFeature: vi.fn(),
  mockDetectDeploymentMode: vi.fn(),
  mockIsFeatureEnabled: vi.fn(() => true),
  mockDispatch: vi.fn(),
}));

vi.mock('@revealui/core/features', () => ({ isFeatureEnabled: mockIsFeatureEnabled }));
vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('@revealui/db/client', () => ({ getClient: () => ({}) }));
vi.mock('@revealui/db/queries/tickets', () => ({
  getTicketById: mockGetTicketById,
  updateTicket: mockUpdateTicket,
}));
vi.mock('@revealui/db/saga', () => ({
  idempotentWrite: async (
    _db: unknown,
    _key: string,
    _name: string,
    fn: () => Promise<unknown>,
  ) => ({ result: await fn(), alreadyProcessed: false }),
}));
vi.mock('@revealui/db/schema/agents', () => ({ agentMemories: {} }));
vi.mock('@revealui/db/validation/cross-db', () => ({ safeVectorInsert: vi.fn() }));
vi.mock('../../lib/account-entitlement.js', () => ({
  accountHasAiFeature: mockAccountHasAiFeature,
}));
vi.mock('../../lib/agent-dispatcher.js', () => ({ buildDispatcher: mockBuildDispatcher }));
vi.mock('../../lib/validate-startup.js', () => ({
  detectDeploymentMode: mockDetectDeploymentMode,
}));

import { agentDispatchHandler } from '../agent-dispatch.js';

const OWNER = 'real-owner-from-row';
const POISONED = 'attacker-supplied-in-payload';

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.HOSTED_BYOK_DISPATCH;
  mockGetTicketById.mockResolvedValue({
    id: 't-1',
    title: 'Do a thing',
    description: null,
    type: 'task',
    priority: 'medium',
    status: 'in_progress',
    reporterId: OWNER,
  });
  mockDispatch.mockResolvedValue({ success: true, output: 'ok', metadata: {} });
  mockBuildDispatcher.mockResolvedValue({ dispatch: mockDispatch });
  mockAccountHasAiFeature.mockResolvedValue(true);
});

const job = { id: 'job-1', retryCount: 0 } as never;

describe('agentDispatchHandler — §6.1 identity from the task row', () => {
  it('on hosted, derives userId from ticket.reporterId and ignores the payload userId', async () => {
    mockDetectDeploymentMode.mockReturnValue('hosted');

    await agentDispatchHandler({ ticketId: 't-1', userId: POISONED, tenantId: 'site-1' }, job);

    // Per-account gate keyed on the row owner, not the payload.
    expect(mockAccountHasAiFeature).toHaveBeenCalledWith(expect.anything(), OWNER);
    expect(mockAccountHasAiFeature).not.toHaveBeenCalledWith(expect.anything(), POISONED);

    // Resolver identity is the row owner, not the payload.
    expect(mockBuildDispatcher).toHaveBeenCalledWith(
      expect.anything(),
      'site-1',
      expect.objectContaining({ userId: OWNER, isHosted: true }),
    );
    const resolution = mockBuildDispatcher.mock.calls[0]?.[2] as { userId?: string };
    expect(resolution.userId).not.toBe(POISONED);
  });

  it('on hosted, fails closed when the owning account lacks the ai feature', async () => {
    mockDetectDeploymentMode.mockReturnValue('hosted');
    mockAccountHasAiFeature.mockResolvedValue(false);

    await expect(
      agentDispatchHandler({ ticketId: 't-1', userId: POISONED, tenantId: 'site-1' }, job),
    ).rejects.toThrow('not entitled');
    expect(mockBuildDispatcher).not.toHaveBeenCalled();
  });

  it('on self-hosted, keeps the singleton license check (byte-unchanged)', async () => {
    mockDetectDeploymentMode.mockReturnValue('forge');
    mockIsFeatureEnabled.mockReturnValue(true);

    await agentDispatchHandler({ ticketId: 't-1', userId: POISONED, tenantId: 'site-1' }, job);

    expect(mockIsFeatureEnabled).toHaveBeenCalledWith('ai');
    // The per-account gate is not consulted on self-hosted.
    expect(mockAccountHasAiFeature).not.toHaveBeenCalled();
  });
});
