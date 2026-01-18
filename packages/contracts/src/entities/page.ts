/**
 * Page Schema
 *
 * Pages are the primary content unit. They contain blocks and have routes.
 * Pages support both human editing (visual drag-and-drop) and agent editing
 * (structured block manipulation), enabling seamless human-AI collaboration.
 */

import { z } from 'zod'
import { type Block, BlockSchema, countBlocks } from '../content/index.js'
import {
  createTimestamps,
  DualEntitySchema,
  REPRESENTATION_SCHEMA_VERSION,
  toAgentRepresentation,
  toHumanRepresentation,
} from '../representation/index.js'

// =============================================================================
// Schema Version
// =============================================================================

export const PAGE_SCHEMA_VERSION = 1

// =============================================================================
// Page Status
// =============================================================================

export const PageStatusSchema = z.enum([
  'draft', // Not published
  'published', // Live
  'scheduled', // Will publish at scheduled time
  'archived', // Soft deleted
])
export type PageStatus = z.infer<typeof PageStatusSchema>

// =============================================================================
// Page SEO
// =============================================================================

export const PageSeoSchema = z.object({
  /** Page title (overrides default) */
  title: z.string().max(60).optional(),

  /** Meta description */
  description: z.string().max(160).optional(),

  /** Social sharing image */
  image: z.string().url().optional(),

  /** Prevent indexing */
  noIndex: z.boolean().default(false),

  /** Canonical URL */
  canonicalUrl: z.string().url().optional(),

  /** Open Graph type */
  ogType: z.enum(['website', 'article', 'product']).default('website'),

  /** Structured data (JSON-LD) */
  structuredData: z.record(z.string(), z.unknown()).optional(),
})

export type PageSeo = z.infer<typeof PageSeoSchema>

// =============================================================================
// Page Lock
// =============================================================================

export const PageLockSchema = z.object({
  /** User who locked the page */
  userId: z.string(),

  /** When the lock was acquired */
  lockedAt: z.string().datetime(),

  /** Lock expiration (auto-release) */
  expiresAt: z.string().datetime(),

  /** Reason for lock */
  reason: z.string().optional(),
})

export type PageLock = z.infer<typeof PageLockSchema>

// =============================================================================
// Page Schema
// =============================================================================

export const PageSchema = DualEntitySchema.extend({
  /** Schema version for migrations */
  schemaVersion: z.number().int().default(PAGE_SCHEMA_VERSION),

  /** Parent site ID */
  siteId: z.string(),

  /** Page title */
  title: z.string().min(1).max(200),

  /** URL slug */
  slug: z
    .string()
    .regex(/^[a-z0-9-/]+$/)
    .min(1)
    .max(100),

  /** Full path (computed from parent pages) */
  path: z.string(),

  /** Page status */
  status: PageStatusSchema,

  /** Content blocks */
  blocks: z.array(BlockSchema),

  /** SEO configuration */
  seo: PageSeoSchema.optional(),

  /** Parent page ID (for nested pages) */
  parentId: z.string().optional(),

  /** Sort order within parent */
  order: z.number().int().nonnegative().default(0),

  /** Scheduled publish time */
  publishAt: z.string().datetime().optional(),

  /** Last published time */
  publishedAt: z.string().datetime().optional(),

  /** Template this page was created from */
  templateId: z.string().optional(),

  /** Lock status (prevents concurrent editing) */
  lock: PageLockSchema.optional(),

  /** Block count (including nested, denormalized) */
  blockCount: z.number().int().nonnegative().default(0),

  /** Word count estimate */
  wordCount: z.number().int().nonnegative().default(0),

  /** Last editor user ID */
  lastEditorId: z.string().optional(),
})

export type Page = z.infer<typeof PageSchema>

// =============================================================================
// Page Creation
// =============================================================================

export const CreatePageInputSchema = z.object({
  siteId: z.string(),
  title: z.string().min(1).max(200),
  slug: z
    .string()
    .regex(/^[a-z0-9-/]+$/)
    .min(1)
    .max(100),
  parentId: z.string().optional(),
  templateId: z.string().optional(),
  blocks: z.array(BlockSchema).optional(),
  seo: PageSeoSchema.optional(),
})

export type CreatePageInput = z.infer<typeof CreatePageInputSchema>

/**
 * Computes the full path for a page
 */
export function computePagePath(slug: string, parentPath?: string): string {
  if (parentPath) {
    return `${parentPath}/${slug}`.replace(/\/+/g, '/')
  }
  return `/${slug}`
}

/**
 * Estimates word count from blocks
 *
 * Note: Due to Zod's z.lazy() inference limitations with recursive types,
 * we use type assertions for nested blocks. The schemas correctly validate
 * at runtime, but TypeScript needs help with inference.
 */
