/**
 * Post Entity Contract
 *
 * Manages blog posts and articles with publishing workflow, content management,
 * and SEO optimization. Posts support Lexical editor content, featured images,
 * categories, and publication scheduling.
 *
 * Business Rules:
 * - Slug must be unique across all posts
 * - Status values: draft, published, archived
 * - Published flag mirrors published status
 * - publishedAt timestamp set when publishing
 * - Content stored as Lexical editor JSON
 * - Categories stored as string array
 * - Author cascades to null on user deletion
 */

import { z } from 'zod/v4';

// =============================================================================
// Constants
// =============================================================================

export const POST_SCHEMA_VERSION = 1;

// Post status values
export const POST_STATUSES = ['draft', 'published', 'archived'] as const;

export type PostStatus = (typeof POST_STATUSES)[number];

// Lexical editor node types
export const LEXICAL_NODE_TYPES = [
  'paragraph',
  'heading',
  'list',
  'listitem',
  'quote',
  'code',
  'text',
  'link',
  'image',
] as const;

export type LexicalNodeType = (typeof LEXICAL_NODE_TYPES)[number];

// Post limits
export const POST_LIMITS = {
  MIN_TITLE_LENGTH: 1,
  MAX_TITLE_LENGTH: 200,
  MIN_SLUG_LENGTH: 1,
  MAX_SLUG_LENGTH: 200,
  MAX_EXCERPT_LENGTH: 500,
  MAX_CATEGORIES: 10,
} as const;

// =============================================================================
// Base Schemas
// =============================================================================

/**
 * Lexical editor content schema (simplified)
 */
export const LexicalContentSchema = z.object({
  root: z.object({
    children: z.array(z.unknown()),
    direction: z.enum(['ltr', 'rtl']).optional(),
    format: z.string().optional(),
    indent: z.number().optional(),
    type: z.string(),
    version: z.number().optional(),
  }),
});

export type LexicalContent = z.infer<typeof LexicalContentSchema>;

/**
 * Post meta (SEO) schema
 */
export const PostMetaSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  ogImage: z.string().optional(),
  ogTitle: z.string().optional(),
  ogDescription: z.string().optional(),
  twitterCard: z.enum(['summary', 'summary_large_image', 'app', 'player']).optional(),
  canonicalUrl: z.string().optional(),
  noIndex: z.boolean().optional(),
  noFollow: z.boolean().optional(),
});

export type PostMeta = z.infer<typeof PostMetaSchema>;

// =============================================================================
// Base Post Schema
// =============================================================================

/**
 * Post object schema
 */
export const PostObjectSchema = z.object({
  id: z.string().min(1),
  schemaVersion: z.string().default(String(POST_SCHEMA_VERSION)),
  title: z
    .string()
    .min(POST_LIMITS.MIN_TITLE_LENGTH, 'Title is required')
    .max(
      POST_LIMITS.MAX_TITLE_LENGTH,
      `Title cannot exceed ${POST_LIMITS.MAX_TITLE_LENGTH} characters`,
    ),
  slug: z
    .string()
    .min(POST_LIMITS.MIN_SLUG_LENGTH, 'Slug is required')
    .max(
      POST_LIMITS.MAX_SLUG_LENGTH,
      `Slug cannot exceed ${POST_LIMITS.MAX_SLUG_LENGTH} characters`,
    )
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase with hyphens'),
  excerpt: z.string().max(POST_LIMITS.MAX_EXCERPT_LENGTH).nullable().optional(),
  content: LexicalContentSchema.nullable().optional(),
  featuredImageId: z.string().nullable().optional(),
  authorId: z.string().nullable().optional(),
  status: z.enum(POST_STATUSES),
  published: z.boolean().default(false),
  meta: PostMetaSchema.nullable().optional(),
  categories: z.array(z.string()).max(POST_LIMITS.MAX_CATEGORIES).default([]),
  createdAt: z.date(),
  updatedAt: z.date(),
  publishedAt: z.date().nullable().optional(),
});

/**
 * Post schema with validation rules
 */
export const PostBaseSchema = PostObjectSchema.refine(
  (data) => {
    // If published, must have publishedAt timestamp
    if (data.status === 'published' && data.published) {
      return data.publishedAt !== null && data.publishedAt !== undefined;
    }
    return true;
  },
  {
    message: 'Published posts must have a publishedAt timestamp',
    path: ['publishedAt'],
  },
).refine(
  (data) => {
    // Published flag should match status
    if (data.status === 'published') {
      return data.published === true;
    }
    if (data.status === 'draft' || data.status === 'archived') {
      return data.published === false;
    }
    return true;
  },
  {
    message: 'Published flag must match status',
    path: ['published'],
  },
);

