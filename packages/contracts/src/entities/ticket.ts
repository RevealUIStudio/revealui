/**
 * Ticket Entity Contract
 *
 * Core ticket/issue entity for the kanban board system.
 * Supports: statuses, priorities, types, subtasks, comments, labels, assignments.
 *
 * Business Rules:
 * - ticketNumber auto-increments per board
 * - status values: open, in_progress, in_review, done, closed
 * - priority values: urgent, high, medium, low
 * - type values: task, bug, feature, improvement, epic
 * - Tickets belong to exactly one board
 * - Tickets may optionally be in a board column (kanban placement)
 * - parentTicketId enables subtask hierarchy (one level deep recommended)
 * - description stored as Lexical/JSON rich text
 * - commentCount denormalized for performance
 */

import { z } from 'zod/v4';

// =============================================================================
// Constants
// =============================================================================

export const TICKET_SCHEMA_VERSION = 1;

export const TICKET_STATUSES = ['open', 'in_progress', 'in_review', 'done', 'closed'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ['urgent', 'high', 'medium', 'low'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const TICKET_TYPES = ['task', 'bug', 'feature', 'improvement', 'epic'] as const;
export type TicketType = (typeof TICKET_TYPES)[number];

export const TICKET_LIMITS = {
  MIN_TITLE_LENGTH: 1,
  MAX_TITLE_LENGTH: 500,
  MAX_DESCRIPTION_SIZE: 100_000,
  MAX_SUBTASK_DEPTH: 1,
} as const;

// =============================================================================
// Base Schema
// =============================================================================

export const TicketObjectSchema = z.object({
  id: z.string().min(1),
  schemaVersion: z.string().default(String(TICKET_SCHEMA_VERSION)),
  boardId: z.string().min(1),
  columnId: z.string().nullable().optional(),
  parentTicketId: z.string().nullable().optional(),
  ticketNumber: z.number().int().min(1),
  title: z
    .string()
    .min(TICKET_LIMITS.MIN_TITLE_LENGTH, 'Title is required')
    .max(
      TICKET_LIMITS.MAX_TITLE_LENGTH,
      `Title cannot exceed ${TICKET_LIMITS.MAX_TITLE_LENGTH} characters`,
    ),
  description: z.unknown().nullable().optional(),
  status: z.enum(TICKET_STATUSES).default('open'),
  priority: z.enum(TICKET_PRIORITIES).default('medium'),
  type: z.enum(TICKET_TYPES).default('task'),
  assigneeId: z.string().nullable().optional(),
  reporterId: z.string().nullable().optional(),
  dueDate: z.date().nullable().optional(),
  estimatedEffort: z.number().int().min(0).nullable().optional(),
  sortOrder: z.number().default(0),
  commentCount: z.number().int().default(0),
  attachments: z.unknown().nullable().optional(),
  metadata: z.unknown().nullable().optional(),
  closedAt: z.date().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const TicketSchema = TicketObjectSchema;

export type Ticket = z.infer<typeof TicketSchema>;

// =============================================================================
// Insert Schema
// =============================================================================

export const TicketInsertSchema = TicketObjectSchema.omit({
  ticketNumber: true,
  commentCount: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  ticketNumber: z.number().int().min(1).optional(),
  commentCount: z.number().int().default(0).optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type TicketInsert = z.infer<typeof TicketInsertSchema>;

// =============================================================================
// Status Helpers
// =============================================================================

export function isOpen(ticket: Ticket): boolean {
  return ticket.status === 'open';
}

export function isInProgress(ticket: Ticket): boolean {
  return ticket.status === 'in_progress';
}

export function isDone(ticket: Ticket): boolean {
  return ticket.status === 'done';
}

export function isClosed(ticket: Ticket): boolean {
  return ticket.status === 'closed';
}

export function isResolved(ticket: Ticket): boolean {
  return ticket.status === 'done' || ticket.status === 'closed';
}

export function getStatusLabel(status: TicketStatus): string {
  const labels: Record<TicketStatus, string> = {
    open: 'Open',
    in_progress: 'In Progress',
    in_review: 'In Review',
    done: 'Done',
    closed: 'Closed',
  };
  return labels[status];
}

export function getPriorityLabel(priority: TicketPriority): string {
  const labels: Record<TicketPriority, string> = {
    urgent: 'Urgent',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  };
  return labels[priority];
}

export function getTypeLabel(type: TicketType): string {
  const labels: Record<TicketType, string> = {
    task: 'Task',
    bug: 'Bug',
    feature: 'Feature',
    improvement: 'Improvement',
    epic: 'Epic',
  };
  return labels[type];
}

// =============================================================================
// Assignment Helpers
// =============================================================================

export function isAssigned(ticket: Ticket): boolean {
  return ticket.assigneeId !== null && ticket.assigneeId !== undefined;
}

export function isAssignedTo(ticket: Ticket, userId: string): boolean {
  return ticket.assigneeId === userId;
}

export function isReportedBy(ticket: Ticket, userId: string): boolean {
  return ticket.reporterId === userId;
}

export function isSubtask(ticket: Ticket): boolean {
  return ticket.parentTicketId !== null && ticket.parentTicketId !== undefined;
}

// =============================================================================
// Due Date Helpers
// =============================================================================

export function hasDueDate(ticket: Ticket): boolean {
  return ticket.dueDate !== null && ticket.dueDate !== undefined;
}

export function isOverdue(ticket: Ticket): boolean {
  if (!hasDueDate(ticket) || isResolved(ticket)) return false;
  // biome-ignore lint/style/noNonNullAssertion: guarded by hasDueDate(ticket) above
  return ticket.dueDate!.getTime() < Date.now();
}

export function getDaysUntilDue(ticket: Ticket): number | null {
  if (!hasDueDate(ticket)) return null;
  // biome-ignore lint/style/noNonNullAssertion: guarded by hasDueDate(ticket) above
  const ms = ticket.dueDate!.getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

// =============================================================================
// Ticket Creation
// =============================================================================

export function createTicketInsert(
  boardId: string,
  title: string,
  options?: {
    id?: string;
    columnId?: string;
    parentTicketId?: string;
    description?: unknown;
    status?: TicketStatus;
    priority?: TicketPriority;
    type?: TicketType;
    assigneeId?: string;
    reporterId?: string;
    dueDate?: Date;
    estimatedEffort?: number;
  },
): TicketInsert {
  const now = new Date();
  return {
    id: options?.id ?? crypto.randomUUID(),
    schemaVersion: String(TICKET_SCHEMA_VERSION),
    boardId,
    columnId: options?.columnId ?? null,
    parentTicketId: options?.parentTicketId ?? null,
    title,
    description: options?.description ?? null,
    status: options?.status ?? 'open',
    priority: options?.priority ?? 'medium',
    type: options?.type ?? 'task',
    assigneeId: options?.assigneeId ?? null,
    reporterId: options?.reporterId ?? null,
    dueDate: options?.dueDate ?? null,
    estimatedEffort: options?.estimatedEffort ?? null,
    sortOrder: 0,
    attachments: null,
    metadata: null,
    closedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

// =============================================================================
// Computed Views
// =============================================================================

export interface TicketWithComputed extends Ticket {
  _computed: {
    isOpen: boolean;
    isInProgress: boolean;
    isDone: boolean;
    isClosed: boolean;
    isResolved: boolean;
    isAssigned: boolean;
    isSubtask: boolean;
    isOverdue: boolean;
    hasDueDate: boolean;
    daysUntilDue: number | null;
    hasComments: boolean;
    statusLabel: string;
    priorityLabel: string;
    typeLabel: string;
  };
}

export function ticketToHuman(ticket: Ticket): TicketWithComputed {
  return {
    ...ticket,
    _computed: {
      isOpen: isOpen(ticket),
      isInProgress: isInProgress(ticket),
      isDone: isDone(ticket),
      isClosed: isClosed(ticket),
      isResolved: isResolved(ticket),
      isAssigned: isAssigned(ticket),
      isSubtask: isSubtask(ticket),
      isOverdue: isOverdue(ticket),
      hasDueDate: hasDueDate(ticket),
      daysUntilDue: getDaysUntilDue(ticket),
      hasComments: ticket.commentCount > 0,
      statusLabel: getStatusLabel(ticket.status),
      priorityLabel: getPriorityLabel(ticket.priority),
      typeLabel: getTypeLabel(ticket.type),
    },
  };
}
