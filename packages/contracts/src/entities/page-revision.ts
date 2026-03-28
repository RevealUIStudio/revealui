/**
 * PageRevision Entity Contract
 *
 * Manages page version history with content snapshots and change tracking.
 * Revisions are immutable records capturing the state of a page at a specific point in time.
 *
 * Business Rules:
 * - Revisions are immutable (no updates after creation)
 * - Revision numbers auto-increment per page
 * - Content snapshot includes title, blocks, and SEO metadata
 * - Change descriptions are optional but recommended
 * - Cascading deletion when parent page is deleted
 * - createdBy tracks who made the change
 */

import { z } from 'zod/v4';

// =============================================================================
// Constants
// =============================================================================

export const PAGE_REVISION_SCHEMA_VERSION = 1;

// Change types for categorizing revisions
export const CHANGE_TYPES = [
  'create',
  'edit',
  'publish',
  'unpublish',
  'archive',
  'restore',
  'reorder',
  'seo_update',
  'block_add',
  'block_remove',
  'block_edit',
  'manual_save',
] as const;

export type ChangeType = (typeof CHANGE_TYPES)[number];

// Revision retention policies
export const REVISION_RETENTION = {
  MAX_REVISIONS_PER_PAGE: 100,
  DAYS_TO_KEEP: 90,
  ALWAYS_KEEP_PUBLISHED: true,
} as const;

// =============================================================================
// Base Schemas
// =============================================================================

/**
 * Block schema (simplified, matches Page blocks)
 */
export const BlockSchema = z.object({
  id: z.string(),
  type: z.string(),
  data: z.record(z.string(), z.unknown()).optional(),
});

export type Block = z.infer<typeof BlockSchema>;

/**
 * SEO metadata schema (matches Page seo)
 */
export const SeoMetadataSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  ogImage: z.string().optional(),
  noIndex: z.boolean().optional(),
  canonicalUrl: z.string().optional(),
});

export type SeoMetadata = z.infer<typeof SeoMetadataSchema>;

// =============================================================================
// Base PageRevision Schema
// =============================================================================

/**
 * Page Revision object schema
 */
export const PageRevisionObjectSchema = z.object({
  id: z.string().min(1),
  pageId: z.string().min(1, 'Page ID is required'),
  createdBy: z.string().nullable().optional(),
  revisionNumber: z.number().int().positive('Revision number must be positive'),
  title: z.string().min(1, 'Title is required'),
  blocks: z.array(BlockSchema).default([]),
  seo: SeoMetadataSchema.nullable().optional(),
  changeDescription: z.string().nullable().optional(),
  createdAt: z.date(),
});

/**
 * Page Revision schema with validation rules
 */
export const PageRevisionBaseSchema = PageRevisionObjectSchema.refine(
  (data) => {
    // Revision number must be >= 1
    return data.revisionNumber >= 1;
  },
  {
    message: 'Revision number must be at least 1',
    path: ['revisionNumber'],
  },
);

export const PageRevisionSchema = PageRevisionBaseSchema;

// =============================================================================
// Insert Schema
// =============================================================================

/**
 * Schema for creating new page revisions
 */
export const PageRevisionInsertSchema = PageRevisionObjectSchema.omit({
  createdAt: true,
}).extend({
  createdAt: z.date().optional(),
});

// =============================================================================
// Type Exports
// =============================================================================

export type PageRevision = z.infer<typeof PageRevisionSchema>;
export type PageRevisionInsert = z.infer<typeof PageRevisionInsertSchema>;

// =============================================================================
// Revision Number Helpers
// =============================================================================

/**
 * Check if this is the first revision
 */
export function isFirstRevision(revision: PageRevision): boolean {
  return revision.revisionNumber === 1;
}

/**
 * Get next revision number
 */
export function getNextRevisionNumber(currentRevision: PageRevision): number {
  return currentRevision.revisionNumber + 1;
}

/**
 * Calculate revision number from count
 */
export function calculateRevisionNumber(existingCount: number): number {
  return existingCount + 1;
}

// =============================================================================
// Content Helpers
// =============================================================================

/**
 * Count blocks in revision
 */
export function getBlockCount(revision: PageRevision): number {
  return revision.blocks.length;
}

/**
 * Check if revision has blocks
 */
export function hasBlocks(revision: PageRevision): boolean {
  return revision.blocks.length > 0;
}

/**
 * Check if revision has SEO metadata
 */
export function hasSeoMetadata(revision: PageRevision): boolean {
  return revision.seo !== null && revision.seo !== undefined;
}

/**
 * Estimate word count from blocks (simplified)
 */
export function estimateWordCount(revision: PageRevision): number {
  let wordCount = 0;

  // Count words in title
  wordCount += revision.title.split(/\s+/).length;

  // Count words in blocks (rough estimate from JSON)
  for (const block of revision.blocks) {
    if (block.data) {
      const blockText = JSON.stringify(block.data);
      wordCount += blockText.split(/\s+/).length / 2; // Rough estimate
    }
  }

  return Math.floor(wordCount);
}

