import { HTTPException } from 'hono/http-exception';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@revealui/db/queries/boards', () => ({
  getBoardById: vi.fn(),
}));

vi.mock('@revealui/db/queries/tickets', () => ({
  getTicketById: vi.fn(),
}));

import * as boardQueries from '@revealui/db/queries/boards';
import * as ticketQueries from '@revealui/db/queries/tickets';
import { assertBoardAccess, assertBoardTenantAccess, assertTicketAccess } from '../access.js';

const mb = vi.mocked(boardQueries);
const mt = vi.mocked(ticketQueries);

// ─── assertTicketAccess ───────────────────────────────────────────────────────

describe('assertTicketAccess', () => {
  const mockDb = {} as Parameters<typeof assertTicketAccess>[0];

  function makeCtx(user?: { id: string; role: string }, tenant?: { id: string }) {
    return {
      get(key: string) {
        if (key === 'user') return user;
        if (key === 'tenant') return tenant;
        return undefined;
      },
    };
  }

  it('throws 404 when ticket does not exist', async () => {
    mt.getTicketById.mockResolvedValue(null);
    await expect(assertTicketAccess(mockDb, 'ticket-999', makeCtx())).rejects.toThrow(
      HTTPException,
    );
    try {
      await assertTicketAccess(mockDb, 'ticket-999', makeCtx());
    } catch (e) {
      expect((e as HTTPException).status).toBe(404);
    }
  });

  it('throws 403 when user has no access to the parent board', async () => {
    mt.getTicketById.mockResolvedValue({
      id: 'ticket-1',
      boardId: 'board-1',
    } as unknown as Awaited<ReturnType<typeof ticketQueries.getTicketById>>);
    mb.getBoardById.mockResolvedValue({
      id: 'board-1',
      tenantId: null,
      ownerId: 'owner-1',
    } as unknown as Awaited<ReturnType<typeof boardQueries.getBoardById>>);

    await expect(
      assertTicketAccess(mockDb, 'ticket-1', makeCtx({ id: 'other-user', role: 'member' })),
    ).rejects.toThrow(HTTPException);
  });

  it('returns ticket when user is board owner', async () => {
    mt.getTicketById.mockResolvedValue({
      id: 'ticket-1',
      boardId: 'board-1',
    } as unknown as Awaited<ReturnType<typeof ticketQueries.getTicketById>>);
    mb.getBoardById.mockResolvedValue({
      id: 'board-1',
      tenantId: null,
      ownerId: 'user-1',
    } as unknown as Awaited<ReturnType<typeof boardQueries.getBoardById>>);

    const result = await assertTicketAccess(
      mockDb,
      'ticket-1',
      makeCtx({ id: 'user-1', role: 'member' }),
    );
    expect(result).toMatchObject({ id: 'ticket-1', boardId: 'board-1' });
  });

  it('returns ticket when user is admin', async () => {
    mt.getTicketById.mockResolvedValue({
      id: 'ticket-2',
      boardId: 'board-2',
    } as unknown as Awaited<ReturnType<typeof ticketQueries.getTicketById>>);
    mb.getBoardById.mockResolvedValue({
      id: 'board-2',
      tenantId: null,
      ownerId: 'some-owner',
    } as unknown as Awaited<ReturnType<typeof boardQueries.getBoardById>>);

    const result = await assertTicketAccess(
      mockDb,
      'ticket-2',
      makeCtx({ id: 'admin-user', role: 'admin' }),
    );
    expect(result).toMatchObject({ id: 'ticket-2' });
  });
});

// ─── assertBoardTenantAccess ──────────────────────────────────────────────────

