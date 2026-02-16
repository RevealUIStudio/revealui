import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AUTHOR_TYPES,
  type AuthorType,
  type CodeReview,
  CodeReviewSchema,
  // Aggregation functions
  calculateAiPercentage,
  calculateHumanReviewCoverage,
  calculateReviewCoverage,
  createCodeReviewInsert,
  // Factory functions
  createProvenanceInsert,
  getAuthorTypeLabel,
  getConfidenceLabel,
  getEntriesByAuthorType,
  getEntriesNeedingHumanReview,
  // Time-based functions
  getProvenanceAge,
  getProvenanceAgeInDays,
  getReviewStatusLabel,
  getTimeSinceReview,
  getUnreviewedEntries,
  hasAiInvolvement,
  hasAiModel,
  hasGitInfo,
  hasLineRange,
  isAiAssisted,
  // Author type predicates
  isAiGenerated,
  isAiReviewed,
  // Scope predicates
  isFileLevel,
  isFullyReviewed,
  isFunctionLevel,
  // Confidence predicates
  isHighConfidence,
  isHumanReviewed,
  isHumanWritten,
  isLowConfidence,
  isMixedAuthorship,
  isRecentlyReviewed,
  isStale,
  // Review status predicates
  isUnreviewed,
  needsHumanReview,
  needsReview,
  PROVENANCE_SCHEMA_VERSION,
  type Provenance,
  ProvenanceSchema,
  // Computed view
  provenanceToHuman,
  REVIEW_DECISIONS,
  REVIEW_STATUSES,
  REVIEW_TYPES,
  summarizeByPackage,
} from '../../entities/code-provenance.js'

// =============================================================================
// Test Helpers
// =============================================================================

const NOW = new Date('2025-06-15T12:00:00Z')