/**
 * Get block by ID
 */
export function getBlockById(revision: PageRevision, blockId: string): Block | undefined {
  return revision.blocks.find((block) => block.id === blockId);
}

/**
 * Get blocks by type
 */
export function getBlocksByType(revision: PageRevision, type: string): Block[] {
  return revision.blocks.filter((block) => block.type === type);
}

// =============================================================================
// Change Description Helpers
// =============================================================================

/**
 * Check if revision has change description
 */
export function hasChangeDescription(revision: PageRevision): boolean {
  return (
    revision.changeDescription !== null &&
    revision.changeDescription !== undefined &&
    revision.changeDescription.length > 0
  );
}

/**
 * Parse change type from description
 */
export function inferChangeType(revision: PageRevision): ChangeType | 'unknown' {
  if (!hasChangeDescription(revision)) return 'unknown';

  const description = revision.changeDescription?.toLowerCase() ?? '';

  if (description.includes('publish')) return 'publish';
  if (description.includes('unpublish')) return 'unpublish';
  if (description.includes('archive')) return 'archive';
  if (description.includes('restore')) return 'restore';
  if (description.includes('seo')) return 'seo_update';
  if (description.includes('add') && description.includes('block')) return 'block_add';
  if (description.includes('remove') && description.includes('block')) return 'block_remove';
  if (description.includes('edit') && description.includes('block')) return 'block_edit';
  if (description.includes('create')) return 'create';
  if (description.includes('reorder')) return 'reorder';

  return 'edit';
}

/**
 * Generate change description
 */
export function generateChangeDescription(changeType: ChangeType, details?: string): string {
  const descriptions: Record<ChangeType, string> = {
    create: 'Created page',
    edit: 'Edited content',
    publish: 'Published page',
    unpublish: 'Unpublished page',
    archive: 'Archived page',
    restore: 'Restored page',
    reorder: 'Reordered blocks',
    seo_update: 'Updated SEO metadata',
    block_add: 'Added block',
    block_remove: 'Removed block',
    block_edit: 'Edited block',
    manual_save: 'Manual save',
  };

  const baseDescription = descriptions[changeType];
  return details ? `${baseDescription}: ${details}` : baseDescription;
}

// =============================================================================
// Comparison Helpers
// =============================================================================

/**
 * Compare two revisions to detect changes
 */
export function compareRevisions(
  oldRevision: PageRevision,
  newRevision: PageRevision,
): {
  titleChanged: boolean;
  blocksChanged: boolean;
  seoChanged: boolean;
  blockCountChanged: boolean;
} {
  return {
    titleChanged: oldRevision.title !== newRevision.title,
    blocksChanged: JSON.stringify(oldRevision.blocks) !== JSON.stringify(newRevision.blocks),
    seoChanged: JSON.stringify(oldRevision.seo) !== JSON.stringify(newRevision.seo),
    blockCountChanged: oldRevision.blocks.length !== newRevision.blocks.length,
  };
}

/**
 * Detect what changed between revisions
 */
export function detectChanges(oldRevision: PageRevision, newRevision: PageRevision): string[] {
  const changes: string[] = [];
  const comparison = compareRevisions(oldRevision, newRevision);

  if (comparison.titleChanged) {
    changes.push(`Title: "${oldRevision.title}" → "${newRevision.title}"`);
  }

  if (comparison.blockCountChanged) {
    changes.push(`Blocks: ${oldRevision.blocks.length} → ${newRevision.blocks.length}`);
  }

  if (comparison.seoChanged) {
    changes.push('SEO metadata updated');
  }

  return changes;
}

// =============================================================================
// Age & Timing Helpers
// =============================================================================

/**
 * Get revision age in milliseconds
 */
export function getRevisionAge(revision: PageRevision): number {
  return Date.now() - revision.createdAt.getTime();
}

/**
 * Get revision age in days
 */
export function getRevisionAgeInDays(revision: PageRevision): number {
  return Math.floor(getRevisionAge(revision) / (1000 * 60 * 60 * 24));
}

/**
 * Check if revision is recent (< 24 hours)
 */
export function isRecentRevision(revision: PageRevision, hoursThreshold = 24): boolean {
  const ageInHours = getRevisionAge(revision) / (1000 * 60 * 60);
  return ageInHours < hoursThreshold;
}

/**
 * Check if revision is old enough to be cleaned up
 */
export function isEligibleForCleanup(
  revision: PageRevision,
  daysThreshold = REVISION_RETENTION.DAYS_TO_KEEP,
): boolean {
  return getRevisionAgeInDays(revision) > daysThreshold;
}

// =============================================================================
// Authorship Helpers
// =============================================================================

/**
 * Check if revision has known author
 */
export function hasAuthor(revision: PageRevision): boolean {
  return revision.createdBy !== null && revision.createdBy !== undefined;
}

