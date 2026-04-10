/**
 * Admin-specific tables - Posts, Media, and Globals
 *
 * These tables provide content management functionality for the admin app.
 */

import { boolean, index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users.js';

// =============================================================================
// Posts Table
// =============================================================================

export const posts = pgTable(
  'posts',
  {
    // Primary identifier
    id: text('id').primaryKey(),

    // Schema versioning for migrations
    schemaVersion: text('schema_version').notNull().default('1'),

    // Optimistic locking — incremented on each update, checked to detect concurrent edits
    version: integer('version').notNull().default(1),

    // Basic info
    title: text('title').notNull(),
    slug: text('slug').notNull().unique(),
    excerpt: text('excerpt'),

    // Content (Lexical editor state as JSON)
    content: jsonb('content'),

    // Featured image reference (FK to media — set null on delete)
    featuredImageId: text('featured_image_id').references(() => media.id, {
      onDelete: 'set null',
    }),

    // Author relationship
    authorId: text('author_id').references(() => users.id, {
      onDelete: 'set null',
    }),

    // Status: draft, published, archived
    status: text('status').notNull().default('draft'),
    published: boolean('published').default(false),

    // SEO metadata
    meta: jsonb('meta'),

    // Categories/tags as JSON array
    categories: jsonb('categories').$type<string[]>().default([]),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }),

    // Soft-delete: null = active, timestamp = when deleted
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('posts_author_id_idx').on(table.authorId),
    index('posts_featured_image_id_idx').on(table.featuredImageId),
    index('posts_deleted_at_idx').on(table.deletedAt),
  ],
);

// =============================================================================
// Media Table
// =============================================================================

export const media = pgTable('media', {
  // Primary identifier
  id: text('id').primaryKey(),

  // Schema versioning
  schemaVersion: text('schema_version').notNull().default('1'),

  // Optimistic locking — incremented on each update, checked to detect concurrent edits
  version: integer('version').notNull().default(1),

  // File info
  filename: text('filename').notNull(),
  mimeType: text('mime_type').notNull(),
  filesize: integer('filesize'),

  // Storage URL (Vercel Blob or other)
  url: text('url').notNull(),

  // Alternative text for accessibility
  alt: text('alt'),

  // Image dimensions (if applicable)
  width: integer('width'),
  height: integer('height'),

  // Focal point for cropping (JSON: { x: number, y: number })
  focalPoint: jsonb('focal_point'),

  // Thumbnails/sizes (JSON array of generated sizes)
  sizes: jsonb('sizes'),

  // Uploaded by
  uploadedBy: text('uploaded_by').references(() => users.id, {
    onDelete: 'set null',
  }),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),

  // Soft-delete: null = active, timestamp = when deleted
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// =============================================================================
// Global: Header
// =============================================================================

export const globalHeader = pgTable('global_header', {
  // Single row table - always id = 1
  id: text('id').primaryKey().default('1'),

  // Schema versioning
  schemaVersion: text('schema_version').notNull().default('1'),

  // Navigation items (JSON array)
  navItems: jsonb('nav_items')
    .$type<
      Array<{
        label: string;
        url: string;
        newTab?: boolean;
        children?: Array<{ label: string; url: string; newTab?: boolean }>;
      }>
    >()
    .default([]),

  // Logo reference
  logoId: text('logo_id'),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// =============================================================================
// Global: Footer
// =============================================================================

export const globalFooter = pgTable('global_footer', {
  // Single row table - always id = 1
  id: text('id').primaryKey().default('1'),

  // Schema versioning
  schemaVersion: text('schema_version').notNull().default('1'),

  // Footer columns (JSON array)
  columns: jsonb('columns')
    .$type<
      Array<{
        label: string;
        links: Array<{ label: string; url: string; newTab?: boolean }>;
      }>
    >()
    .default([]),

  // Copyright text
  copyright: text('copyright'),

  // Social links (JSON array)
  socialLinks: jsonb('social_links')
    .$type<
      Array<{
        platform: string;
        url: string;
      }>
    >()
    .default([]),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// =============================================================================
// Global: Settings
// =============================================================================

export const globalSettings = pgTable('global_settings', {
  // Single row table - always id = 1
  id: text('id').primaryKey().default('1'),

  // Schema versioning
  schemaVersion: text('schema_version').notNull().default('1'),

  // Site info
  siteName: text('site_name'),
  siteDescription: text('site_description'),

  // Default meta tags
  defaultMeta: jsonb('default_meta'),

  // Contact info
  contactEmail: text('contact_email'),
  contactPhone: text('contact_phone'),

  // Social profiles
  socialProfiles: jsonb('social_profiles'),

  // Analytics IDs
  analyticsId: text('analytics_id'),

  // Feature flags
  features: jsonb('features'),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// =============================================================================
// Type exports for Drizzle
// =============================================================================

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
export type Media = typeof media.$inferSelect;
export type NewMedia = typeof media.$inferInsert;
export type GlobalHeader = typeof globalHeader.$inferSelect;
export type NewGlobalHeader = typeof globalHeader.$inferInsert;
export type GlobalFooter = typeof globalFooter.$inferSelect;
export type NewGlobalFooter = typeof globalFooter.$inferInsert;
export type GlobalSettings = typeof globalSettings.$inferSelect;
export type NewGlobalSettings = typeof globalSettings.$inferInsert;