export const PostSchema = PostBaseSchema;

// =============================================================================
// Insert Schema
// =============================================================================

/**
 * Schema for creating new posts
 */
export const PostInsertSchema = PostObjectSchema.omit({
  createdAt: true,
  updatedAt: true,
}).extend({
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

// =============================================================================
// Type Exports
// =============================================================================

export type Post = z.infer<typeof PostSchema>;
export type PostInsert = z.infer<typeof PostInsertSchema>;

// =============================================================================
// Status Helpers
// =============================================================================

/**
 * Check if post is draft
 */
export function isDraft(post: Post): boolean {
  return post.status === 'draft';
}

/**
 * Check if post is published
 */
export function isPublished(post: Post): boolean {
  return post.status === 'published' && post.published === true;
}

/**
 * Check if post is archived
 */
export function isArchived(post: Post): boolean {
  return post.status === 'archived';
}

/**
 * Check if post is publishable (has required fields)
 */
export function isPublishable(post: Post): boolean {
  return (
    post.title.length > 0 &&
    post.slug.length > 0 &&
    post.content !== null &&
    post.content !== undefined
  );
}

/**
 * Get status display label
 */
export function getStatusLabel(status: PostStatus): string {
  const labels: Record<PostStatus, string> = {
    draft: 'Draft',
    published: 'Published',
    archived: 'Archived',
  };
  return labels[status];
}

// =============================================================================
// Publishing Helpers
// =============================================================================

/**
 * Create publish update
 */
export function createPublishUpdate(): Partial<Post> {
  return {
    status: 'published',
    published: true,
    publishedAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Create unpublish update
 */
export function createUnpublishUpdate(): Partial<Post> {
  return {
    status: 'draft',
    published: false,
    updatedAt: new Date(),
  };
}

/**
 * Create archive update
 */
export function createArchiveUpdate(): Partial<Post> {
  return {
    status: 'archived',
    published: false,
    updatedAt: new Date(),
  };
}

/**
 * Create restore update (from archive)
 */
export function createRestoreUpdate(): Partial<Post> {
  return {
    status: 'draft',
    published: false,
    updatedAt: new Date(),
  };
}

// =============================================================================
// Content Helpers
// =============================================================================

/**
 * Check if post has content
 */
export function hasContent(post: Post): boolean {
  return post.content !== null && post.content !== undefined;
}

/**
 * Check if post has excerpt
 */
export function hasExcerpt(post: Post): boolean {
  return post.excerpt !== null && post.excerpt !== undefined && post.excerpt.length > 0;
}

/**
 * Check if post has featured image
 */
export function hasFeaturedImage(post: Post): boolean {
  return post.featuredImageId !== null && post.featuredImageId !== undefined;
}

/**
 * Estimate reading time in minutes
 */
export function estimateReadingTime(post: Post): number {
  if (!hasContent(post)) return 0;

  // Rough estimate: 200 words per minute
  const wordCount = estimateWordCount(post);
  return Math.max(1, Math.ceil(wordCount / 200));
}

/**
 * Estimate word count from content
 */
export function estimateWordCount(post: Post): number {
  if (!hasContent(post)) return 0;

  // Count words in title
  let wordCount = post.title.split(/\s+/).length;

  // Count words in excerpt
  if (hasExcerpt(post)) {
    wordCount += (post.excerpt ?? '').split(/\s+/).length;
  }

  // Rough estimate from content JSON
  if (post.content) {
    const contentText = JSON.stringify(post.content.root.children);
    wordCount += contentText.split(/\s+/).length / 2; // Rough estimate
  }

  return Math.floor(wordCount);
}

// =============================================================================
// Author Helpers
// =============================================================================

/**
 * Check if post has author
 */
export function hasAuthor(post: Post): boolean {
  return post.authorId !== null && post.authorId !== undefined;
}

/**
 * Check if post is authored by specific user
 */
export function isAuthoredBy(post: Post, userId: string): boolean {
  return post.authorId === userId;
}

// =============================================================================
// Category Helpers
// =============================================================================

/**
 * Check if post has categories
 */
export function hasCategories(post: Post): boolean {
  return post.categories.length > 0;
}

/**
 * Check if post has specific category
 */
export function hasCategory(post: Post, category: string): boolean {
  return post.categories.includes(category);
}

/**
 * Add category to post
 */
export function addCategory(post: Post, category: string): string[] {
  if (hasCategory(post, category)) return post.categories;
  if (post.categories.length >= POST_LIMITS.MAX_CATEGORIES) {
    throw new Error(`Cannot exceed ${POST_LIMITS.MAX_CATEGORIES} categories`);
  }
  return [...post.categories, category];
}

/**
 * Remove category from post
 */
export function removeCategory(post: Post, category: string): string[] {
  return post.categories.filter((c) => c !== category);
}

// =============================================================================
// SEO Helpers
// =============================================================================

/**
 * Check if post has SEO meta
 */
export function hasMeta(post: Post): boolean {
  return post.meta !== null && post.meta !== undefined;
}

/**
 * Get effective SEO title (meta.title or post.title)
 */
export function getEffectiveSeoTitle(post: Post): string {
  return post.meta?.title ?? post.title;
}

/**
 * Get effective SEO description (meta.description or excerpt)
 */
export function getEffectiveSeoDescription(post: Post): string | null {
  return post.meta?.description ?? post.excerpt ?? null;
}

/**
 * Check if post is indexed by search engines
 */
export function isIndexable(post: Post): boolean {
  return !(post.meta?.noIndex === true);
}

// =============================================================================
// Slug Helpers
// =============================================================================

/**
 * Generate slug from title
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special chars
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
    .slice(0, POST_LIMITS.MAX_SLUG_LENGTH);
}

/**
 * Validate slug format
 */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

// =============================================================================
// Timing Helpers
// =============================================================================

/**
 * Get post age in milliseconds
 */
export function getPostAge(post: Post): number {
  return Date.now() - post.createdAt.getTime();
}

/**
 * Get post age in days
 */
export function getPostAgeInDays(post: Post): number {
  return Math.floor(getPostAge(post) / (1000 * 60 * 60 * 24));
}

/**
 * Get time since last update in milliseconds
 */
export function getTimeSinceUpdate(post: Post): number {
  return Date.now() - post.updatedAt.getTime();
}

/**
 * Get time since publication in milliseconds
 */
export function getTimeSincePublication(post: Post): number | null {
  if (!post.publishedAt) return null;
  return Date.now() - post.publishedAt.getTime();
}

/**
 * Check if post is recent (< 7 days old)
 */
export function isRecentPost(post: Post, daysThreshold = 7): boolean {
  return getPostAgeInDays(post) < daysThreshold;
}

/**
 * Check if post was recently updated (< 24 hours)
 */
export function isRecentlyUpdated(post: Post, hoursThreshold = 24): boolean {
  const hoursSinceUpdate = getTimeSinceUpdate(post) / (1000 * 60 * 60);
  return hoursSinceUpdate < hoursThreshold;
}

// =============================================================================
// Post Creation
// =============================================================================

/**
 * Create post insert data
 */
export function createPostInsert(
  title: string,
  slug: string,
  options?: {
    id?: string;
    excerpt?: string | null;
    content?: LexicalContent | null;
    featuredImageId?: string | null;
    authorId?: string | null;
    status?: PostStatus;
    meta?: PostMeta | null;
    categories?: string[];
  },
): PostInsert {
  const now = new Date();
  const status = options?.status ?? 'draft';

  return {
    id: options?.id ?? crypto.randomUUID(),
    schemaVersion: String(POST_SCHEMA_VERSION),
    title,
    slug,
    excerpt: options?.excerpt ?? null,
    content: options?.content ?? null,
    featuredImageId: options?.featuredImageId ?? null,
    authorId: options?.authorId ?? null,
    status,
    published: status === 'published',
    meta: options?.meta ?? null,
    categories: options?.categories ?? [],
    createdAt: now,
    updatedAt: now,
    publishedAt: status === 'published' ? now : null,
  };
}

/**
 * Update post data
 */
export function updatePost(updates: {
  title?: string;
  slug?: string;
  excerpt?: string | null;
  content?: LexicalContent | null;
  featuredImageId?: string | null;
  meta?: PostMeta | null;
  categories?: string[];
}): Partial<Post> {
  const result: Partial<Post> = {
    updatedAt: new Date(),
  };

  if (updates.title !== undefined) result.title = updates.title;
  if (updates.slug !== undefined) result.slug = updates.slug;
  if (updates.excerpt !== undefined) result.excerpt = updates.excerpt;
  if (updates.content !== undefined) result.content = updates.content;
  if (updates.featuredImageId !== undefined) result.featuredImageId = updates.featuredImageId;
  if (updates.meta !== undefined) result.meta = updates.meta;
  if (updates.categories !== undefined) result.categories = updates.categories;

  return result;
}

// =============================================================================
// Extended Views with Computed Fields
// =============================================================================

/**
 * Post with computed fields for UI display
 */
export interface PostWithComputed extends Post {
  _computed: {
    isDraft: boolean;
    isPublished: boolean;
    isArchived: boolean;
    isPublishable: boolean;
    hasContent: boolean;
    hasExcerpt: boolean;
    hasFeaturedImage: boolean;
    hasAuthor: boolean;
    hasCategories: boolean;
    hasMeta: boolean;
    isIndexable: boolean;
    estimatedWordCount: number;
    estimatedReadingTime: number;
    ageInDays: number;
    isRecent: boolean;
    isRecentlyUpdated: boolean;
    effectiveSeoTitle: string;
    effectiveSeoDescription: string | null;
  };
}

/**
 * Convert post to format with computed fields
 */
export function postToHuman(post: Post): PostWithComputed {
  return {
    ...post,
    _computed: {
      isDraft: isDraft(post),
      isPublished: isPublished(post),
      isArchived: isArchived(post),
      isPublishable: isPublishable(post),
      hasContent: hasContent(post),
      hasExcerpt: hasExcerpt(post),
      hasFeaturedImage: hasFeaturedImage(post),
      hasAuthor: hasAuthor(post),
      hasCategories: hasCategories(post),
      hasMeta: hasMeta(post),
      isIndexable: isIndexable(post),
      estimatedWordCount: estimateWordCount(post),
      estimatedReadingTime: estimateReadingTime(post),
      ageInDays: getPostAgeInDays(post),
      isRecent: isRecentPost(post),
      isRecentlyUpdated: isRecentlyUpdated(post),
      effectiveSeoTitle: getEffectiveSeoTitle(post),
      effectiveSeoDescription: getEffectiveSeoDescription(post),
    },
  };
}

/**
 * Post with metadata for agent/API consumption
 */
export interface PostAgent extends Post {
  metadata: {
    status: PostStatus;
    published: boolean;
    hasContent: boolean;
    wordCount: number;
    readingTimeMinutes: number;
    categoryCount: number;
    ageMs: number;
    timeSincePublicationMs: number | null;
    isIndexable: boolean;
  };
}

/**
 * Convert post to agent-compatible format
 */
export function postToAgent(post: Post): PostAgent {
  return {
    ...post,
    metadata: {
      status: post.status,
      published: post.published,
      hasContent: hasContent(post),
      wordCount: estimateWordCount(post),
      readingTimeMinutes: estimateReadingTime(post),
      categoryCount: post.categories.length,
      ageMs: getPostAge(post),
      timeSincePublicationMs: getTimeSincePublication(post),
      isIndexable: isIndexable(post),
    },
  };
}

/**
 * Zod schema for post with computed fields
 */
export const PostWithComputedSchema = PostSchema.and(
  z.object({
    _computed: z.object({
      isDraft: z.boolean(),
      isPublished: z.boolean(),
      isArchived: z.boolean(),
      isPublishable: z.boolean(),
      hasContent: z.boolean(),
      hasExcerpt: z.boolean(),
      hasFeaturedImage: z.boolean(),
      hasAuthor: z.boolean(),
      hasCategories: z.boolean(),
      hasMeta: z.boolean(),
      isIndexable: z.boolean(),
      estimatedWordCount: z.number().int(),
      estimatedReadingTime: z.number().int(),
      ageInDays: z.number(),
      isRecent: z.boolean(),
      isRecentlyUpdated: z.boolean(),
      effectiveSeoTitle: z.string(),
      effectiveSeoDescription: z.string().nullable(),
    }),
  }),
);

/**
 * Zod schema for post with agent metadata
 */
export const PostAgentSchema = PostSchema.and(
  z.object({
    metadata: z.object({
      status: z.enum(POST_STATUSES),
      published: z.boolean(),
      hasContent: z.boolean(),
      wordCount: z.number().int(),
      readingTimeMinutes: z.number().int(),
      categoryCount: z.number().int(),
      ageMs: z.number(),
      timeSincePublicationMs: z.number().nullable(),
      isIndexable: z.boolean(),
    }),
  }),
);
