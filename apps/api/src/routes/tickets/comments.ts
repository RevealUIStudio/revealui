import * as commentQueries from '@revealui/db/queries/ticket-comments';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { HTTPException } from 'hono/http-exception';
import type { Variables } from '../_helpers/access.js';
import { assertTicketAccess } from '../_helpers/access.js';

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

const CommentSchema = z
  .object({
    id: z.string(),
    ticketId: z.string(),
    authorId: z.string().nullable(),
    body: z.unknown().nullable(),
    createdAt: z.string().openapi({ type: 'string', format: 'date-time' }),
    updatedAt: z.string().openapi({ type: 'string', format: 'date-time' }),
  })
  .openapi('TicketComment');

const app = new OpenAPIHono<{ Variables: Variables }>();

// GET /tickets/:id/comments
app.openapi(
  createRoute({
    method: 'get',
    path: '/tickets/{id}/comments',
    tags: ['comments'],
    summary: 'List comments for a ticket',
    request: { params: IdParam },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: z.array(CommentSchema) }),
          },
        },
        description: 'Comment list',
      },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const { id } = c.req.valid('param');
    await assertTicketAccess(db, id, c);
    const comments = await commentQueries.getCommentsByTicket(db, id);
    return c.json({ success: true as const, data: comments });
  },
);

// POST /tickets/:id/comments
app.openapi(
  createRoute({
    method: 'post',
    path: '/tickets/{id}/comments',
    tags: ['comments'],
    summary: 'Add a comment to a ticket',
    request: {
      params: IdParam,
      body: {
        content: {
          'application/json': {
            schema: z.object({
              body: z.record(z.string(), z.unknown()),
              authorId: z.string().optional(),
            }),
          },
        },
      },
    },
    responses: {
      201: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: CommentSchema }),
          },
        },
        description: 'Comment created',
      },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const { id: ticketId } = c.req.valid('param');
    const body = c.req.valid('json');
    const user = c.get('user');
    await assertTicketAccess(db, ticketId, c);
    // Force authorId to session user — never trust client-supplied authorId
    const comment = await commentQueries.createComment(db, {
      id: crypto.randomUUID(),
      ticketId,
      ...body,
      authorId: user?.id,
    });
    // biome-ignore lint/style/noNonNullAssertion: createComment always returns the created row
    return c.json({ success: true as const, data: comment! }, 201);
  },
);

// PATCH /comments/:id
app.openapi(
  createRoute({
    method: 'patch',
    path: '/comments/{id}',
    tags: ['comments'],
    summary: 'Update a comment',
    request: {
      params: IdParam,
      body: {
        content: {
          'application/json': {
            schema: z.object({ body: z.record(z.string(), z.unknown()) }),
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: CommentSchema }),
          },
        },
        description: 'Comment updated',
      },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not found' },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const { id } = c.req.valid('param');
    const data = c.req.valid('json');
    const existing = await commentQueries.getCommentById(db, id);
    if (!existing) throw new HTTPException(404, { message: 'Comment not found' });
    await assertTicketAccess(db, existing.ticketId, c);
    const user = c.get('user');
    if (existing.authorId && existing.authorId !== user?.id && user?.role !== 'admin') {
      throw new HTTPException(403, { message: 'Forbidden' });
    }
    const comment = await commentQueries.updateComment(db, id, data);
    if (!comment) throw new HTTPException(404, { message: 'Comment not found' });
    return c.json({ success: true as const, data: comment }, 200);
  },
);

// DELETE /comments/:id
app.openapi(
  createRoute({
    method: 'delete',
    path: '/comments/{id}',
    tags: ['comments'],
    summary: 'Delete a comment',
    request: { params: IdParam },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), message: z.string() }),
          },
        },
        description: 'Comment deleted',
      },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const { id } = c.req.valid('param');
    const existing = await commentQueries.getCommentById(db, id);
    if (!existing) throw new HTTPException(404, { message: 'Comment not found' });
    await assertTicketAccess(db, existing.ticketId, c);
    const user = c.get('user');
    if (existing.authorId && existing.authorId !== user?.id && user?.role !== 'admin') {
      throw new HTTPException(403, { message: 'Forbidden' });
    }
    await commentQueries.deleteComment(db, id);
    return c.json({ success: true as const, message: 'Comment deleted' });
  },
);

export default app;
