/**
 * Site tables - Derived from @revealui/contracts SiteSchema
 *
 * These tables store site configurations and collaborator relationships.
 * The schema structure mirrors the Zod schemas in @revealui/contracts/entities.
 */

import { sql } from 'drizzle-orm';
import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users.js';

// =============================================================================
// Sites Table
// =============================================================================

export const sites = pgTable(
  'sites',
  {
    // Primary identifier
    id: text('id').primaryKey(),

    // Schema versioning for migrations
    schemaVersion: text('schema_version').notNull().default('1'),

    // Optimistic locking — incremented on each update, checked to detect concurrent edits
    version: integer('version').notNull().default(1),

    // Ownership
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Basic info
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    description: text('description'),

    // Status: draft, published, archived
    status: text('status').notNull().default('draft'),

    // Theme configuration (JSON blob)
    theme: jsonb('theme'),

    // Site settings (JSON blob)
    settings: jsonb('settings'),

    // Computed metadata
    pageCount: integer('page_count').default(0),

    // SEO
    favicon: text('favicon'),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }),

    // Soft-delete: null = active, timestamp = when deleted
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('sites_deleted_at_idx').on(table.deletedAt),
    index('sites_status_deleted_at_idx').on(table.status, table.deletedAt),
    index('sites_active_slug_idx').on(table.slug).where(sql`deleted_at IS NULL`),
    index('sites_active_owner_id_idx').on(table.ownerId).where(sql`deleted_at IS NULL`),
    index('sites_active_status_idx').on(table.status).where(sql`deleted_at IS NULL`),
    index('sites_owner_id_idx').on(table.ownerId),
  ],
);

// =============================================================================
// Site Collaborators Table (Many-to-Many: Sites <-> Users)
// =============================================================================

export const siteCollaborators = pgTable(
  'site_collaborators',
  {
    id: text('id').primaryKey(),
    siteId: text('site_id')
      .notNull()
      .references(() => sites.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('viewer'),
    addedBy: text('added_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    addedAt: timestamp('added_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('site_collaborators_site_user_unique').on(table.siteId, table.userId)],
);

// =============================================================================
// Type exports for Drizzle
// =============================================================================

export type Site = typeof sites.$inferSelect;
export type NewSite = typeof sites.$inferInsert;
export type SiteCollaborator = typeof siteCollaborators.$inferSelect;
export type NewSiteCollaborator = typeof siteCollaborators.$inferInsert;
