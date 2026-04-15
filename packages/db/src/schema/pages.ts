/**
 * Page tables - Derived from @revealui/contracts PageSchema
 *
 * These tables store page content and hierarchies.
 * The schema structure mirrors the Zod schemas in @revealui/contracts/entities.
 */

import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import type { AnyPgColumn } from 'drizzle-orm/pg-core/columns/common';
import { sites } from './sites.js';
import { users } from './users.js';

// =============================================================================
// Pages Table
// =============================================================================

export const pages = pgTable(
  'pages',
  {
    // Primary identifier
    id: text('id').primaryKey(),

    // Schema versioning for migrations
    schemaVersion: text('schema_version').notNull().default('1'),

    // Optimistic locking  -  incremented on each update, checked to detect concurrent edits
    version: integer('version').notNull().default(1),

    // Relationships
    siteId: text('site_id')
      .notNull()
      .references(() => sites.id, { onDelete: 'cascade' }),
    parentId: text('parent_id').references((): AnyPgColumn => pages.id, { onDelete: 'cascade' }),
    templateId: text('template_id'),

    // Basic info
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    path: text('path').notNull(),

    // Status: draft, published, archived, scheduled
    status: text('status').notNull().default('draft'),

    // Content blocks (JSON array of Block objects)
    blocks: jsonb('blocks').$type<unknown[]>().default([]),

    // SEO metadata (JSON blob)
    seo: jsonb('seo'),

    // Computed metadata
    blockCount: integer('block_count').default(0),
    wordCount: integer('word_count').default(0),

    // Lock for concurrent editing
    lock: jsonb('lock'),

    // Scheduling
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .$onUpdateFn(() => new Date())
      .defaultNow()
      .notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }),

    // Soft-delete: null = active, timestamp = when deleted
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('pages_parent_id_idx').on(table.parentId),
    index('pages_site_id_idx').on(table.siteId),
    index('pages_site_status_idx').on(table.siteId, table.status),
    uniqueIndex('pages_slug_site_id_idx').on(table.slug, table.siteId),
    index('pages_deleted_at_idx').on(table.deletedAt),
    check('pages_status_check', sql`status IN ('draft', 'published', 'archived', 'scheduled')`),
  ],
);

// =============================================================================
// Page Revisions Table (for version history)
// =============================================================================

export const pageRevisions = pgTable(
  'page_revisions',
  {
    // Primary identifier
    id: text('id').primaryKey(),

    // Relationships
    pageId: text('page_id')
      .notNull()
      .references(() => pages.id, { onDelete: 'cascade' }),
    createdBy: text('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),

    // Revision number (auto-incremented per page)
    revisionNumber: integer('revision_number').notNull(),

    // Snapshot of page state
    title: text('title').notNull(),
    blocks: jsonb('blocks').$type<unknown[]>().default([]),
    seo: jsonb('seo'),

    // Why this revision was created
    changeDescription: text('change_description'),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('page_revisions_page_id_idx').on(table.pageId)],
);

// =============================================================================
// Type exports for Drizzle
// =============================================================================

export type Page = typeof pages.$inferSelect;
export type NewPage = typeof pages.$inferInsert;
export type PageRevision = typeof pageRevisions.$inferSelect;
export type NewPageRevision = typeof pageRevisions.$inferInsert;
