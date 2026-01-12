/**
 * Page tables - Derived from @revealui/schema PageSchema
 *
 * These tables store page content and hierarchies.
 * The schema structure mirrors the Zod schemas in @revealui/schema/core/page.
 */

import { integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { sites } from './sites'
import { users } from './users'

// =============================================================================
// Pages Table
// =============================================================================

export const pages = pgTable('pages', {
  // Primary identifier
  id: text('id').primaryKey(),

  // Schema versioning for migrations
  schemaVersion: text('schema_version').notNull().default('1'),

  // Relationships
  siteId: text('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  parentId: text('parent_id'),
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
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
})

// =============================================================================
// Page Revisions Table (for version history)
// =============================================================================

export const pageRevisions = pgTable('page_revisions', {
  // Primary identifier
  id: text('id').primaryKey(),

  // Relationships
  pageId: text('page_id')
    .notNull()
    .references(() => pages.id, { onDelete: 'cascade' }),
  createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),

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
})

// =============================================================================
// Type exports for Drizzle
// =============================================================================

export type Page = typeof pages.$inferSelect
export type NewPage = typeof pages.$inferInsert
export type PageRevision = typeof pageRevisions.$inferSelect
export type NewPageRevision = typeof pageRevisions.$inferInsert
