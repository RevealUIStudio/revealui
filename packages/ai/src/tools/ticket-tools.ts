/**
 * Ticket Mutation Tools
 *
 * Tools that allow an agent to update ticket state as it works  -
 * closing a ticket when done, moving it between columns, and writing
 * its results back as a comment.
 *
 * These are injected by createTicketTools() and are always paired with
 * admin tools so agents can act on content AND report back through the ticket.
 *
 * Retry-safe ids (CR8-P2-01 phase C prerequisite): when a `dispatchId`
 * is provided, comment ids are derived deterministically from
 * (dispatchId, call-ordinal). A crash-and-resume of the same dispatch
 * re-issues tool calls in the same order and generates the same ids,
 * letting the persistence layer's primary-key constraint dedupe
 * naturally. When `dispatchId` is omitted, ids remain random (the
 * caller's `TicketMutationClient` picks its own id).
 */

import { createHash } from 'node:crypto';
import { z } from 'zod/v4';
import type { Tool, ToolResult } from './base.js';

/**
 * Minimal interface for ticket mutations an agent can perform.
 * Matches the subset of ticketQueries used in the tickets route.
 */
export interface TicketMutationClient {
  updateTicket(
    ticketId: string,
    data: {
      status?: string;
      columnId?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<{ id: string; status: string } | null>;

  /**
   * Create a comment on a ticket. When `options.id` is provided the
   * implementation MUST use that id (enables deterministic replay under
   * retry); when omitted the implementation picks its own id (typically
   * a random UUID for backward compatibility).
   */
  createComment(
    ticketId: string,
    body: Record<string, unknown>,
    options?: { id?: string },
  ): Promise<{ id: string; ticketId: string } | null | undefined>;
}

export interface CreateTicketToolsOptions {
  /**
   * When set, tool calls that write rows (e.g. add_ticket_comment) use
   * this as the seed for deterministic id derivation. Pair with the
   * durable work queue's jobId so crash-resume produces the same ids
   * and the DB's PK constraint dedupes duplicate attempts.
   *
   * When omitted, ids remain random (existing behavior).
   */
  dispatchId?: string;
}

/**
 * Derive a deterministic, URL-safe comment id from (dispatchId,
 * callOrdinal). Exported so the handler side can assert that the same
 * inputs produce the same id (e.g. during crash-sim tests).
 */
export function deriveCommentId(dispatchId: string, callOrdinal: number): string {
  const hash = createHash('sha256').update(`${dispatchId}:comment:${callOrdinal}`).digest('hex');
  // 32 hex chars (~128 bits) is plenty for a PK and keeps the column
  // narrower than a full hex digest.
  return `cmt_${hash.slice(0, 32)}`;
}

export function createTicketTools(
  ticketId: string,
  client: TicketMutationClient,
  options: CreateTicketToolsOptions = {},
): Tool[] {
  // Per-instance call counter. Because createTicketTools() is invoked
  // fresh inside each dispatcher.dispatch() call, the ordinal is
  // stable across the agentic loop of a single dispatch but reset for
  // the next dispatch — which is exactly what retry-safe id derivation
  // needs.
  let commentOrdinal = 0;

  const updateStatusTool: Tool = {
    name: 'update_ticket_status',
    description:
      'Update the status of the current ticket. Call this when work is complete (status="done") or if you cannot proceed (status="blocked"). Valid statuses: open, in_progress, done, blocked, cancelled.',
    parameters: z.object({
      status: z.enum(['open', 'in_progress', 'done', 'blocked', 'cancelled']),
      reason: z.string().optional().describe('Brief reason for the status change'),
    }),
    async execute(params): Promise<ToolResult> {
      const { status, reason } = params as { status: string; reason?: string };
      try {
        const metadata: Record<string, unknown> = reason ? { agentStatusReason: reason } : {};
        const ticket = await client.updateTicket(ticketId, { status, metadata });
        if (!ticket) {
          return { success: false, error: `Ticket ${ticketId} not found` };
        }
        return {
          success: true,
          data: { ticketId: ticket.id, status: ticket.status },
          metadata: { message: `Ticket status updated to "${status}"` },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to update ticket status: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  };

  const addCommentTool: Tool = {
    name: 'add_ticket_comment',
    description:
      'Write a comment on the current ticket. Use this to report what you did, what changed in the admin, or why you could not complete the task.',
    parameters: z.object({
      text: z.string().min(1).describe('The comment text to add to the ticket'),
    }),
    async execute(params): Promise<ToolResult> {
      const { text } = params as { text: string };
      const ordinal = commentOrdinal++;
      const derivedId = options.dispatchId
        ? deriveCommentId(options.dispatchId, ordinal)
        : undefined;

      try {
        const body = {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
        };
        const comment = await client.createComment(
          ticketId,
          body,
          derivedId ? { id: derivedId } : undefined,
        );
        if (!comment) {
          return { success: false, error: 'Failed to create comment' };
        }
        return {
          success: true,
          data: { commentId: comment.id, ticketId: comment.ticketId },
          metadata: { message: 'Comment added to ticket' },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to add comment: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  };

  return [updateStatusTool, addCommentTool];
}
