import * as boardQueries from '@revealui/db/queries/boards';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { HTTPException } from 'hono/http-exception';
import type { Variables } from '../_helpers/access.js';
import { assertBoardAccess, assertBoardTenantAccess } from '../_helpers/access.js';

const IdParam = z.object({
  id: z.string().openapi({
    param: { name: 'id', in: 'path' },
    example: '550e8400-e29b-41d4-a716-446655440000',
  }),
});

const BoardIdParam = z.object({
  boardId: z.string().openapi({
    param: { name: 'boardId', in: 'path' },
    example: 'board-001',
  }),
});

const ErrorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
});

const ColumnSchema = z
  .object({
    id: z.string(),
    boardId: z.string(),
    name: z.string(),
    slug: z.string(),
    position: z.number(),
    wipLimit: z.number().nullable(),
    color: z.string().nullable(),
    isDefault: z.boolean(),
    createdAt: z.string().openapi({ type: 'string', format: 'date-time' }),
    updatedAt: z.string().openapi({ type: 'string', format: 'date-time' }),
  })
  .openapi('BoardColumn');

const app = new OpenAPIHono<{ Variables: Variables }>();

// GET /boards/:boardId/columns
app.openapi(
  createRoute({
    method: 'get',
    path: '/boards/{boardId}/columns',
    tags: ['boards'],
    summary: 'List columns for a board',
    request: { params: BoardIdParam },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: z.array(ColumnSchema) }),
          },
        },
        description: 'Columns list',
      },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const { boardId } = c.req.valid('param');
    await assertBoardAccess(db, boardId, c);
    const columns = await boardQueries.getColumnsByBoard(db, boardId);
    return c.json({ success: true as const, data: columns });
  },
);

// POST /boards/:boardId/columns
app.openapi(
  createRoute({
    method: 'post',
    path: '/boards/{boardId}/columns',
    tags: ['boards'],
    summary: 'Create a column',
    request: {
      params: BoardIdParam,
      body: {
        content: {
          'application/json': {
            schema: z.object({
              name: z.string().min(1).max(100),
              slug: z.string().min(1).max(100),
              position: z.number().int().min(0),
              wipLimit: z.number().int().min(1).optional(),
              color: z.string().max(20).optional(),
            }),
          },
        },
      },
    },
    responses: {
      201: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: ColumnSchema }),
          },
        },
        description: 'Column created',
      },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const { boardId } = c.req.valid('param');
    const body = c.req.valid('json');
    await assertBoardAccess(db, boardId, c);
    const column = await boardQueries.createColumn(db, {
      id: crypto.randomUUID(),
      boardId,
      ...body,
    });
    // biome-ignore lint/style/noNonNullAssertion: createColumn always returns the created row
    return c.json({ success: true as const, data: column! }, 201);
  },
);

// PATCH /columns/:id
app.openapi(
  createRoute({
    method: 'patch',
    path: '/columns/{id}',
    tags: ['boards'],
    summary: 'Update a column',
    request: {
      params: IdParam,
      body: {
        content: {
          'application/json': {
            schema: z.object({
              name: z.string().min(1).max(100).optional(),
              slug: z.string().min(1).max(100).optional(),
              position: z.number().int().min(0).optional(),
              wipLimit: z.number().int().min(1).nullable().optional(),
              color: z.string().max(20).nullable().optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: ColumnSchema }),
          },
        },
        description: 'Column updated',
      },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not found' },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const existing = await boardQueries.getColumnById(db, id);
    if (!existing) throw new HTTPException(404, { message: 'Column not found' });
    const board = await boardQueries.getBoardById(db, existing.boardId);
    if (!board) throw new HTTPException(404, { message: 'Board not found' });
    assertBoardTenantAccess(board, c.get('tenant'));
    const user = c.get('user');
    if (board.ownerId && board.ownerId !== user?.id && user?.role !== 'admin') {
      throw new HTTPException(403, { message: 'Forbidden' });
    }
    const column = await boardQueries.updateColumn(db, id, body);
    if (!column) throw new HTTPException(404, { message: 'Column not found' });
    return c.json({ success: true as const, data: column }, 200);
  },
);

// DELETE /columns/:id
app.openapi(
  createRoute({
    method: 'delete',
    path: '/columns/{id}',
    tags: ['boards'],
    summary: 'Delete a column',
    request: { params: IdParam },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), message: z.string() }),
          },
        },
        description: 'Column deleted',
      },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const { id } = c.req.valid('param');
    const existing = await boardQueries.getColumnById(db, id);
    if (!existing) throw new HTTPException(404, { message: 'Column not found' });
    const board = await boardQueries.getBoardById(db, existing.boardId);
    if (!board) throw new HTTPException(404, { message: 'Board not found' });
    assertBoardTenantAccess(board, c.get('tenant'));
    const user = c.get('user');
    if (board.ownerId && board.ownerId !== user?.id && user?.role !== 'admin') {
      throw new HTTPException(403, { message: 'Forbidden' });
    }
    await boardQueries.deleteColumn(db, id);
    return c.json({ success: true as const, message: 'Column deleted' });
  },
);

export default app;
