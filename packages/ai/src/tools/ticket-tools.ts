/**
 * Ticket Mutation Tools
 *
 * Tools that allow an agent to update ticket state as it works —
 * closing a ticket when done, moving it between columns, and writing
 * its results back as a comment.
 *
 * These are injected by createTicketTools() and are always paired with
 * CMS tools so agents can act on content AND report back through the ticket.
 */

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

  createComment(
    ticketId: string,
    body: Record<string, unknown>,
  ): Promise<{ id: string; ticketId: string } | null | undefined>;
}

export function createTicketTools(ticketId: string, client: TicketMutationClient): Tool[] {
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
      'Write a comment on the current ticket. Use this to report what you did, what changed in the CMS, or why you could not complete the task.',
    parameters: z.object({
      text: z.string().min(1).describe('The comment text to add to the ticket'),
    }),
    async execute(params): Promise<ToolResult> {
      const { text } = params as { text: string };
      try {
        const body = {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
        };
        const comment = await client.createComment(ticketId, body);
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
