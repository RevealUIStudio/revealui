/**
 * Code Provenance Entity Contract
 *
 * Tracks authorship (AI-generated, human-written, AI-assisted, mixed) and
 * review status of code at file/function granularity.
 *
 * Design: Value functions — pure functions that take data in and return
 * computed results. No side effects, easy to test, composable.
 *
 * Business Rules:
 * - authorType classifies who wrote the code
 * - reviewStatus tracks audit state
 * - codeReviews is an append-only log (immutable history)
 * - confidence is a 0-1 score for automated classification
 * - Stale = created > 90 days ago and never reviewed
 * - AI involvement = ai_generated || ai_assisted || mixed
 */

import { z } from 'zod/v4';

// =============================================================================
// Constants
// =============================================================================

export const PROVENANCE_SCHEMA_VERSION = 1;

export const AUTHOR_TYPES = ['ai_generated', 'human_written', 'ai_assisted', 'mixed'] as const;
export type AuthorType = (typeof AUTHOR_TYPES)[number];

export const REVIEW_STATUSES = [
  'unreviewed',
  'human_reviewed',
  'ai_reviewed',
  'human_and_ai_reviewed',
] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const REVIEW_TYPES = [
  'human_review',
  'ai_review',
  'human_approval',
  'ai_suggestion',
] as const;
export type ReviewType = (typeof REVIEW_TYPES)[number];

export const REVIEW_DECISIONS = ['approved', 'rejected', 'needs_changes', 'informational'] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

export const PROVENANCE_LIMITS = {
  MAX_FILE_PATH_LENGTH: 1000,
  MAX_FUNCTION_NAME_LENGTH: 200,
} as const;

// =============================================================================
// Zod Schemas — Provenance
// =============================================================================

