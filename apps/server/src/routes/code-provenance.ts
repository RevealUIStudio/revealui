/**
 * Code Provenance API routes
 *
 * CRUD for provenance entries (file-level authorship tracking)
 * plus append-only code reviews and aggregate statistics.
 */

import type { DatabaseClient } from '@revealui/db/client';
import * as provenanceQueries from '@revealui/db/queries/code-provenance';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { HTTPException } from 'hono/http-exception';

type Variables = {
  db: DatabaseClient;
  user?: { id: string; role: string };
};

const WRITE_ROLES = new Set(['admin', 'owner', 'editor']);

function requireAuth(c: { get: (key: string) => unknown }): { id: string; role: string } {
  const user = c.get('user') as { id: string; role: string } | undefined;
  if (!user) throw new HTTPException(401, { message: 'Authentication required' });
  return user;
}

function requireWriteRole(c: { get: (key: string) => unknown }): { id: string; role: string } {
  const user = requireAuth(c);
  if (!WRITE_ROLES.has(user.role)) {
    throw new HTTPException(403, { message: 'Editor role or higher required' });
  }
  return user;
}

const app = new OpenAPIHono<{ Variables: Variables }>();

// =============================================================================
// Schema Definitions
// =============================================================================

const IdParam = z.object({
  id: z.string().openapi({
    param: { name: 'id', in: 'path' },
    example: '550e8400-e29b-41d4-a716-446655440000',
  }),
});

const FilePathParam = z.object({
  filePath: z.string().openapi({
    param: { name: 'filePath', in: 'path' },
    example: 'packages/core/src/index.ts',
  }),
});

const ErrorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
});

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
  .openapi('CodeProvenance');

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
  .openapi('CodeReview');

// =============================================================================
// Provenance Routes
// =============================================================================

// GET /  -  list all with filters
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
        limit: z.coerce.number().int().min(1).max(500).optional().openapi({ example: 100 }),
        offset: z.coerce.number().int().min(0).optional().openapi({ example: 0 }),
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
    requireAuth(c);
    const db = c.get('db');
    const { limit, offset, ...filters } = c.req.valid('query');
    const entries = await provenanceQueries.getAllProvenance(db, { ...filters, limit, offset });
    return c.json({ success: true as const, data: entries }, 200);
  },
);

// GET /stats  -  aggregate statistics
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
    requireAuth(c);
    const db = c.get('db');
    const stats = await provenanceQueries.getProvenanceStats(db);
    return c.json({ success: true as const, data: stats });
  },
);

// GET /file/:filePath  -  provenance for a specific file
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
    requireAuth(c);
    const db = c.get('db');
    const { filePath } = c.req.valid('param');
    const entries = await provenanceQueries.getProvenanceByFile(db, filePath);
    return c.json({ success: true as const, data: entries });
  },
);

// GET /:id  -  single entry
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
    requireAuth(c);
    const db = c.get('db');
    const { id } = c.req.valid('param');
    const entry = await provenanceQueries.getProvenanceById(db, id);
    if (!entry) throw new HTTPException(404, { message: 'Provenance entry not found' });
    return c.json({ success: true as const, data: entry }, 200);
  },
);

// POST /  -  create entry
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
    requireWriteRole(c);
    const db = c.get('db');
    const body = c.req.valid('json');
    const entry = await provenanceQueries.createProvenance(db, {
      id: crypto.randomUUID(),
      ...body,
    });
    if (!entry) throw new HTTPException(500, { message: 'Failed to create provenance entry' });
    return c.json({ success: true as const, data: entry }, 201);
  },
);

// PATCH /:id  -  update entry
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
    requireWriteRole(c);
    const db = c.get('db');
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const entry = await provenanceQueries.updateProvenance(db, id, body);
    if (!entry) throw new HTTPException(404, { message: 'Provenance entry not found' });
    return c.json({ success: true as const, data: entry }, 200);
  },
);

// DELETE /:id  -  delete entry
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
    const db = c.get('db');
    const { id } = c.req.valid('param');
    // Provenance records have no userId  -  restrict deletion to admin role only
    const user = c.get('user');
    if (user?.role !== 'admin') {
      throw new HTTPException(403, { message: 'Admin role required to delete provenance entries' });
    }
    await provenanceQueries.deleteProvenance(db, id);
    return c.json({ success: true as const, message: 'Provenance entry deleted' });
  },
);

// =============================================================================
// Review Routes
// =============================================================================

// POST /:id/review  -  add review (append-only)
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
    requireWriteRole(c);
    const db = c.get('db');
    const { id: provenanceId } = c.req.valid('param');
    const body = c.req.valid('json');

    // Verify provenance entry exists
    const entry = await provenanceQueries.getProvenanceById(db, provenanceId);
    if (!entry) throw new HTTPException(404, { message: 'Provenance entry not found' });

    // Create the review
    const review = await provenanceQueries.createReview(db, {
      id: crypto.randomUUID(),
      provenanceId,
      ...body,
    });

    // Update the provenance review status based on review type
    const isHuman = body.reviewType === 'human_review' || body.reviewType === 'human_approval';
    const currentIsAiReviewed =
      entry.reviewStatus === 'ai_reviewed' || entry.reviewStatus === 'human_and_ai_reviewed';
    const currentIsHumanReviewed =
      entry.reviewStatus === 'human_reviewed' || entry.reviewStatus === 'human_and_ai_reviewed';

    let newStatus = entry.reviewStatus;
    if (isHuman && currentIsAiReviewed) {
      newStatus = 'human_and_ai_reviewed';
    } else if (isHuman) {
      newStatus = 'human_reviewed';
    } else if (!isHuman && currentIsHumanReviewed) {
      newStatus = 'human_and_ai_reviewed';
    } else if (!isHuman) {
      newStatus = 'ai_reviewed';
    }

    await provenanceQueries.updateReviewStatus(db, provenanceId, newStatus, body.reviewerId);

    if (!review) throw new HTTPException(500, { message: 'Failed to create review' });
    return c.json({ success: true as const, data: review }, 201);
  },
);

// GET /:id/reviews  -  list reviews for entry
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
    requireAuth(c);
    const db = c.get('db');
    const { id } = c.req.valid('param');
    const reviews = await provenanceQueries.getReviewsForProvenance(db, id);
    return c.json({ success: true as const, data: reviews });
  },
);

export default app;
