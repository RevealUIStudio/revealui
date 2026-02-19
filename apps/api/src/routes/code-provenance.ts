/**
 * Code Provenance API routes
 *
 * CRUD for provenance entries (file-level authorship tracking)
 * plus append-only code reviews and aggregate statistics.
 */

import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import type { DatabaseClient } from '@revealui/db/client'
import * as provenanceQueries from '@revealui/db/queries/code-provenance'

type Variables = {
  db: DatabaseClient
}

// biome-ignore lint/style/useNamingConvention: Hono requires Variables key
const app = new OpenAPIHono<{ Variables: Variables }>()

// =============================================================================
// Schema Definitions
// =============================================================================

const IdParam = z.object({
  id: z.string().openapi({
    param: { name: 'id', in: 'path' },
    example: '550e8400-e29b-41d4-a716-446655440000',
  }),
})

const FilePathParam = z.object({
  filePath: z.string().openapi({
    param: { name: 'filePath', in: 'path' },
    example: 'packages/core/src/index.ts',
  }),
})

const ErrorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
})

const ProvenanceSchema = z
  .object({
    id: z.string(),
    schemaVersion: z.string(),
    filePath: z.string(),
    functionName: z.string().nullable(),
    lineStart: z.number().nullable(),
    lineEnd: z.number().nullable(),
    authorType: z.string(),
    aiModel: z.string().nullable(),
    aiSessionId: z.string().nullable(),
    gitCommitHash: z.string().nullable(),
    gitAuthor: z.string().nullable(),
    confidence: z.number(),
    reviewStatus: z.string(),
    reviewedBy: z.string().nullable(),
    reviewedAt: z.string().nullable().openapi({ type: 'string', format: 'date-time' }),
    linesOfCode: z.number(),
    metadata: z.unknown().nullable(),
    createdAt: z.string().openapi({ type: 'string', format: 'date-time' }),
    updatedAt: z.string().openapi({ type: 'string', format: 'date-time' }),
  })
  .openapi('CodeProvenance')

const ReviewSchema = z
  .object({
    id: z.string(),
    provenanceId: z.string(),
    reviewerId: z.string().nullable(),
    reviewType: z.string(),
    status: z.string(),
    comment: z.string().nullable(),
    metadata: z.unknown().nullable(),
    createdAt: z.string().openapi({ type: 'string', format: 'date-time' }),
  })
  .openapi('CodeReview')

// =============================================================================
// Provenance Routes
// =============================================================================

// GET / — list all with filters
app.openapi(
  createRoute({
    method: 'get',
    path: '/',
    tags: ['provenance'],
    summary: 'List provenance entries',
    request: {
      query: z.object({
        authorType: z.string().optional().openapi({ example: 'ai_generated' }),
        reviewStatus: z.string().optional().openapi({ example: 'unreviewed' }),
        filePathPrefix: z.string().optional().openapi({ example: 'packages/core' }),
      }),
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: z.array(ProvenanceSchema) }),
          },
        },
        description: 'Provenance list',
      },
    },
  }),
  async (c) => {
    const db = c.get('db')
    const filters = c.req.valid('query')
    const entries = await provenanceQueries.getAllProvenance(db, filters)
    return c.json({ success: true as const, data: entries })
  },
)

// GET /stats — aggregate statistics
app.openapi(
  createRoute({
    method: 'get',
    path: '/stats',
    tags: ['provenance'],
    summary: 'Get provenance statistics',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              success: z.literal(true),
              data: z.object({
                byAuthorType: z.array(
                  z.object({
                    authorType: z.string(),
                    count: z.number(),
                    totalLines: z.number(),
                  }),
                ),
                byReviewStatus: z.array(
                  z.object({
                    reviewStatus: z.string(),
                    count: z.number(),
                  }),
                ),
              }),
            }),
          },
        },
        description: 'Provenance statistics',
      },
    },
  }),
  async (c) => {
    const db = c.get('db')
    const stats = await provenanceQueries.getProvenanceStats(db)
    return c.json({ success: true as const, data: stats })
  },
)