describe('assertBoardTenantAccess', () => {
  it('does not throw when no tenant context is present', () => {
    expect(() => assertBoardTenantAccess({ tenantId: 'tenant-A' }, undefined)).not.toThrow();
  });

  it('does not throw when board has no tenantId', () => {
    expect(() => assertBoardTenantAccess({ tenantId: null }, { id: 'tenant-A' })).not.toThrow();
  });

  it('does not throw when tenant matches board tenantId', () => {
    expect(() =>
      assertBoardTenantAccess({ tenantId: 'tenant-A' }, { id: 'tenant-A' }),
    ).not.toThrow();
  });

  it('throws 403 when tenant context does not match board tenantId', () => {
    expect(() => assertBoardTenantAccess({ tenantId: 'tenant-A' }, { id: 'tenant-B' })).toThrow(
      HTTPException,
    );
    try {
      assertBoardTenantAccess({ tenantId: 'tenant-A' }, { id: 'tenant-B' });
    } catch (e) {
      expect((e as HTTPException).status).toBe(403);
    }
  });

  it('does not throw when board tenantId is undefined (treated as null)', () => {
    expect(() => assertBoardTenantAccess({}, { id: 'tenant-A' })).not.toThrow();
  });
});

// ─── assertBoardAccess ────────────────────────────────────────────────────────

describe('assertBoardAccess', () => {
  const mockDb = {} as Parameters<typeof assertBoardAccess>[0];

  function makeCtx(user?: { id: string; role: string }, tenant?: { id: string }) {
    return {
      get(key: string) {
        if (key === 'user') return user;
        if (key === 'tenant') return tenant;
        return undefined;
      },
    };
  }

  it('throws 404 when board does not exist', async () => {
    mb.getBoardById.mockResolvedValue(null);
    await expect(assertBoardAccess(mockDb, 'board-999', makeCtx())).rejects.toThrow(HTTPException);
    try {
      await assertBoardAccess(mockDb, 'board-999', makeCtx());
    } catch (e) {
      expect((e as HTTPException).status).toBe(404);
    }
  });

  it('throws 403 when tenant mismatch', async () => {
    mb.getBoardById.mockResolvedValue({
      id: 'board-1',
      tenantId: 'tenant-A',
      ownerId: null,
    } as unknown as Awaited<ReturnType<typeof boardQueries.getBoardById>>);

    await expect(
      assertBoardAccess(
        mockDb,
        'board-1',
        makeCtx({ id: 'user-1', role: 'member' }, { id: 'tenant-B' }),
      ),
    ).rejects.toThrow(HTTPException);
  });

  it('throws 403 when user is not owner and not admin', async () => {
    mb.getBoardById.mockResolvedValue({
      id: 'board-1',
      tenantId: null,
      ownerId: 'owner-1',
    } as unknown as Awaited<ReturnType<typeof boardQueries.getBoardById>>);

    await expect(
      assertBoardAccess(mockDb, 'board-1', makeCtx({ id: 'user-2', role: 'member' })),
    ).rejects.toThrow(HTTPException);
  });

  it('allows access when user is admin regardless of ownership', async () => {
    mb.getBoardById.mockResolvedValue({
      id: 'board-1',
      tenantId: null,
      ownerId: 'owner-1',
    } as unknown as Awaited<ReturnType<typeof boardQueries.getBoardById>>);

    await expect(
      assertBoardAccess(mockDb, 'board-1', makeCtx({ id: 'admin-user', role: 'admin' })),
    ).resolves.toBeUndefined();
  });

  it('allows access when user is the board owner', async () => {
    mb.getBoardById.mockResolvedValue({
      id: 'board-1',
      tenantId: null,
      ownerId: 'user-1',
    } as unknown as Awaited<ReturnType<typeof boardQueries.getBoardById>>);

    await expect(
      assertBoardAccess(mockDb, 'board-1', makeCtx({ id: 'user-1', role: 'member' })),
    ).resolves.toBeUndefined();
  });

  it('allows access when board has no owner (public board)', async () => {
    mb.getBoardById.mockResolvedValue({
      id: 'board-1',
      tenantId: null,
      ownerId: null,
    } as unknown as Awaited<ReturnType<typeof boardQueries.getBoardById>>);

    await expect(
      assertBoardAccess(mockDb, 'board-1', makeCtx({ id: 'any-user', role: 'member' })),
    ).resolves.toBeUndefined();
  });
});
