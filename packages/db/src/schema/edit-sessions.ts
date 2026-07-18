/**
 * Edit session tables - the visual-edit-sessions engine
 *
 * An edit session is a durable, auditable draft workspace over one or more
 * published content docs. `edit_sessions` is the workspace, `edit_session_docs`
 * holds one draft overlay per touched doc (materialized on first patch), and
 * `edit_session_events` is an append-only activity log.
 *
 * Follows the `pages.ts` conventions: text PKs, timestamptz, FK cascade/set-null,
 * CHECK constraints for enum-like columns. The events table uses a serial `id`
 * (not a text UUID) so it yields a monotonic, id-ordered cursor for polling.
 */

import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sites } from './sites.js';
import { users } from './users.js';

// =============================================================================
// Edit Sessions
// =============================================================================

export const editSessions = pgTable(
  'edit_sessions',
  {
    id: text('id').primaryKey(),
    siteId: text('site_id')
      .notNull()
      .references(() => sites.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    // Lifecycle: open (mutable) -> published | discarded (both terminal)
    status: text('status').notNull().default('open'),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .$onUpdateFn(() => new Date())
      .defaultNow()
      .notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
  },
  (table) => [
    index('edit_sessions_site_id_idx').on(table.siteId),
    index('edit_sessions_status_idx').on(table.status),
    index('edit_sessions_site_status_idx').on(table.siteId, table.status),
    check('edit_sessions_status_check', sql`status IN ('open', 'published', 'discarded')`),
  ],
);

// =============================================================================
// Edit Session Docs (draft overlays)
// =============================================================================

export const editSessionDocs = pgTable(
  'edit_session_docs',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => editSessions.id, { onDelete: 'cascade' }),
    docType: text('doc_type').notNull(),
    docId: text('doc_id').notNull(),
    // Full draft doc, materialized from the live doc on first patch.
    draft: jsonb('draft').$type<Record<string, unknown>>().notNull(),
    // Optimistic-locking baseline: the live doc's version at materialization time.
    baseVersion: integer('base_version').notNull(),
    updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .$onUpdateFn(() => new Date())
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('edit_session_docs_session_id_idx').on(table.sessionId),
    // One overlay row per touched doc within a session.
    uniqueIndex('edit_session_docs_session_doc_idx').on(
      table.sessionId,
      table.docType,
      table.docId,
    ),
    check('edit_session_docs_doc_type_check', sql`doc_type IN ('page', 'global', 'post')`),
  ],
);

// =============================================================================
// Edit Session Events (append-only)
// =============================================================================

export const editSessionEvents = pgTable(
  'edit_session_events',
  {
    // serial: monotonic + id-ordered so `?after=<id>` polling is stable.
    id: serial('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => editSessions.id, { onDelete: 'cascade' }),
    actorId: text('actor_id'),
    actorKind: text('actor_kind').notNull(),
    type: text('type').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('edit_session_events_session_id_idx').on(table.sessionId),
    index('edit_session_events_session_id_id_idx').on(table.sessionId, table.id),
    check('edit_session_events_actor_kind_check', sql`actor_kind IN ('human', 'agent')`),
    check(
      'edit_session_events_type_check',
      sql`type IN ('opened', 'patched', 'commented', 'publish_requested', 'published', 'discarded')`,
    ),
  ],
);

// =============================================================================
// Type exports
// =============================================================================

export type EditSession = typeof editSessions.$inferSelect;
export type NewEditSession = typeof editSessions.$inferInsert;
export type EditSessionDoc = typeof editSessionDocs.$inferSelect;
export type NewEditSessionDoc = typeof editSessionDocs.$inferInsert;
export type EditSessionEvent = typeof editSessionEvents.$inferSelect;
export type NewEditSessionEvent = typeof editSessionEvents.$inferInsert;