// GET /file/:filePath — provenance for a specific file
app.openapi(
  createRoute({
    method: 'get',
    path: '/file/{filePath}',
    tags: ['provenance'],
    summary: 'Get provenance for a specific file',
    request: { params: FilePathParam },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: z.array(ProvenanceSchema) }),
          },
        },
        description: 'File provenance',
      },
    },
  }),
  async (c) => {
    const db = c.get('db')
    const { filePath } = c.req.valid('param')
    const entries = await provenanceQueries.getProvenanceByFile(db, filePath)
    return c.json({ success: true as const, data: entries })
  },
)

// GET /:id — single entry
app.openapi(
  createRoute({
    method: 'get',
    path: '/{id}',
    tags: ['provenance'],
    summary: 'Get a provenance entry by ID',
    request: { params: IdParam },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: ProvenanceSchema }),
          },
        },
        description: 'Provenance entry found',
      },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not found' },
    },
  }),
  async (c) => {
    const db = c.get('db')
    const { id } = c.req.valid('param')
    const entry = await provenanceQueries.getProvenanceById(db, id)
    if (!entry) return c.json({ success: false as const, error: 'Provenance entry not found' }, 404)
    return c.json({ success: true as const, data: entry }, 200)
  },
)

// POST / — create entry
app.openapi(
  createRoute({
    method: 'post',
    path: '/',
    tags: ['provenance'],
    summary: 'Create a provenance entry',
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({
              filePath: z.string().min(1).max(1000),
              authorType: z.enum(['ai_generated', 'human_written', 'ai_assisted', 'mixed']),
              functionName: z.string().max(200).optional(),
              lineStart: z.number().int().min(0).optional(),
              lineEnd: z.number().int().min(0).optional(),
              aiModel: z.string().optional(),
              aiSessionId: z.string().optional(),
              gitCommitHash: z.string().optional(),
              gitAuthor: z.string().optional(),
              confidence: z.number().min(0).max(1).optional(),
              linesOfCode: z.number().int().min(0).optional(),
              metadata: z.record(z.string(), z.unknown()).optional(),
            }),
          },
        },
      },
    },
    responses: {
      201: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: ProvenanceSchema }),
          },
        },
        description: 'Provenance entry created',
      },
      500: {
        content: { 'application/json': { schema: ErrorSchema } },
        description: 'Server error',
      },
    },
  }),
  async (c) => {
    const db = c.get('db')
    const body = c.req.valid('json')
    const entry = await provenanceQueries.createProvenance(db, {
      id: crypto.randomUUID(),
      ...body,
    })
    if (!entry)
      return c.json({ success: false as const, error: 'Failed to create provenance entry' }, 500)
    return c.json({ success: true as const, data: entry }, 201)
  },
)

// PATCH /:id — update entry
app.openapi(
  createRoute({
    method: 'patch',
    path: '/{id}',
    tags: ['provenance'],
    summary: 'Update a provenance entry',
    request: {
      params: IdParam,
      body: {
        content: {
          'application/json': {
            schema: z.object({
              filePath: z.string().min(1).max(1000).optional(),
              functionName: z.string().max(200).nullable().optional(),
              lineStart: z.number().int().min(0).nullable().optional(),
              lineEnd: z.number().int().min(0).nullable().optional(),
              authorType: z
                .enum(['ai_generated', 'human_written', 'ai_assisted', 'mixed'])
                .optional(),
              aiModel: z.string().nullable().optional(),
              aiSessionId: z.string().nullable().optional(),
              gitCommitHash: z.string().nullable().optional(),
              gitAuthor: z.string().nullable().optional(),
              confidence: z.number().min(0).max(1).optional(),
              reviewStatus: z
                .enum(['unreviewed', 'human_reviewed', 'ai_reviewed', 'human_and_ai_reviewed'])
                .optional(),
              linesOfCode: z.number().int().min(0).optional(),
              metadata: z.record(z.string(), z.unknown()).optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: ProvenanceSchema }),
          },
        },
        description: 'Provenance entry updated',
      },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not found' },
    },
  }),
  async (c) => {
    const db = c.get('db')
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')
    const entry = await provenanceQueries.updateProvenance(db, id, body)
    if (!entry) return c.json({ success: false as const, error: 'Provenance entry not found' }, 404)
    return c.json({ success: true as const, data: entry }, 200)
  },
)