export function estimateWordCount(blocks: Block[]): number {
  let count = 0

  const extractText = (block: Block): string => {
    switch (block.type) {
      case 'text':
        return block.data.content
      case 'heading':
        return block.data.text
      case 'quote':
        return block.data.content
      case 'list':
        return block.data.items.map((i: { content: string }) => i.content).join(' ')
      case 'columns':
        return block.data.columns.flatMap((c) => (c.blocks as Block[]).map(extractText)).join(' ')
      case 'grid':
        return block.data.items.flatMap((i) => (i.blocks as Block[]).map(extractText)).join(' ')
      case 'accordion':
        return block.data.items
          .flatMap((i) => [i.title, ...(i.blocks as Block[]).map(extractText)])
          .join(' ')
      case 'tabs':
        return block.data.tabs
          .flatMap((t) => [t.label, ...(t.blocks as Block[]).map(extractText)])
          .join(' ')
      default:
        return ''
    }
  }

  for (const block of blocks) {
    const text = extractText(block)
    count += text.split(/\s+/).filter((w) => w.length > 0).length
  }

  return count
}

/**
 * Creates a new page with dual representation
 */
export function createPage(id: string, input: CreatePageInput, parentPath?: string): Page {
  const timestamps = createTimestamps()
  const path = computePagePath(input.slug, parentPath)
  const blocks = input.blocks || []
  const blockCount = countBlocks(blocks)
  const wordCount = estimateWordCount(blocks)

  return {
    id,
    version: REPRESENTATION_SCHEMA_VERSION,
    schemaVersion: PAGE_SCHEMA_VERSION,
    siteId: input.siteId,
    title: input.title,
    slug: input.slug,
    path,
    status: 'draft',
    blocks,
    seo: input.seo,
    parentId: input.parentId,
    order: 0,
    templateId: input.templateId,
    blockCount,
    wordCount,
    human: toHumanRepresentation({
      title: input.title,
      description: input.seo?.description,
      icon: 'file-text',
    }),
    agent: toAgentRepresentation('page', {
      actions: [
        {
          name: 'addBlock',
          description: 'Add a content block to this page',
          params: {
            type: { type: 'BlockType', required: true, description: 'Type of block to add' },
            position: {
              type: 'number',
              required: false,
              description: 'Position index (defaults to end)',
            },
            data: { type: 'object', required: true, description: 'Block data matching the type' },
          },
        },
        {
          name: 'updateBlock',
          description: 'Update an existing block',
          params: {
            blockId: { type: 'string', required: true, description: 'Block ID to update' },
            data: { type: 'object', required: true, description: 'Partial block data to merge' },
          },
        },
        {
          name: 'removeBlock',
          description: 'Remove a block from this page',
          params: {
            blockId: { type: 'string', required: true, description: 'Block ID to remove' },
          },
          destructive: true,
        },
        {
          name: 'reorderBlocks',
          description: 'Reorder blocks on this page',
          params: {
            blockIds: { type: 'array', required: true, description: 'Block IDs in desired order' },
          },
        },
        {
          name: 'updateSeo',
          description: 'Update SEO metadata',
          params: {
            seo: { type: 'PageSeo', required: true, description: 'SEO data to update' },
          },
        },
        {
          name: 'publish',
          description: 'Publish this page',
          params: {},
          requiredCapabilities: ['publish'],
          sideEffects: ['Page becomes publicly accessible'],
        },
        {
          name: 'duplicate',
          description: 'Create a copy of this page',
          params: {
            newSlug: { type: 'string', required: true, description: 'Slug for the new page' },
            newTitle: { type: 'string', required: false, description: 'Title for the new page' },
          },
        },
      ],
      metadata: {
        siteId: input.siteId,
        blockCount,
        wordCount,
        hasParent: !!input.parentId,
        hasTemplate: !!input.templateId,
      },
      keywords: [input.title.toLowerCase(), input.slug, 'page'],
    }),
    ...timestamps,
  }
}

// =============================================================================
// Page Update
// =============================================================================

export const UpdatePageInputSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  slug: z
    .string()
    .regex(/^[a-z0-9-/]+$/)
    .min(1)
    .max(100)
    .optional(),
  status: PageStatusSchema.optional(),
  blocks: z.array(BlockSchema).optional(),
  seo: PageSeoSchema.partial().optional(),
  order: z.number().int().nonnegative().optional(),
  publishAt: z.string().datetime().optional(),
})

export type UpdatePageInput = z.infer<typeof UpdatePageInputSchema>

// =============================================================================
// Page Utilities
// =============================================================================

/**
 * Checks if a page is currently locked
 */
export function isPageLocked(page: Page): boolean {
  if (!page.lock) return false
  return new Date(page.lock.expiresAt) > new Date()
}

/**
 * Checks if a user holds the lock
 */
export function isLockedByUser(page: Page, userId: string): boolean {
  if (!page.lock) return false
  return page.lock.userId === userId && isPageLocked(page)
}

/**
 * Creates a lock for a page
 */
export function createPageLock(
  userId: string,
  durationMs: number = 5 * 60 * 1000, // 5 minutes default
  reason?: string,
): PageLock {
  const now = new Date()
  return {
    userId,
    lockedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + durationMs).toISOString(),
    reason,
  }
}

/**
 * Gets the breadcrumb path for a page
 */
export function getPageBreadcrumbs(
  page: Page,
  allPages: Page[],
): Array<{ id: string; title: string; path: string }> {
  const breadcrumbs: Array<{ id: string; title: string; path: string }> = []
  let current: Page | undefined = page

  while (current) {
    breadcrumbs.unshift({
      id: current.id,
      title: current.title,
      path: current.path,
    })
    current = current.parentId ? allPages.find((p) => p.id === current?.parentId) : undefined
  }

  return breadcrumbs
}
