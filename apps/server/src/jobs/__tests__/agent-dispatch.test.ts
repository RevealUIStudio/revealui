/**
 * GAP-360 §5.6 / §6.1 — the durable worker gates per-account and derives the
 * dispatch identity from the AUTHENTICATED DISPATCHER captured server-side at
 * enqueue time (`AgentDispatchPayload.userId`), never from `ticket.reporterId`.
 *
 * `reporterId` is client-writable via the general tickets API
 * (`routes/tickets/tickets.ts` create/PATCH schemas accept an arbitrary
 * `reporterId` string with no ownership check — `assertBoardAccess` only
 * checks board/tenant ownership). An attacker who owns a board could set
 * `reporterId` to a victim's user id, dispatch the ticket, and have the
 * worker decrypt the VICTIM's BYOK key for the attacker's prompt — unless the
 * worker ignores the row entirely and uses the trusted enqueue-time identity.
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

/** The authenticated user who called the dispatch endpoint (trusted, from the payload). */
const DISPATCHER = 'authenticated-dispatcher-from-enqueue';
/**
 * A foreign/victim user id planted in `ticket.reporterId` — simulating an
 * attacker who owns the board POSTing/PATCHing the general tickets API with
 * `reporterId` set to someone else's id before dispatching.
 */
const FOREIGN_REPORTER = 'victim-user-planted-via-tickets-api';

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
    reporterId: FOREIGN_REPORTER,
  });
  mockDispatch.mockResolvedValue({ success: true, output: 'ok', metadata: {} });
  mockBuildDispatcher.mockResolvedValue({ dispatch: mockDispatch });
  mockAccountHasAiFeature.mockResolvedValue(true);
});

const job = { id: 'job-1', retryCount: 0 } as never;

describe('agentDispatchHandler — §6.1 identity is the enqueue-time dispatcher, never the ticket row', () => {
  it('on hosted, derives userId from the payload (the authenticated dispatcher), never from ticket.reporterId', async () => {
    mockDetectDeploymentMode.mockReturnValue('hosted');

    await agentDispatchHandler({ ticketId: 't-1', userId: DISPATCHER, tenantId: 'site-1' }, job);

    // Per-account gate keyed on the trusted dispatcher, not the row.
    expect(mockAccountHasAiFeature).toHaveBeenCalledWith(expect.anything(), DISPATCHER);
    expect(mockAccountHasAiFeature).not.toHaveBeenCalledWith(expect.anything(), FOREIGN_REPORTER);

    // Resolver identity is the dispatcher, not the row.
    expect(mockBuildDispatcher).toHaveBeenCalledWith(
      expect.anything(),
      'site-1',
      expect.objectContaining({ userId: DISPATCHER, isHosted: true }),
    );
    const resolution = mockBuildDispatcher.mock.calls[0]?.[2] as { userId?: string };
    expect(resolution.userId).not.toBe(FOREIGN_REPORTER);
  });

  // Regression test: the reporterId-poisoning attack the coordinator flagged.
  // Even when the ticket row's reporterId names a foreign (victim) user —
  // exactly what an attacker can produce via the general tickets API — the
  // worker must resolve keys against the dispatcher's own account, never the
  // victim's.
  it('does not decrypt a foreign reporterId user key when the ticket row is poisoned', async () => {
    mockDetectDeploymentMode.mockReturnValue('hosted');
    // ticket.reporterId (set in beforeEach) is the victim; the payload carries
    // the real, authenticated dispatcher.
    await agentDispatchHandler({ ticketId: 't-1', userId: DISPATCHER, tenantId: 'site-1' }, job);

    const entitlementCalls = mockAccountHasAiFeature.mock.calls.map((call) => call[1]);
    const dispatcherCalls = mockBuildDispatcher.mock.calls.map(
      (call) => (call[2] as { userId?: string }).userId,
    );

    expect(entitlementCalls).not.toContain(FOREIGN_REPORTER);
    expect(dispatcherCalls).not.toContain(FOREIGN_REPORTER);
    expect(entitlementCalls).toContain(DISPATCHER);
    expect(dispatcherCalls).toContain(DISPATCHER);
  });

  it('on hosted, fails closed when the dispatching account lacks the ai feature', async () => {
    mockDetectDeploymentMode.mockReturnValue('hosted');
    mockAccountHasAiFeature.mockResolvedValue(false);

    await expect(
      agentDispatchHandler({ ticketId: 't-1', userId: DISPATCHER, tenantId: 'site-1' }, job),
    ).rejects.toThrow('not entitled');
    expect(mockBuildDispatcher).not.toHaveBeenCalled();
  });

  it('on self-hosted, keeps the singleton license check (byte-unchanged)', async () => {
    mockDetectDeploymentMode.mockReturnValue('forge');
    mockIsFeatureEnabled.mockReturnValue(true);

    await agentDispatchHandler({ ticketId: 't-1', userId: DISPATCHER, tenantId: 'site-1' }, job);

    expect(mockIsFeatureEnabled).toHaveBeenCalledWith('ai');
    // The per-account gate is not consulted on self-hosted.
    expect(mockAccountHasAiFeature).not.toHaveBeenCalled();
  });
});