function createMockProvenance(overrides?: Partial<Provenance>): Provenance {
  return {
    id: 'prov-1',
    schemaVersion: String(PROVENANCE_SCHEMA_VERSION),
    filePath: 'packages/core/src/parser.ts',
    functionName: null,
    lineStart: null,
    lineEnd: null,
    authorType: 'ai_generated',
    aiModel: null,
    aiSessionId: null,
    gitCommitHash: null,
    gitAuthor: null,
    confidence: 1.0,
    reviewStatus: 'unreviewed',
    reviewedBy: null,
    reviewedAt: null,
    linesOfCode: 100,
    metadata: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

function createMockCodeReview(overrides?: Partial<CodeReview>): CodeReview {
  return {
    id: 'review-1',
    provenanceId: 'prov-1',
    reviewerId: 'user-1',
    reviewType: 'human_review',
    status: 'approved',
    comment: null,
    metadata: null,
    createdAt: NOW,
    ...overrides,
  }
}

// =============================================================================
// Tests
// =============================================================================

describe('Code Provenance Entity', () => {
  // ===========================================================================
  // Author Type Predicates
  // ===========================================================================

  describe('Author Type Predicates', () => {
    describe('isAiGenerated', () => {
      it('returns true for ai_generated', () => {
        expect(isAiGenerated(createMockProvenance({ authorType: 'ai_generated' }))).toBe(true)
      })

      it('returns false for other types', () => {
        expect(isAiGenerated(createMockProvenance({ authorType: 'human_written' }))).toBe(false)
        expect(isAiGenerated(createMockProvenance({ authorType: 'ai_assisted' }))).toBe(false)
        expect(isAiGenerated(createMockProvenance({ authorType: 'mixed' }))).toBe(false)
      })
    })

    describe('isHumanWritten', () => {
      it('returns true for human_written', () => {
        expect(isHumanWritten(createMockProvenance({ authorType: 'human_written' }))).toBe(true)
      })

      it('returns false for other types', () => {
        expect(isHumanWritten(createMockProvenance({ authorType: 'ai_generated' }))).toBe(false)
        expect(isHumanWritten(createMockProvenance({ authorType: 'ai_assisted' }))).toBe(false)
        expect(isHumanWritten(createMockProvenance({ authorType: 'mixed' }))).toBe(false)
      })
    })

    describe('isAiAssisted', () => {
      it('returns true for ai_assisted', () => {
        expect(isAiAssisted(createMockProvenance({ authorType: 'ai_assisted' }))).toBe(true)
      })

      it('returns false for other types', () => {
        expect(isAiAssisted(createMockProvenance({ authorType: 'ai_generated' }))).toBe(false)
        expect(isAiAssisted(createMockProvenance({ authorType: 'human_written' }))).toBe(false)
      })
    })

    describe('isMixedAuthorship', () => {
      it('returns true for mixed', () => {
        expect(isMixedAuthorship(createMockProvenance({ authorType: 'mixed' }))).toBe(true)
      })

      it('returns false for other types', () => {
        expect(isMixedAuthorship(createMockProvenance({ authorType: 'ai_generated' }))).toBe(false)
        expect(isMixedAuthorship(createMockProvenance({ authorType: 'human_written' }))).toBe(false)
      })
    })

    describe('hasAiInvolvement', () => {
      it('returns true for ai_generated, ai_assisted, and mixed', () => {
        expect(hasAiInvolvement(createMockProvenance({ authorType: 'ai_generated' }))).toBe(true)
        expect(hasAiInvolvement(createMockProvenance({ authorType: 'ai_assisted' }))).toBe(true)
        expect(hasAiInvolvement(createMockProvenance({ authorType: 'mixed' }))).toBe(true)
      })

      it('returns false for human_written', () => {
        expect(hasAiInvolvement(createMockProvenance({ authorType: 'human_written' }))).toBe(false)
      })
    })

    describe('getAuthorTypeLabel', () => {
      it('returns human-readable labels for all types', () => {
        expect(getAuthorTypeLabel('ai_generated')).toBe('AI Generated')
        expect(getAuthorTypeLabel('human_written')).toBe('Human Written')
        expect(getAuthorTypeLabel('ai_assisted')).toBe('AI Assisted')
        expect(getAuthorTypeLabel('mixed')).toBe('Mixed')
      })
    })
  })

  // ===========================================================================
  // Review Status Predicates
  // ===========================================================================

  describe('Review Status Predicates', () => {
    describe('isUnreviewed', () => {
      it('returns true for unreviewed', () => {
        expect(isUnreviewed(createMockProvenance({ reviewStatus: 'unreviewed' }))).toBe(true)
      })

      it('returns false for reviewed entries', () => {
        expect(isUnreviewed(createMockProvenance({ reviewStatus: 'human_reviewed' }))).toBe(false)
        expect(isUnreviewed(createMockProvenance({ reviewStatus: 'ai_reviewed' }))).toBe(false)
        expect(isUnreviewed(createMockProvenance({ reviewStatus: 'human_and_ai_reviewed' }))).toBe(
          false,
        )
      })
    })

    describe('isHumanReviewed', () => {
      it('returns true for human_reviewed and human_and_ai_reviewed', () => {
        expect(isHumanReviewed(createMockProvenance({ reviewStatus: 'human_reviewed' }))).toBe(true)
        expect(
          isHumanReviewed(createMockProvenance({ reviewStatus: 'human_and_ai_reviewed' })),
        ).toBe(true)
      })

      it('returns false for unreviewed and ai_reviewed', () => {
        expect(isHumanReviewed(createMockProvenance({ reviewStatus: 'unreviewed' }))).toBe(false)
        expect(isHumanReviewed(createMockProvenance({ reviewStatus: 'ai_reviewed' }))).toBe(false)
      })
    })

    describe('isAiReviewed', () => {
      it('returns true for ai_reviewed and human_and_ai_reviewed', () => {
        expect(isAiReviewed(createMockProvenance({ reviewStatus: 'ai_reviewed' }))).toBe(true)
        expect(isAiReviewed(createMockProvenance({ reviewStatus: 'human_and_ai_reviewed' }))).toBe(
          true,
        )
      })

      it('returns false for unreviewed and human_reviewed', () => {
        expect(isAiReviewed(createMockProvenance({ reviewStatus: 'unreviewed' }))).toBe(false)
        expect(isAiReviewed(createMockProvenance({ reviewStatus: 'human_reviewed' }))).toBe(false)
      })
    })

    describe('isFullyReviewed', () => {
      it('returns true only for human_and_ai_reviewed', () => {
        expect(
          isFullyReviewed(createMockProvenance({ reviewStatus: 'human_and_ai_reviewed' })),
        ).toBe(true)
      })

      it('returns false for other statuses', () => {
        expect(isFullyReviewed(createMockProvenance({ reviewStatus: 'unreviewed' }))).toBe(false)
        expect(isFullyReviewed(createMockProvenance({ reviewStatus: 'human_reviewed' }))).toBe(
          false,
        )
        expect(isFullyReviewed(createMockProvenance({ reviewStatus: 'ai_reviewed' }))).toBe(false)
      })
    })

    describe('needsReview', () => {
      it('returns true for unreviewed AI-involved code', () => {
        expect(
          needsReview(
            createMockProvenance({ authorType: 'ai_generated', reviewStatus: 'unreviewed' }),
          ),
        ).toBe(true)
        expect(
          needsReview(
            createMockProvenance({ authorType: 'ai_assisted', reviewStatus: 'unreviewed' }),
          ),
        ).toBe(true)
        expect(
          needsReview(createMockProvenance({ authorType: 'mixed', reviewStatus: 'unreviewed' })),
        ).toBe(true)
      })

      it('returns false for human-written code even if unreviewed', () => {
        expect(
          needsReview(
            createMockProvenance({ authorType: 'human_written', reviewStatus: 'unreviewed' }),
          ),
        ).toBe(false)
      })

      it('returns false for already-reviewed AI code', () => {
        expect(
          needsReview(
            createMockProvenance({ authorType: 'ai_generated', reviewStatus: 'human_reviewed' }),
          ),
        ).toBe(false)
      })
    })

    describe('needsHumanReview', () => {
      it('returns true for AI-involved code without human review', () => {
        expect(
          needsHumanReview(
            createMockProvenance({ authorType: 'ai_generated', reviewStatus: 'unreviewed' }),
          ),
        ).toBe(true)
        expect(
          needsHumanReview(
            createMockProvenance({ authorType: 'ai_generated', reviewStatus: 'ai_reviewed' }),
          ),
        ).toBe(true)
      })

      it('returns false for human-written code', () => {
        expect(
          needsHumanReview(
            createMockProvenance({ authorType: 'human_written', reviewStatus: 'unreviewed' }),
          ),
        ).toBe(false)
      })

      it('returns false for human-reviewed AI code', () => {
        expect(
          needsHumanReview(
            createMockProvenance({ authorType: 'ai_generated', reviewStatus: 'human_reviewed' }),
          ),
        ).toBe(false)
        expect(
          needsHumanReview(
            createMockProvenance({
              authorType: 'ai_generated',
              reviewStatus: 'human_and_ai_reviewed',
            }),
          ),
        ).toBe(false)
      })
    })

    describe('getReviewStatusLabel', () => {
      it('returns human-readable labels for all statuses', () => {
        expect(getReviewStatusLabel('unreviewed')).toBe('Unreviewed')
        expect(getReviewStatusLabel('human_reviewed')).toBe('Human Reviewed')
        expect(getReviewStatusLabel('ai_reviewed')).toBe('AI Reviewed')
        expect(getReviewStatusLabel('human_and_ai_reviewed')).toBe('Human & AI Reviewed')
      })
    })
  })

  // ===========================================================================
  // Confidence & Quality
  // ===========================================================================

  describe('Confidence & Quality', () => {
    describe('isHighConfidence', () => {
      it('returns true for confidence >= 0.8', () => {
        expect(isHighConfidence(createMockProvenance({ confidence: 0.8 }))).toBe(true)
        expect(isHighConfidence(createMockProvenance({ confidence: 1.0 }))).toBe(true)
        expect(isHighConfidence(createMockProvenance({ confidence: 0.95 }))).toBe(true)
      })

      it('returns false for confidence < 0.8', () => {
        expect(isHighConfidence(createMockProvenance({ confidence: 0.79 }))).toBe(false)
        expect(isHighConfidence(createMockProvenance({ confidence: 0.5 }))).toBe(false)
        expect(isHighConfidence(createMockProvenance({ confidence: 0 }))).toBe(false)
      })
    })

    describe('isLowConfidence', () => {
      it('returns true for confidence < 0.5', () => {
        expect(isLowConfidence(createMockProvenance({ confidence: 0.49 }))).toBe(true)
        expect(isLowConfidence(createMockProvenance({ confidence: 0 }))).toBe(true)
        expect(isLowConfidence(createMockProvenance({ confidence: 0.1 }))).toBe(true)
      })

      it('returns false for confidence >= 0.5', () => {
        expect(isLowConfidence(createMockProvenance({ confidence: 0.5 }))).toBe(false)
        expect(isLowConfidence(createMockProvenance({ confidence: 0.8 }))).toBe(false)
        expect(isLowConfidence(createMockProvenance({ confidence: 1.0 }))).toBe(false)
      })
    })

    describe('getConfidenceLabel', () => {
      it('returns "High" for confidence >= 0.8', () => {
        expect(getConfidenceLabel(createMockProvenance({ confidence: 0.8 }))).toBe('High')
        expect(getConfidenceLabel(createMockProvenance({ confidence: 1.0 }))).toBe('High')
      })

      it('returns "Medium" for confidence >= 0.5 and < 0.8', () => {
        expect(getConfidenceLabel(createMockProvenance({ confidence: 0.5 }))).toBe('Medium')
        expect(getConfidenceLabel(createMockProvenance({ confidence: 0.79 }))).toBe('Medium')
      })

      it('returns "Low" for confidence < 0.5', () => {
        expect(getConfidenceLabel(createMockProvenance({ confidence: 0.49 }))).toBe('Low')
        expect(getConfidenceLabel(createMockProvenance({ confidence: 0 }))).toBe('Low')
      })
    })
  })

  // ===========================================================================
  // Time-based Functions
  // ===========================================================================

  describe('Time-based Functions', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2025-06-15T12:00:00Z'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    describe('getProvenanceAge', () => {
      it('returns age in milliseconds', () => {
        const entry = createMockProvenance({
          createdAt: new Date('2025-06-14T12:00:00Z'), // 1 day ago
        })
        expect(getProvenanceAge(entry)).toBe(24 * 60 * 60 * 1000)
      })

      it('returns 0 for entries created now', () => {
        const entry = createMockProvenance({
          createdAt: new Date('2025-06-15T12:00:00Z'),
        })
        expect(getProvenanceAge(entry)).toBe(0)
      })
    })

    describe('getProvenanceAgeInDays', () => {
      it('returns age in whole days', () => {
        const entry = createMockProvenance({
          createdAt: new Date('2025-06-10T12:00:00Z'), // 5 days ago
        })
        expect(getProvenanceAgeInDays(entry)).toBe(5)
      })

      it('floors partial days', () => {
        const entry = createMockProvenance({
          createdAt: new Date('2025-06-14T18:00:00Z'), // 0.75 days ago
        })
        expect(getProvenanceAgeInDays(entry)).toBe(0)
      })
    })

    describe('getTimeSinceReview', () => {
      it('returns null when reviewedAt is null', () => {
        const entry = createMockProvenance({ reviewedAt: null })
        expect(getTimeSinceReview(entry)).toBeNull()
      })

      it('returns time in milliseconds since review', () => {
        const entry = createMockProvenance({
          reviewedAt: new Date('2025-06-14T12:00:00Z'), // 1 day ago
        })
        expect(getTimeSinceReview(entry)).toBe(24 * 60 * 60 * 1000)
      })
    })

    describe('isStale', () => {
      it('returns true for unreviewed entries older than 90 days', () => {
        const entry = createMockProvenance({
          createdAt: new Date('2025-03-01T12:00:00Z'), // ~106 days ago
          reviewStatus: 'unreviewed',
        })
        expect(isStale(entry)).toBe(true)
      })

      it('returns false for unreviewed entries within 90 days', () => {
        const entry = createMockProvenance({
          createdAt: new Date('2025-06-01T12:00:00Z'), // 14 days ago
          reviewStatus: 'unreviewed',
        })
        expect(isStale(entry)).toBe(false)
      })

      it('returns false for reviewed entries even if old', () => {
        const entry = createMockProvenance({
          createdAt: new Date('2025-01-01T12:00:00Z'), // ~165 days ago
          reviewStatus: 'human_reviewed',
        })
        expect(isStale(entry)).toBe(false)
      })
    })

    describe('isRecentlyReviewed', () => {
      it('returns true when reviewed within 7 days', () => {
        const entry = createMockProvenance({
          reviewedAt: new Date('2025-06-14T12:00:00Z'), // 1 day ago
        })
        expect(isRecentlyReviewed(entry)).toBe(true)
      })

      it('returns false when reviewed more than 7 days ago', () => {
        const entry = createMockProvenance({
          reviewedAt: new Date('2025-06-01T12:00:00Z'), // 14 days ago
        })
        expect(isRecentlyReviewed(entry)).toBe(false)
      })

      it('returns false when never reviewed', () => {
        const entry = createMockProvenance({ reviewedAt: null })
        expect(isRecentlyReviewed(entry)).toBe(false)
      })
    })
  })

  // ===========================================================================
  // Scope Predicates
  // ===========================================================================

  describe('Scope Predicates', () => {
    describe('isFileLevel', () => {
      it('returns true when no function name', () => {
        expect(isFileLevel(createMockProvenance({ functionName: null }))).toBe(true)
        expect(isFileLevel(createMockProvenance({ functionName: undefined }))).toBe(true)
      })

      it('returns false when function name is set', () => {
        expect(isFileLevel(createMockProvenance({ functionName: 'parseToken' }))).toBe(false)
      })
    })

    describe('isFunctionLevel', () => {
      it('returns true when function name is set', () => {
        expect(isFunctionLevel(createMockProvenance({ functionName: 'parseToken' }))).toBe(true)
      })

      it('returns false when no function name', () => {
        expect(isFunctionLevel(createMockProvenance({ functionName: null }))).toBe(false)
      })
    })

    describe('hasLineRange', () => {
      it('returns true when both lineStart and lineEnd are set', () => {
        expect(hasLineRange(createMockProvenance({ lineStart: 1, lineEnd: 50 }))).toBe(true)
      })

      it('returns false when lineStart or lineEnd is null', () => {
        expect(hasLineRange(createMockProvenance({ lineStart: null, lineEnd: 50 }))).toBe(false)
        expect(hasLineRange(createMockProvenance({ lineStart: 1, lineEnd: null }))).toBe(false)
        expect(hasLineRange(createMockProvenance({ lineStart: null, lineEnd: null }))).toBe(false)
      })

      it('returns false when lineStart or lineEnd is undefined', () => {
        expect(hasLineRange(createMockProvenance({ lineStart: undefined, lineEnd: 50 }))).toBe(
          false,
        )
      })
    })

    describe('hasGitInfo', () => {
      it('returns true when gitCommitHash is set', () => {
        expect(hasGitInfo(createMockProvenance({ gitCommitHash: 'abc123' }))).toBe(true)
      })

      it('returns false when gitCommitHash is null', () => {
        expect(hasGitInfo(createMockProvenance({ gitCommitHash: null }))).toBe(false)
      })
    })

    describe('hasAiModel', () => {
      it('returns true when aiModel is set', () => {
        expect(hasAiModel(createMockProvenance({ aiModel: 'claude-opus-4' }))).toBe(true)
      })

      it('returns false when aiModel is null', () => {
        expect(hasAiModel(createMockProvenance({ aiModel: null }))).toBe(false)
      })
    })
  })

  // ===========================================================================
  // Aggregation Functions
  // ===========================================================================

  describe('Aggregation Functions', () => {
    describe('calculateAiPercentage', () => {
      it('returns 0 for empty array', () => {
        expect(calculateAiPercentage([])).toBe(0)
      })

      it('returns 0 when all entries have 0 lines of code', () => {
        const entries = [createMockProvenance({ linesOfCode: 0 })]
        expect(calculateAiPercentage(entries)).toBe(0)
      })

      it('returns 100 when all code is AI-involved', () => {
        const entries = [
          createMockProvenance({ authorType: 'ai_generated', linesOfCode: 100 }),
          createMockProvenance({ authorType: 'ai_assisted', linesOfCode: 50 }),
        ]
        expect(calculateAiPercentage(entries)).toBe(100)
      })

      it('returns 0 when all code is human-written', () => {
        const entries = [
          createMockProvenance({ authorType: 'human_written', linesOfCode: 100 }),
          createMockProvenance({ authorType: 'human_written', linesOfCode: 50 }),
        ]
        expect(calculateAiPercentage(entries)).toBe(0)
      })

      it('calculates correct percentage for mixed entries', () => {
        const entries = [
          createMockProvenance({ authorType: 'ai_generated', linesOfCode: 50 }),
          createMockProvenance({ authorType: 'human_written', linesOfCode: 50 }),
        ]
        expect(calculateAiPercentage(entries)).toBe(50)
      })
    })

    describe('calculateReviewCoverage', () => {
      it('returns 0 for empty array', () => {
        expect(calculateReviewCoverage([])).toBe(0)
      })

      it('returns 100 when all entries are reviewed', () => {
        const entries = [
          createMockProvenance({ reviewStatus: 'human_reviewed' }),
          createMockProvenance({ reviewStatus: 'ai_reviewed' }),
        ]
        expect(calculateReviewCoverage(entries)).toBe(100)
      })

      it('returns 0 when no entries are reviewed', () => {
        const entries = [
          createMockProvenance({ reviewStatus: 'unreviewed' }),
          createMockProvenance({ reviewStatus: 'unreviewed' }),
        ]
        expect(calculateReviewCoverage(entries)).toBe(0)
      })

      it('calculates correct percentage for mixed review status', () => {
        const entries = [
          createMockProvenance({ reviewStatus: 'human_reviewed' }),
          createMockProvenance({ reviewStatus: 'unreviewed' }),
        ]
        expect(calculateReviewCoverage(entries)).toBe(50)
      })
    })

    describe('calculateHumanReviewCoverage', () => {
      it('returns 0 for empty array', () => {
        expect(calculateHumanReviewCoverage([])).toBe(0)
      })

      it('counts human_reviewed and human_and_ai_reviewed', () => {
        const entries = [
          createMockProvenance({ reviewStatus: 'human_reviewed' }),
          createMockProvenance({ reviewStatus: 'human_and_ai_reviewed' }),
          createMockProvenance({ reviewStatus: 'ai_reviewed' }),
        ]
        // 2 out of 3 have human review
        expect(calculateHumanReviewCoverage(entries)).toBeCloseTo(66.67, 1)
      })
    })

    describe('getEntriesByAuthorType', () => {
      it('filters entries by author type', () => {
        const entries = [
          createMockProvenance({ id: '1', authorType: 'ai_generated' }),
          createMockProvenance({ id: '2', authorType: 'human_written' }),
          createMockProvenance({ id: '3', authorType: 'ai_generated' }),
        ]
        const result = getEntriesByAuthorType(entries, 'ai_generated')
        expect(result).toHaveLength(2)
        expect(result[0]?.id).toBe('1')
        expect(result[1]?.id).toBe('3')
      })

      it('returns empty array when no matches', () => {
        const entries = [createMockProvenance({ authorType: 'human_written' })]
        expect(getEntriesByAuthorType(entries, 'ai_generated')).toHaveLength(0)
      })
    })

    describe('getUnreviewedEntries', () => {
      it('returns only unreviewed entries', () => {
        const entries = [
          createMockProvenance({ id: '1', reviewStatus: 'unreviewed' }),
          createMockProvenance({ id: '2', reviewStatus: 'human_reviewed' }),
          createMockProvenance({ id: '3', reviewStatus: 'unreviewed' }),
        ]
        const result = getUnreviewedEntries(entries)
        expect(result).toHaveLength(2)
        expect(result[0]?.id).toBe('1')
        expect(result[1]?.id).toBe('3')
      })
    })

    describe('getEntriesNeedingHumanReview', () => {
      it('returns AI-involved entries without human review', () => {
        const entries = [
          createMockProvenance({
            id: '1',
            authorType: 'ai_generated',
            reviewStatus: 'unreviewed',
          }),
          createMockProvenance({
            id: '2',
            authorType: 'ai_generated',
            reviewStatus: 'human_reviewed',
          }),
          createMockProvenance({
            id: '3',
            authorType: 'human_written',
            reviewStatus: 'unreviewed',
          }),
          createMockProvenance({
            id: '4',
            authorType: 'ai_assisted',
            reviewStatus: 'ai_reviewed',
          }),
        ]
        const result = getEntriesNeedingHumanReview(entries)
        expect(result).toHaveLength(2)
        expect(result[0]?.id).toBe('1')
        expect(result[1]?.id).toBe('4')
      })
    })

    describe('summarizeByPackage', () => {
      it('groups entries by package name', () => {
        const entries = [
          createMockProvenance({
            filePath: 'packages/core/src/parser.ts',
            authorType: 'ai_generated',
            linesOfCode: 100,
            reviewStatus: 'human_reviewed',
          }),
          createMockProvenance({
            filePath: 'packages/core/src/utils.ts',
            authorType: 'human_written',
            linesOfCode: 50,
            reviewStatus: 'unreviewed',
          }),
          createMockProvenance({
            filePath: 'packages/db/src/client.ts',
            authorType: 'ai_generated',
            linesOfCode: 200,
            reviewStatus: 'unreviewed',
          }),
        ]

        const result = summarizeByPackage(entries)
        expect(result.size).toBe(2)

        const core = result.get('packages/core')
        expect(core).toBeDefined()
        expect(core?.totalEntries).toBe(2)
        expect(core?.totalLines).toBe(150)
        expect(core?.reviewCoverage).toBe(50)

        const db = result.get('packages/db')
        expect(db).toBeDefined()
        expect(db?.totalEntries).toBe(1)
        expect(db?.totalLines).toBe(200)
        expect(db?.aiPercentage).toBe(100)
      })

      it('handles apps directory', () => {
        const entries = [
          createMockProvenance({ filePath: 'apps/web/src/page.tsx', linesOfCode: 100 }),
        ]
        const result = summarizeByPackage(entries)
        expect(result.has('apps/web')).toBe(true)
      })

      it('handles root-level files', () => {
        const entries = [createMockProvenance({ filePath: 'tsconfig.json', linesOfCode: 10 })]
        const result = summarizeByPackage(entries)
        expect(result.has('tsconfig.json')).toBe(true)
      })

      it('returns empty map for empty array', () => {
        expect(summarizeByPackage([]).size).toBe(0)
      })
    })
  })

  // ===========================================================================
  // Computed View
  // ===========================================================================

  describe('Computed View', () => {
    describe('provenanceToHuman', () => {
      beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2025-06-15T12:00:00Z'))
      })

      afterEach(() => {
        vi.useRealTimers()
      })

      it('computes all fields correctly for AI-generated unreviewed entry', () => {
        const entry = createMockProvenance({
          authorType: 'ai_generated',
          reviewStatus: 'unreviewed',
          confidence: 0.9,
          createdAt: new Date('2025-06-10T12:00:00Z'),
          reviewedAt: null,
        })

        const result = provenanceToHuman(entry)
        expect(result._computed.isAiGenerated).toBe(true)
        expect(result._computed.isHumanWritten).toBe(false)
        expect(result._computed.isAiAssisted).toBe(false)
        expect(result._computed.hasAiInvolvement).toBe(true)
        expect(result._computed.isUnreviewed).toBe(true)
        expect(result._computed.isHumanReviewed).toBe(false)
        expect(result._computed.needsReview).toBe(true)
        expect(result._computed.needsHumanReview).toBe(true)
        expect(result._computed.isHighConfidence).toBe(true)
        expect(result._computed.isStale).toBe(false)
        expect(result._computed.ageInDays).toBe(5)
        expect(result._computed.timeSinceReview).toBeNull()
        expect(result._computed.authorTypeLabel).toBe('AI Generated')
        expect(result._computed.reviewStatusLabel).toBe('Unreviewed')
        expect(result._computed.confidenceLabel).toBe('High')
      })

      it('preserves original entry properties', () => {
        const entry = createMockProvenance({ id: 'test-id', filePath: 'src/foo.ts' })
        const result = provenanceToHuman(entry)
        expect(result.id).toBe('test-id')
        expect(result.filePath).toBe('src/foo.ts')
      })
    })
  })

  // ===========================================================================
  // Factory Functions
  // ===========================================================================

  describe('Factory Functions', () => {
    describe('createProvenanceInsert', () => {
      it('creates a minimal insert with defaults', () => {
        const insert = createProvenanceInsert('src/index.ts', 'ai_generated')
        expect(insert.filePath).toBe('src/index.ts')
        expect(insert.authorType).toBe('ai_generated')
        expect(insert.id).toBeDefined()
        expect(insert.schemaVersion).toBe(String(PROVENANCE_SCHEMA_VERSION))
        expect(insert.confidence).toBe(1.0)
        expect(insert.reviewStatus).toBe('unreviewed')
        expect(insert.functionName).toBeNull()
        expect(insert.lineStart).toBeNull()
        expect(insert.lineEnd).toBeNull()
        expect(insert.aiModel).toBeNull()
        expect(insert.linesOfCode).toBe(0)
      })

      it('applies all options', () => {
        const insert = createProvenanceInsert('src/parser.ts', 'ai_assisted', {
          id: 'custom-id',
          functionName: 'parseToken',
          lineStart: 10,
          lineEnd: 50,
          aiModel: 'claude-opus-4',
          aiSessionId: 'session-1',
          gitCommitHash: 'abc123',
          gitAuthor: 'dev@example.com',
          confidence: 0.85,
          linesOfCode: 40,
          metadata: { tool: 'copilot' },
        })

        expect(insert.id).toBe('custom-id')
        expect(insert.functionName).toBe('parseToken')
        expect(insert.lineStart).toBe(10)
        expect(insert.lineEnd).toBe(50)
        expect(insert.aiModel).toBe('claude-opus-4')
        expect(insert.aiSessionId).toBe('session-1')
        expect(insert.gitCommitHash).toBe('abc123')
        expect(insert.gitAuthor).toBe('dev@example.com')
        expect(insert.confidence).toBe(0.85)
        expect(insert.linesOfCode).toBe(40)
        expect(insert.metadata).toEqual({ tool: 'copilot' })
      })

      it('sets createdAt and updatedAt', () => {
        const insert = createProvenanceInsert('src/index.ts', 'human_written')
        expect(insert.createdAt).toBeInstanceOf(Date)
        expect(insert.updatedAt).toBeInstanceOf(Date)
      })
    })

    describe('createCodeReviewInsert', () => {
      it('creates a minimal review insert with defaults', () => {
        const insert = createCodeReviewInsert('prov-1', 'human_review', 'approved')
        expect(insert.provenanceId).toBe('prov-1')
        expect(insert.reviewType).toBe('human_review')
        expect(insert.status).toBe('approved')
        expect(insert.id).toBeDefined()
        expect(insert.reviewerId).toBeNull()
        expect(insert.comment).toBeNull()
        expect(insert.metadata).toBeNull()
        expect(insert.createdAt).toBeInstanceOf(Date)
      })

      it('applies all options', () => {
        const insert = createCodeReviewInsert('prov-2', 'ai_review', 'needs_changes', {
          id: 'review-custom',
          reviewerId: 'user-42',
          comment: 'Needs error handling',
          metadata: { severity: 'high' },
        })

        expect(insert.id).toBe('review-custom')
        expect(insert.reviewerId).toBe('user-42')
        expect(insert.comment).toBe('Needs error handling')
        expect(insert.metadata).toEqual({ severity: 'high' })
      })
    })
  })

  // ===========================================================================
  // Schema Validation
  // ===========================================================================

  describe('Schema Validation', () => {
    describe('ProvenanceSchema', () => {
      it('validates a valid provenance entry', () => {
        const result = ProvenanceSchema.safeParse(createMockProvenance())
        expect(result.success).toBe(true)
      })

      it('rejects missing required fields', () => {
        const result = ProvenanceSchema.safeParse({ id: 'prov-1' })
        expect(result.success).toBe(false)
      })

      it('rejects invalid authorType', () => {
        const result = ProvenanceSchema.safeParse(
          createMockProvenance({ authorType: 'invalid' as AuthorType }),
        )
        expect(result.success).toBe(false)
      })

      it('rejects confidence outside 0-1 range', () => {
        const tooHigh = ProvenanceSchema.safeParse(createMockProvenance({ confidence: 1.5 }))
        expect(tooHigh.success).toBe(false)

        const tooLow = ProvenanceSchema.safeParse(createMockProvenance({ confidence: -0.1 }))
        expect(tooLow.success).toBe(false)
      })

      it('rejects empty id', () => {
        const result = ProvenanceSchema.safeParse(createMockProvenance({ id: '' }))
        expect(result.success).toBe(false)
      })

      it('rejects empty filePath', () => {
        const result = ProvenanceSchema.safeParse(createMockProvenance({ filePath: '' }))
        expect(result.success).toBe(false)
      })
    })

    describe('CodeReviewSchema', () => {
      it('validates a valid code review', () => {
        const result = CodeReviewSchema.safeParse(createMockCodeReview())
        expect(result.success).toBe(true)
      })

      it('rejects missing required fields', () => {
        const result = CodeReviewSchema.safeParse({ id: 'review-1' })
        expect(result.success).toBe(false)
      })

      it('rejects invalid reviewType', () => {
        const result = CodeReviewSchema.safeParse(
          createMockCodeReview({ reviewType: 'invalid' as 'human_review' }),
        )
        expect(result.success).toBe(false)
      })

      it('rejects invalid status', () => {
        const result = CodeReviewSchema.safeParse(
          createMockCodeReview({ status: 'invalid' as 'approved' }),
        )
        expect(result.success).toBe(false)
      })
    })
  })

  // ===========================================================================
  // Constants
  // ===========================================================================

  describe('Constants', () => {
    it('exports valid AUTHOR_TYPES', () => {
      expect(AUTHOR_TYPES).toEqual(['ai_generated', 'human_written', 'ai_assisted', 'mixed'])
    })

    it('exports valid REVIEW_STATUSES', () => {
      expect(REVIEW_STATUSES).toEqual([
        'unreviewed',
        'human_reviewed',
        'ai_reviewed',
        'human_and_ai_reviewed',
      ])
    })

    it('exports valid REVIEW_TYPES', () => {
      expect(REVIEW_TYPES).toEqual(['human_review', 'ai_review', 'human_approval', 'ai_suggestion'])
    })

    it('exports valid REVIEW_DECISIONS', () => {
      expect(REVIEW_DECISIONS).toEqual(['approved', 'rejected', 'needs_changes', 'informational'])
    })
  })
})
