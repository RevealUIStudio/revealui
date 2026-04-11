/**
 * Ticketing System Schema
 *
 * Replaces the simple todos table with a full-featured ticketing system
 * supporting kanban boards, labels, comments, and subtask hierarchies.
 *
 * Tables:
 * - boards: Kanban boards scoped to tenants
 * - boardColumns: Customizable columns per board
 * - ticketLabels: Colored tags for categorization
 * - tickets: Core ticket entity (replaces todos)
 * - ticketComments: Threaded discussion per ticket
 * - ticketLabelAssignments: Junction table for ticket-label M:N
 */

import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import type { AnyPgColumn } from 'drizzle-orm/pg-core/columns/common';
import { users } from './users.js';

// =============================================================================
// Boards
// =============================================================================

export const boards = pgTable(
  'boards',
  {
    id: text('id').primaryKey(),
    schemaVersion: text('schema_version').notNull().default('1'),

    /** Tenant scoping (null = global/default board) */
    tenantId: text('tenant_id'),

    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),

    /** Board owner */
    ownerId: text('owner_id').references(() => users.id, { onDelete: 'set null' }),

    /** Whether this is the default board for new tickets */
    isDefault: boolean('is_default').notNull().default(false),

    /** Extensible board settings (e.g., default assignee, WIP limits) */
    settings: jsonb('settings').default('{}').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index('boards_tenant_id_idx').on(table.tenantId),
    index('boards_owner_id_idx').on(table.ownerId),
  ],
);

export type Board = typeof boards.$inferSelect;
export type NewBoard = typeof boards.$inferInsert;

// =============================================================================
// Board Columns
// =============================================================================

export const boardColumns = pgTable('board_columns', {
  id: text('id').primaryKey(),

  boardId: text('board_id')
    .notNull()
    .references(() => boards.id, { onDelete: 'cascade' }),

  name: text('name').notNull(),
  slug: text('slug').notNull(),

  /** Display order (0-based) */
  position: integer('position').notNull().default(0),

  /** Work-in-progress limit (null = unlimited) */
  wipLimit: integer('wip_limit'),

  /** Column header color (hex) */
  color: text('color'),

  /** Whether new tickets default to this column */
  isDefault: boolean('is_default').notNull().default(false),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date()),
});

export type BoardColumn = typeof boardColumns.$inferSelect;
export type NewBoardColumn = typeof boardColumns.$inferInsert;

// =============================================================================
// Ticket Labels
// =============================================================================

export const ticketLabels = pgTable(
  'ticket_labels',
  {
    id: text('id').primaryKey(),

    /** Tenant scoping (null = global labels) */
    tenantId: text('tenant_id'),

    name: text('name').notNull(),
    slug: text('slug').notNull(),

    /** Display color (hex) */
    color: text('color').notNull().default('#6366f1'),

    description: text('description'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [index('ticket_labels_tenant_id_idx').on(table.tenantId)],
);

export type TicketLabel = typeof ticketLabels.$inferSelect;
export type NewTicketLabel = typeof ticketLabels.$inferInsert;

// =============================================================================
// Tickets (replaces todos)
// =============================================================================

export const tickets = pgTable(
  'tickets',
  {
    id: text('id').primaryKey(),
    schemaVersion: text('schema_version').notNull().default('1'),

    /** Which board this ticket belongs to */
    boardId: text('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),

    /** Current kanban column */
    columnId: text('column_id').references(() => boardColumns.id, { onDelete: 'set null' }),

    /** Parent ticket for subtasks/epics (self-referencing) */
    parentTicketId: text('parent_ticket_id').references((): AnyPgColumn => tickets.id, {
      onDelete: 'cascade',
    }),

    /** Human-readable ticket number, auto-incremented per board */
    ticketNumber: integer('ticket_number').notNull(),

    title: text('title').notNull(),

    /** Rich text description (Lexical editor JSON) */
    description: jsonb('description'),

    /** Status: backlog, todo, in_progress, review, done, closed */
    status: text('status').notNull().default('backlog'),

    /** Priority: critical, high, medium, low */
    priority: text('priority').notNull().default('medium'),

    /** Type: bug, feature, task, improvement, epic */
    type: text('type').notNull().default('task'),

    /** Assigned user */
    assigneeId: text('assignee_id').references(() => users.id, { onDelete: 'set null' }),

    /** User who created the ticket */
    reporterId: text('reporter_id').references(() => users.id, { onDelete: 'set null' }),

    /** Due date */
    dueDate: timestamp('due_date', { withTimezone: true }),

    /** Estimated effort (story points or minutes) */
    estimatedEffort: integer('estimated_effort'),

    /** Sort order within a column (for drag-and-drop) */
    sortOrder: integer('sort_order').notNull().default(0),

    /** Denormalized comment count for list views */
    commentCount: integer('comment_count').notNull().default(0),

    /** File attachments */
    attachments: jsonb('attachments')
      .$type<Array<{ url: string; filename: string; mimeType: string; filesize: number }>>()
      .default([])
      .notNull(),

    /** Extensible metadata */
    metadata: jsonb('metadata').default('{}').notNull(),

    /** When the ticket was closed/resolved */
    closedAt: timestamp('closed_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index('tickets_board_id_idx').on(table.boardId),
    index('tickets_column_id_idx').on(table.columnId),
    index('tickets_assignee_id_idx').on(table.assigneeId),
    index('tickets_parent_ticket_id_idx').on(table.parentTicketId),
    index('tickets_reporter_id_idx').on(table.reporterId),
    uniqueIndex('tickets_board_ticket_number_idx').on(table.boardId, table.ticketNumber),
  ],
);

export type Ticket = typeof tickets.$inferSelect;
export type NewTicket = typeof tickets.$inferInsert;

// =============================================================================
// Ticket Comments
// =============================================================================

export const ticketComments = pgTable(
  'ticket_comments',
  {
    id: text('id').primaryKey(),

    ticketId: text('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),

    /** Comment author */
    authorId: text('author_id').references(() => users.id, { onDelete: 'set null' }),

    /** Rich text body (Lexical editor JSON) */
    body: jsonb('body').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index('ticket_comments_ticket_id_idx').on(table.ticketId),
    index('ticket_comments_author_id_idx').on(table.authorId),
  ],
);

export type TicketComment = typeof ticketComments.$inferSelect;
export type NewTicketComment = typeof ticketComments.$inferInsert;

// =============================================================================
// Ticket-Label Assignments (M:N junction)
// =============================================================================

export const ticketLabelAssignments = pgTable(
  'ticket_label_assignments',
  {
    id: text('id').primaryKey(),

    ticketId: text('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),

    labelId: text('label_id')
      .notNull()
      .references(() => ticketLabels.id, { onDelete: 'cascade' }),

    assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('ticket_label_unique_idx').on(table.ticketId, table.labelId)],
);

export type TicketLabelAssignment = typeof ticketLabelAssignments.$inferSelect;
export type NewTicketLabelAssignment = typeof ticketLabelAssignments.$inferInsert;
