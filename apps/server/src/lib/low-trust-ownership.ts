/**
 * Load a ticket and confirm the board tenant (or single-tenant run account)
 * before a low-trust tool may use that id.
 */

import type { Database } from '@revealui/db/client';
import * as boardQueries from '@revealui/db/queries/boards';
import * as ticketQueries from '@revealui/db/queries/tickets';
import type { ReviewScope } from '@revealui/security';
import type { LowTrustOwnershipLoader } from './low-trust-scope.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function boardOwnershipAccount(
  board: { tenantId?: string | null; settings?: unknown },
  fallbackAccountId: string,
): string | null {
  if (typeof board.tenantId === 'string' && board.tenantId.length > 0) {
    return board.tenantId;
  }
  if (isRecord(board.settings)) {
    const accountId = board.settings.accountId;
    if (typeof accountId === 'string' && accountId.length > 0 && accountId === accountId.trim()) {
      return accountId;
    }
  }
  if (fallbackAccountId.length > 0) return fallbackAccountId;
  return null;
}

export function createTicketOwnershipLoader(
  db: Database,
  fallbackAccountId: string,
): LowTrustOwnershipLoader {
  return {
    async load(kind: ReviewScope['kind'], id: string) {
      if (kind !== 'ticket') return null;
      const ticket = await ticketQueries.getTicketById(db, id);
      if (!ticket) return null;
      const board = await boardQueries.getBoardById(db, ticket.boardId);
      if (!board) return null;
      const accountId = boardOwnershipAccount(board, fallbackAccountId);
      if (!accountId) return null;
      return { accountId };
    },
  };
}