export const ProvenanceObjectSchema = z.object({
  id: z.string().min(1),
  schemaVersion: z.string().default(String(PROVENANCE_SCHEMA_VERSION)),
  filePath: z.string().min(1).max(PROVENANCE_LIMITS.MAX_FILE_PATH_LENGTH),
  functionName: z.string().max(PROVENANCE_LIMITS.MAX_FUNCTION_NAME_LENGTH).nullable().optional(),
  lineStart: z.number().int().min(0).nullable().optional(),
  lineEnd: z.number().int().min(0).nullable().optional(),
  authorType: z.enum(AUTHOR_TYPES),
  aiModel: z.string().nullable().optional(),
  aiSessionId: z.string().nullable().optional(),
  gitCommitHash: z.string().nullable().optional(),
  gitAuthor: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).default(1.0),
  reviewStatus: z.enum(REVIEW_STATUSES).default('unreviewed'),
  reviewedBy: z.string().nullable().optional(),
  reviewedAt: z.date().nullable().optional(),
  linesOfCode: z.number().int().min(0).default(0),
  metadata: z.unknown().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const ProvenanceSchema = ProvenanceObjectSchema;
export type Provenance = z.infer<typeof ProvenanceSchema>;

export const ProvenanceInsertSchema = ProvenanceObjectSchema.omit({
  createdAt: true,
  updatedAt: true,
}).extend({
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type ProvenanceInsert = z.infer<typeof ProvenanceInsertSchema>;

// =============================================================================
// Zod Schemas — Code Review
// =============================================================================

export const CodeReviewObjectSchema = z.object({
  id: z.string().min(1),
  provenanceId: z.string().min(1),
  reviewerId: z.string().nullable().optional(),
  reviewType: z.enum(REVIEW_TYPES),
  status: z.enum(REVIEW_DECISIONS),
  comment: z.string().nullable().optional(),
  metadata: z.unknown().nullable().optional(),
  createdAt: z.date(),
});

export const CodeReviewSchema = CodeReviewObjectSchema;
export type CodeReview = z.infer<typeof CodeReviewSchema>;

export const CodeReviewInsertSchema = CodeReviewObjectSchema.omit({
  createdAt: true,
}).extend({
  createdAt: z.date().optional(),
});

export type CodeReviewInsert = z.infer<typeof CodeReviewInsertSchema>;

// =============================================================================
// Value Functions — Author Type Predicates
// =============================================================================

export function isAiGenerated(entry: Provenance): boolean {
  return entry.authorType === 'ai_generated';
}

export function isHumanWritten(entry: Provenance): boolean {
  return entry.authorType === 'human_written';
}

export function isAiAssisted(entry: Provenance): boolean {
  return entry.authorType === 'ai_assisted';
}

export function isMixedAuthorship(entry: Provenance): boolean {
  return entry.authorType === 'mixed';
}

export function hasAiInvolvement(entry: Provenance): boolean {
  return entry.authorType !== 'human_written';
}

export function getAuthorTypeLabel(type: AuthorType): string {
  const labels: Record<AuthorType, string> = {
    ai_generated: 'AI Generated',
    human_written: 'Human Written',
    ai_assisted: 'AI Assisted',
    mixed: 'Mixed',
  };
  return labels[type];
}

// =============================================================================
// Value Functions — Review Status Predicates
// =============================================================================

export function isUnreviewed(entry: Provenance): boolean {
  return entry.reviewStatus === 'unreviewed';
}

export function isHumanReviewed(entry: Provenance): boolean {
  return entry.reviewStatus === 'human_reviewed' || entry.reviewStatus === 'human_and_ai_reviewed';
}

export function isAiReviewed(entry: Provenance): boolean {
  return entry.reviewStatus === 'ai_reviewed' || entry.reviewStatus === 'human_and_ai_reviewed';
}

export function isFullyReviewed(entry: Provenance): boolean {
  return entry.reviewStatus === 'human_and_ai_reviewed';
}

export function needsReview(entry: Provenance): boolean {
  return isUnreviewed(entry) && hasAiInvolvement(entry);
}

export function needsHumanReview(entry: Provenance): boolean {
  return hasAiInvolvement(entry) && !isHumanReviewed(entry);
}

export function getReviewStatusLabel(status: ReviewStatus): string {
  const labels: Record<ReviewStatus, string> = {
    unreviewed: 'Unreviewed',
    human_reviewed: 'Human Reviewed',
    ai_reviewed: 'AI Reviewed',
    human_and_ai_reviewed: 'Human & AI Reviewed',
  };
  return labels[status];
}

// =============================================================================
// Value Functions — Confidence & Quality
// =============================================================================

export function isHighConfidence(entry: Provenance): boolean {
  return entry.confidence >= 0.8;
}

export function isLowConfidence(entry: Provenance): boolean {
  return entry.confidence < 0.5;
}

export function getConfidenceLabel(entry: Provenance): string {
  if (entry.confidence >= 0.8) return 'High';
  if (entry.confidence >= 0.5) return 'Medium';
  return 'Low';
}

// =============================================================================
// Value Functions — Time-based
// =============================================================================

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const STALE_THRESHOLD_DAYS = 90;
const RECENTLY_REVIEWED_DAYS = 7;

export function getProvenanceAge(entry: Provenance): number {
  return Date.now() - entry.createdAt.getTime();
}

export function getProvenanceAgeInDays(entry: Provenance): number {
  return Math.floor(getProvenanceAge(entry) / MS_PER_DAY);
}

export function getTimeSinceReview(entry: Provenance): number | null {
  if (!entry.reviewedAt) return null;
  return Date.now() - entry.reviewedAt.getTime();
}

export function isStale(entry: Provenance): boolean {
  return getProvenanceAgeInDays(entry) > STALE_THRESHOLD_DAYS && isUnreviewed(entry);
}

export function isRecentlyReviewed(entry: Provenance): boolean {
  const timeSince = getTimeSinceReview(entry);
  if (timeSince === null) return false;
  return timeSince < RECENTLY_REVIEWED_DAYS * MS_PER_DAY;
}

// =============================================================================
// Value Functions — Scope
// =============================================================================

export function isFileLevel(entry: Provenance): boolean {
  return !entry.functionName;
}

export function isFunctionLevel(entry: Provenance): boolean {
  return !!entry.functionName;
}

export function hasLineRange(entry: Provenance): boolean {
  return (
    entry.lineStart !== null &&
    entry.lineStart !== undefined &&
    entry.lineEnd !== null &&
    entry.lineEnd !== undefined
  );
}

export function hasGitInfo(entry: Provenance): boolean {
  return !!entry.gitCommitHash;
}

export function hasAiModel(entry: Provenance): boolean {
  return !!entry.aiModel;
}

// =============================================================================
// Value Functions — Aggregation (operate on arrays)
// =============================================================================

export function calculateAiPercentage(entries: Provenance[]): number {
  if (entries.length === 0) return 0;
  const totalLines = entries.reduce((sum, e) => sum + e.linesOfCode, 0);
  if (totalLines === 0) return 0;
  const aiLines = entries
    .filter((e) => hasAiInvolvement(e))
    .reduce((sum, e) => sum + e.linesOfCode, 0);
  return (aiLines / totalLines) * 100;
}

export function calculateReviewCoverage(entries: Provenance[]): number {
  if (entries.length === 0) return 0;
  const reviewed = entries.filter((e) => !isUnreviewed(e)).length;
  return (reviewed / entries.length) * 100;
}

export function calculateHumanReviewCoverage(entries: Provenance[]): number {
  if (entries.length === 0) return 0;
  const humanReviewed = entries.filter((e) => isHumanReviewed(e)).length;
  return (humanReviewed / entries.length) * 100;
}

export function getEntriesByAuthorType(entries: Provenance[], type: AuthorType): Provenance[] {
  return entries.filter((e) => e.authorType === type);
}

export function getUnreviewedEntries(entries: Provenance[]): Provenance[] {
  return entries.filter(isUnreviewed);
}

export function getEntriesNeedingHumanReview(entries: Provenance[]): Provenance[] {
  return entries.filter(needsHumanReview);
}

interface PackageSummary {
  packageName: string;
  totalEntries: number;
  totalLines: number;
  aiPercentage: number;
  reviewCoverage: number;
  humanReviewCoverage: number;
}

export function summarizeByPackage(entries: Provenance[]): Map<string, PackageSummary> {
  const grouped = new Map<string, Provenance[]>();

  for (const entry of entries) {
    // Extract package name from filePath (e.g. "packages/core/src/foo.ts" → "packages/core")
    const parts = entry.filePath.split('/');
    const packageName =
      parts[0] === 'packages' && parts.length >= 2
        ? `${parts[0]}/${parts[1]}`
        : parts[0] === 'apps' && parts.length >= 2
          ? `${parts[0]}/${parts[1]}`
          : (parts[0] ?? 'root');

    const existing = grouped.get(packageName);
    if (existing) {
      existing.push(entry);
    } else {
      grouped.set(packageName, [entry]);
    }
  }

  const result = new Map<string, PackageSummary>();

  for (const [packageName, packageEntries] of grouped) {
    result.set(packageName, {
      packageName,
      totalEntries: packageEntries.length,
      totalLines: packageEntries.reduce((sum, e) => sum + e.linesOfCode, 0),
      aiPercentage: calculateAiPercentage(packageEntries),
      reviewCoverage: calculateReviewCoverage(packageEntries),
      humanReviewCoverage: calculateHumanReviewCoverage(packageEntries),
    });
  }

  return result;
}

// =============================================================================
// Computed View
// =============================================================================

export interface ProvenanceWithComputed extends Provenance {
  _computed: {
    isAiGenerated: boolean;
    isHumanWritten: boolean;
    isAiAssisted: boolean;
    hasAiInvolvement: boolean;
    isUnreviewed: boolean;
    isHumanReviewed: boolean;
    needsReview: boolean;
    needsHumanReview: boolean;
    isHighConfidence: boolean;
    isStale: boolean;
    ageInDays: number;
    timeSinceReview: number | null;
    authorTypeLabel: string;
    reviewStatusLabel: string;
    confidenceLabel: string;
  };
}

export function provenanceToHuman(entry: Provenance): ProvenanceWithComputed {
  return {
    ...entry,
    _computed: {
      isAiGenerated: isAiGenerated(entry),
      isHumanWritten: isHumanWritten(entry),
      isAiAssisted: isAiAssisted(entry),
      hasAiInvolvement: hasAiInvolvement(entry),
      isUnreviewed: isUnreviewed(entry),
      isHumanReviewed: isHumanReviewed(entry),
      needsReview: needsReview(entry),
      needsHumanReview: needsHumanReview(entry),
      isHighConfidence: isHighConfidence(entry),
      isStale: isStale(entry),
      ageInDays: getProvenanceAgeInDays(entry),
      timeSinceReview: getTimeSinceReview(entry),
      authorTypeLabel: getAuthorTypeLabel(entry.authorType),
      reviewStatusLabel: getReviewStatusLabel(entry.reviewStatus),
      confidenceLabel: getConfidenceLabel(entry),
    },
  };
}

// =============================================================================
// Factory Functions
// =============================================================================

export function createProvenanceInsert(
  filePath: string,
  authorType: AuthorType,
  options?: {
    id?: string;
    functionName?: string;
    lineStart?: number;
    lineEnd?: number;
    aiModel?: string;
    aiSessionId?: string;
    gitCommitHash?: string;
    gitAuthor?: string;
    confidence?: number;
    linesOfCode?: number;
    metadata?: unknown;
  },
): ProvenanceInsert {
  const now = new Date();
  return {
    id: options?.id ?? crypto.randomUUID(),
    schemaVersion: String(PROVENANCE_SCHEMA_VERSION),
    filePath,
    functionName: options?.functionName ?? null,
    lineStart: options?.lineStart ?? null,
    lineEnd: options?.lineEnd ?? null,
    authorType,
    aiModel: options?.aiModel ?? null,
    aiSessionId: options?.aiSessionId ?? null,
    gitCommitHash: options?.gitCommitHash ?? null,
    gitAuthor: options?.gitAuthor ?? null,
    confidence: options?.confidence ?? 1.0,
    reviewStatus: 'unreviewed',
    reviewedBy: null,
    reviewedAt: null,
    linesOfCode: options?.linesOfCode ?? 0,
    metadata: options?.metadata ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

export function createCodeReviewInsert(
  provenanceId: string,
  reviewType: ReviewType,
  status: ReviewDecision,
  options?: {
    id?: string;
    reviewerId?: string;
    comment?: string;
    metadata?: unknown;
  },
): CodeReviewInsert {
  return {
    id: options?.id ?? crypto.randomUUID(),
    provenanceId,
    reviewerId: options?.reviewerId ?? null,
    reviewType,
    status,
    comment: options?.comment ?? null,
    metadata: options?.metadata ?? null,
    createdAt: new Date(),
  };
}