/**
 * Check if revision was created by specific user
 */
export function isCreatedBy(revision: PageRevision, userId: string): boolean {
  return revision.createdBy === userId;
}

// =============================================================================
// Revision Creation
// =============================================================================

/**
 * Create page revision insert data
 */
export function createPageRevisionInsert(
  pageId: string,
  revisionNumber: number,
  title: string,
  blocks: Block[],
  options?: {
    id?: string;
    seo?: SeoMetadata | null;
    changeDescription?: string | null;
    createdBy?: string | null;
  },
): PageRevisionInsert {
  return {
    id: options?.id ?? crypto.randomUUID(),
    pageId,
    revisionNumber,
    title,
    blocks,
    seo: options?.seo ?? null,
    changeDescription: options?.changeDescription ?? null,
    createdBy: options?.createdBy ?? null,
    createdAt: new Date(),
  };
}

/**
 * Create revision from page snapshot
 */
export function createRevisionFromSnapshot(
  pageId: string,
  revisionNumber: number,
  snapshot: {
    title: string;
    blocks: Block[];
    seo?: SeoMetadata | null;
  },
  options?: {
    changeDescription?: string;
    changeType?: ChangeType;
    createdBy?: string;
  },
): PageRevisionInsert {
  const changeDescription =
    options?.changeDescription ??
    (options?.changeType ? generateChangeDescription(options.changeType) : null);

  return createPageRevisionInsert(pageId, revisionNumber, snapshot.title, snapshot.blocks, {
    seo: snapshot.seo,
    changeDescription,
    createdBy: options?.createdBy,
  });
}

// =============================================================================
// Extended Views with Computed Fields
// =============================================================================

/**
 * Page revision with computed fields for UI display
 */
export interface PageRevisionWithComputed extends PageRevision {
  _computed: {
    isFirstRevision: boolean;
    blockCount: number;
    hasBlocks: boolean;
    hasSeoMetadata: boolean;
    hasChangeDescription: boolean;
    hasAuthor: boolean;
    estimatedWordCount: number;
    ageInDays: number;
    isRecent: boolean;
    inferredChangeType: ChangeType | 'unknown';
  };
}

/**
 * Convert page revision to format with computed fields
 */
export function pageRevisionToHuman(revision: PageRevision): PageRevisionWithComputed {
  return {
    ...revision,
    _computed: {
      isFirstRevision: isFirstRevision(revision),
      blockCount: getBlockCount(revision),
      hasBlocks: hasBlocks(revision),
      hasSeoMetadata: hasSeoMetadata(revision),
      hasChangeDescription: hasChangeDescription(revision),
      hasAuthor: hasAuthor(revision),
      estimatedWordCount: estimateWordCount(revision),
      ageInDays: getRevisionAgeInDays(revision),
      isRecent: isRecentRevision(revision),
      inferredChangeType: inferChangeType(revision),
    },
  };
}

/**
 * Page revision with metadata for agent/API consumption
 */
export interface PageRevisionAgent extends PageRevision {
  metadata: {
    revisionNumber: number;
    isFirstRevision: boolean;
    blockCount: number;
    wordCount: number;
    hasAuthor: boolean;
    ageMs: number;
    changeType: ChangeType | 'unknown';
  };
}

/**
 * Convert page revision to agent-compatible format
 */
export function pageRevisionToAgent(revision: PageRevision): PageRevisionAgent {
  return {
    ...revision,
    metadata: {
      revisionNumber: revision.revisionNumber,
      isFirstRevision: isFirstRevision(revision),
      blockCount: getBlockCount(revision),
      wordCount: estimateWordCount(revision),
      hasAuthor: hasAuthor(revision),
      ageMs: getRevisionAge(revision),
      changeType: inferChangeType(revision),
    },
  };
}

/**
 * Zod schema for page revision with computed fields
 */
export const PageRevisionWithComputedSchema = PageRevisionSchema.and(
  z.object({
    _computed: z.object({
      isFirstRevision: z.boolean(),
      blockCount: z.number().int(),
      hasBlocks: z.boolean(),
      hasSeoMetadata: z.boolean(),
      hasChangeDescription: z.boolean(),
      hasAuthor: z.boolean(),
      estimatedWordCount: z.number().int(),
      ageInDays: z.number(),
      isRecent: z.boolean(),
      inferredChangeType: z.enum([...CHANGE_TYPES, 'unknown']),
    }),
  }),
);

/**
 * Zod schema for page revision with agent metadata
 */
export const PageRevisionAgentSchema = PageRevisionSchema.and(
  z.object({
    metadata: z.object({
      revisionNumber: z.number().int(),
      isFirstRevision: z.boolean(),
      blockCount: z.number().int(),
      wordCount: z.number().int(),
      hasAuthor: z.boolean(),
      ageMs: z.number(),
      changeType: z.enum([...CHANGE_TYPES, 'unknown']),
    }),
  }),
);
