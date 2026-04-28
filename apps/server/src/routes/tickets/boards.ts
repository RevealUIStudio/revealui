import * as boardQueries from '@revealui/db/queries/boards';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { HTTPException } from 'hono/http-exception';
import type { Variables } from '../_helpers/access.js';
import { assertBoardTenantAccess } from '../_helpers/access.js';

const IdParam = z.object({
  id: z.string().openapi({
    param: { name: 'id', in: 'path' },
    example: '550e8400-e29b-41d4-a716-446655440000',
  }),
});

const ErrorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
});

const BoardSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    description: z.string().nullable(),
    ownerId: z.string().nullable(),
    tenantId: z.string().nullable(),
    isDefault: z.boolean(),
    createdAt: z.string().openapi({ type: 'string', format: 'date-time' }),
    updatedAt: z.string().openapi({ type: 'string', format: 'date-time' }),
  })
  .openapi('Board');

const app = new OpenAPIHono<{ Variables: Variables }>();

// GET /boards
app.openapi(
  createRoute({
    method: 'get',
    path: '/boards',
    tags: ['boards'],
    summary: 'List all boards',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: z.array(BoardSchema) }),
          },
        },
        description: 'Board list',
      },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const tenant = c.get('tenant');
    const boards = await boardQueries.getAllBoards(db, tenant?.id);
    return c.json({ success: true as const, data: boards });
  },
);

// POST /boards
app.openapi(
  createRoute({
    method: 'post',
    path: '/boards',
    tags: ['boards'],
    summary: 'Create a board',
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({
              name: z.string().min(1).max(200),
              slug: z.string().min(1).max(200),
              description: z.string().max(1000).optional(),
              isDefault: z.boolean().optional(),
            }),
          },
        },
      },
    },
    responses: {
      201: {
        content: {
          'application/json': { schema: z.object({ success: z.literal(true), data: BoardSchema }) },
        },
        description: 'Board created',
      },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const tenant = c.get('tenant');
    const user = c.get('user') as { id: string } | undefined;
    const body = c.req.valid('json');
    const board = await boardQueries.createBoard(db, {
      id: crypto.randomUUID(),
      ...body,
      ownerId: user?.id,
      tenantId: tenant?.id,
    });
    // biome-ignore lint/style/noNonNullAssertion: createBoard always returns the created row
    return c.json({ success: true as const, data: board! }, 201);
  },
);

// GET /boards/:id
app.openapi(
  createRoute({
    method: 'get',
    path: '/boards/{id}',
    tags: ['boards'],
    summary: 'Get a board by ID',
    request: { params: IdParam },
    responses: {
      200: {
        content: {
          'application/json': { schema: z.object({ success: z.literal(true), data: BoardSchema }) },
        },
        description: 'Board found',
      },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not found' },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const { id } = c.req.valid('param');
    const board = await boardQueries.getBoardById(db, id);
    if (!board) throw new HTTPException(404, { message: 'Board not found' });
    assertBoardTenantAccess(board, c.get('tenant'));
    const user = c.get('user');
    if (board.ownerId && board.ownerId !== user?.id && user?.role !== 'admin') {
      throw new HTTPException(403, { message: 'Forbidden' });
    }
    return c.json({ success: true as const, data: board }, 200);
  },
);

// PATCH /boards/:id
app.openapi(
  createRoute({
    method: 'patch',
    path: '/boards/{id}',
    tags: ['boards'],
    summary: 'Update a board',
    request: {
      params: IdParam,
      body: {
        content: {
          'application/json': {
            schema: z.object({
              name: z.string().min(1).max(200).optional(),
              slug: z.string().min(1).max(200).optional(),
              description: z.string().max(1000).optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          'application/json': { schema: z.object({ success: z.literal(true), data: BoardSchema }) },
        },
        description: 'Board updated',
      },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not found' },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const existing = await boardQueries.getBoardById(db, id);
    if (!existing) throw new HTTPException(404, { message: 'Board not found' });
    assertBoardTenantAccess(existing, c.get('tenant'));
    const user = c.get('user');
    if (existing.ownerId && existing.ownerId !== user?.id && user?.role !== 'admin') {
      throw new HTTPException(403, { message: 'Forbidden' });
    }
    const board = await boardQueries.updateBoard(db, id, body);
    if (!board) throw new HTTPException(404, { message: 'Board not found' });
    return c.json({ success: true as const, data: board }, 200);
  },
);

// DELETE /boards/:id
app.openapi(
  createRoute({
    method: 'delete',
    path: '/boards/{id}',
    tags: ['boards'],
    summary: 'Delete a board',
    request: { params: IdParam },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), message: z.string() }),
          },
        },
        description: 'Board deleted',
      },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const { id } = c.req.valid('param');
    const board = await boardQueries.getBoardById(db, id);
    if (!board) throw new HTTPException(404, { message: 'Board not found' });
    const user = c.get('user');
    if (board.ownerId && board.ownerId !== user?.id && user?.role !== 'admin') {
      throw new HTTPException(403, { message: 'Forbidden' });
    }
    await boardQueries.deleteBoard(db, id);
    return c.json({ success: true as const, message: 'Board deleted' });
  },
);

export default app;
