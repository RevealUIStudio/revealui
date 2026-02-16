/**
 * Ticket Comment Entity Contract
 *
 * Comments on tickets. Supports rich text (JSON) body content.
 *
 * Business Rules:
 * - Creating a comment increments ticket.commentCount
 * - Deleting a comment decrements ticket.commentCount (min 0)
 * - Body is stored as Lexical/JSON rich text
 * - authorId is nullable (system-generated comments)
 */

import { z } from 'zod/v4'

// =============================================================================
// Constants
// =============================================================================

export const TICKET_COMMENT_SCHEMA_VERSION = 1

// =============================================================================
// Schema
// =============================================================================

export const TicketCommentObjectSchema = z.object({
  id: z.string().min(1),
  schemaVersion: z.string().default(String(TICKET_COMMENT_SCHEMA_VERSION)),
  ticketId: z.string().min(1),
  authorId: z.string().nullable().optional(),
  body: z.unknown(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const TicketCommentSchema = TicketCommentObjectSchema
export type TicketComment = z.infer<typeof TicketCommentSchema>

export const TicketCommentInsertSchema = TicketCommentObjectSchema.omit({
  createdAt: true,
  updatedAt: true,
}).extend({
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
})

export type TicketCommentInsert = z.infer<typeof TicketCommentInsertSchema>

// =============================================================================
// Helpers
// =============================================================================

export function isSystemComment(comment: TicketComment): boolean {
  return comment.authorId === null || comment.authorId === undefined
}

export function isAuthoredBy(comment: TicketComment, userId: string): boolean {
  return comment.authorId === userId
}

export function createCommentInsert(
  ticketId: string,
  body: unknown,
  options?: { id?: string; authorId?: string },
): TicketCommentInsert {
  const now = new Date()
  return {
    id: options?.id ?? crypto.randomUUID(),
    schemaVersion: String(TICKET_COMMENT_SCHEMA_VERSION),
    ticketId,
    authorId: options?.authorId ?? null,
    body,
    createdAt: now,
    updatedAt: now,
  }
}
