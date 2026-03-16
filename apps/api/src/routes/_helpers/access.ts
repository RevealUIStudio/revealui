import type { DatabaseClient } from '@revealui/db/client';
import * as boardQueries from '@revealui/db/queries/boards';
import * as ticketQueries from '@revealui/db/queries/tickets';
import { HTTPException } from 'hono/http-exception';

export type Variables = {
  db: DatabaseClient;
  tenant?: { id: string };
  user?: { id: string; role: string };
};

/**
 * Enforce tenant isolation on a board: if a tenant context is present in the
 * request and the board belongs to a *different* tenant, reject with 403.
 * Single-tenant deployments (no X-Tenant-ID header) are not affected.
 */
export function assertBoardTenantAccess(
  board: { tenantId?: string | null },
  tenant: { id: string } | undefined,
): void {
  if (tenant && board.tenantId && board.tenantId !== tenant.id) {
    throw new HTTPException(403, { message: 'Access denied for this tenant' });
  }
}

/**
 * Verify the user has access to a board: tenant isolation + ownership check.
 * Throws 404 if board not found, 403 if access denied.
 */
export async function assertBoardAccess(
  db: DatabaseClient,
  boardId: string,
  c: { get: (key: string) => unknown },
): Promise<void> {
  const board = await boardQueries.getBoardById(db, boardId);
  if (!board) throw new HTTPException(404, { message: 'Board not found' });
  assertBoardTenantAccess(board, c.get('tenant') as { id: string } | undefined);
  const user = c.get('user') as { id: string; role: string } | undefined;
  if (board.ownerId && board.ownerId !== user?.id && user?.role !== 'admin') {
    throw new HTTPException(403, { message: 'Forbidden' });
  }
}

/**
 * Verify the user has access to a ticket's parent board.
 * Returns the ticket or throws 404/403.
 */
export async function assertTicketAccess(
  db: DatabaseClient,
  ticketId: string,
  c: { get: (key: string) => unknown },
): Promise<NonNullable<Awaited<ReturnType<typeof ticketQueries.getTicketById>>>> {
  const ticket = await ticketQueries.getTicketById(db, ticketId);
  if (!ticket) throw new HTTPException(404, { message: 'Ticket not found' });
  await assertBoardAccess(db, ticket.boardId, c);
  return ticket;
}