// DELETE /:id — delete entry
app.openapi(
  createRoute({
    method: 'delete',
    path: '/{id}',
    tags: ['provenance'],
    summary: 'Delete a provenance entry',
    request: { params: IdParam },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), message: z.string() }),
          },
        },
        description: 'Provenance entry deleted',
      },
    },
  }),
  async (c) => {
    const db = c.get('db')
    const { id } = c.req.valid('param')
    await provenanceQueries.deleteProvenance(db, id)
    return c.json({ success: true as const, message: 'Provenance entry deleted' })
  },
)

// =============================================================================
// Review Routes
// =============================================================================

// POST /:id/review — add review (append-only)
app.openapi(
  createRoute({
    method: 'post',
    path: '/{id}/review',
    tags: ['provenance'],
    summary: 'Add a review to a provenance entry',
    request: {
      params: IdParam,
      body: {
        content: {
          'application/json': {
            schema: z.object({
              reviewType: z.enum(['human_review', 'ai_review', 'human_approval', 'ai_suggestion']),
              status: z.enum(['approved', 'rejected', 'needs_changes', 'informational']),
              reviewerId: z.string().optional(),
              comment: z.string().optional(),
              metadata: z.record(z.string(), z.unknown()).optional(),
            }),
          },
        },
      },
    },
    responses: {
      201: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: ReviewSchema }),
          },
        },
        description: 'Review added',
      },
      500: {
        content: { 'application/json': { schema: ErrorSchema } },
        description: 'Server error',
      },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not found' },
    },
  }),
  async (c) => {
    const db = c.get('db')
    const { id: provenanceId } = c.req.valid('param')
    const body = c.req.valid('json')

    // Verify provenance entry exists
    const entry = await provenanceQueries.getProvenanceById(db, provenanceId)
    if (!entry) return c.json({ success: false as const, error: 'Provenance entry not found' }, 404)

    // Create the review
    const review = await provenanceQueries.createReview(db, {
      id: crypto.randomUUID(),
      provenanceId,
      ...body,
    })

    // Update the provenance review status based on review type
    const isHuman = body.reviewType === 'human_review' || body.reviewType === 'human_approval'
    const currentIsAiReviewed =
      entry.reviewStatus === 'ai_reviewed' || entry.reviewStatus === 'human_and_ai_reviewed'
    const currentIsHumanReviewed =
      entry.reviewStatus === 'human_reviewed' || entry.reviewStatus === 'human_and_ai_reviewed'

    let newStatus = entry.reviewStatus
    if (isHuman && currentIsAiReviewed) {
      newStatus = 'human_and_ai_reviewed'
    } else if (isHuman) {
      newStatus = 'human_reviewed'
    } else if (!isHuman && currentIsHumanReviewed) {
      newStatus = 'human_and_ai_reviewed'
    } else if (!isHuman) {
      newStatus = 'ai_reviewed'
    }

    await provenanceQueries.updateReviewStatus(db, provenanceId, newStatus, body.reviewerId)

    if (!review) return c.json({ success: false as const, error: 'Failed to create review' }, 500)
    return c.json({ success: true as const, data: review }, 201)
  },
)

// GET /:id/reviews — list reviews for entry
app.openapi(
  createRoute({
    method: 'get',
    path: '/{id}/reviews',
    tags: ['provenance'],
    summary: 'List reviews for a provenance entry',
    request: { params: IdParam },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: z.array(ReviewSchema) }),
          },
        },
        description: 'Review list',
      },
    },
  }),
  async (c) => {
    const db = c.get('db')
    const { id } = c.req.valid('param')
    const reviews = await provenanceQueries.getReviewsForProvenance(db, id)
    return c.json({ success: true as const, data: reviews })
  },
)

export default app
