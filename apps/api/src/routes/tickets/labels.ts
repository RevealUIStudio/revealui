import * as labelQueries from '@revealui/db/queries/ticket-labels';
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

const LabelSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    color: z.string().nullable(),
    description: z.string().nullable(),
    tenantId: z.string().nullable(),
    createdAt: z.string().openapi({ type: 'string', format: 'date-time' }),
    updatedAt: z.string().openapi({ type: 'string', format: 'date-time' }),
  })
  .openapi('TicketLabel');

const app = new OpenAPIHono<{ Variables: Variables }>();

// GET /labels
app.openapi(
  createRoute({
    method: 'get',
    path: '/labels',
    tags: ['labels'],
    summary: 'List all labels',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: z.array(LabelSchema) }),
          },
        },
        description: 'Label list',
      },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const tenant = c.get('tenant');
    const labels = await labelQueries.getAllLabels(db, tenant?.id);
    return c.json({ success: true as const, data: labels });
  },
);

// POST /labels
app.openapi(
  createRoute({
    method: 'post',
    path: '/labels',
    tags: ['labels'],
    summary: 'Create a label',
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({
              name: z.string().min(1).max(100),
              slug: z.string().min(1).max(100),
              color: z.string().max(20).optional(),
              description: z.string().max(500).optional(),
            }),
          },
        },
      },
    },
    responses: {
      201: {
        content: {
          'application/json': { schema: z.object({ success: z.literal(true), data: LabelSchema }) },
        },
        description: 'Label created',
      },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const tenant = c.get('tenant');
    const body = c.req.valid('json');
    const label = await labelQueries.createLabel(db, {
      id: crypto.randomUUID(),
      ...body,
      tenantId: tenant?.id,
    });
    // biome-ignore lint/style/noNonNullAssertion: createLabel always returns the created row
    return c.json({ success: true as const, data: label! }, 201);
  },
);

// PATCH /labels/:id
app.openapi(
  createRoute({
    method: 'patch',
    path: '/labels/{id}',
    tags: ['labels'],
    summary: 'Update a label',
    request: {
      params: IdParam,
      body: {
        content: {
          'application/json': {
            schema: z.object({
              name: z.string().min(1).max(100).optional(),
              slug: z.string().min(1).max(100).optional(),
              color: z.string().max(20).optional(),
              description: z.string().max(500).optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          'application/json': { schema: z.object({ success: z.literal(true), data: LabelSchema }) },
        },
        description: 'Label updated',
      },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not found' },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const existing = await labelQueries.getLabelById(db, id);
    if (!existing) throw new HTTPException(404, { message: 'Label not found' });
    const tenant = c.get('tenant');
    if (tenant && existing.tenantId && existing.tenantId !== tenant.id) {
      throw new HTTPException(403, { message: 'Access denied for this tenant' });
    }
    const label = await labelQueries.updateLabel(db, id, body);
    if (!label) throw new HTTPException(404, { message: 'Label not found' });
    return c.json({ success: true as const, data: label }, 200);
  },
);

// DELETE /labels/:id
app.openapi(
  createRoute({
    method: 'delete',
    path: '/labels/{id}',
    tags: ['labels'],
    summary: 'Delete a label',
    request: { params: IdParam },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), message: z.string() }),
          },
        },
        description: 'Label deleted',
      },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const { id } = c.req.valid('param');
    const existing = await labelQueries.getLabelById(db, id);
    if (!existing) throw new HTTPException(404, { message: 'Label not found' });
    const tenant = c.get('tenant');
    if (tenant && existing.tenantId && existing.tenantId !== tenant.id) {
      throw new HTTPException(403, { message: 'Access denied for this tenant' });
    }
    await labelQueries.deleteLabel(db, id);
    return c.json({ success: true as const, message: 'Label deleted' });
  },
);

// POST /tickets/:id/labels
app.openapi(
  createRoute({
    method: 'post',
    path: '/tickets/{id}/labels',
    tags: ['labels'],
    summary: 'Assign a label to a ticket',
    request: {
      params: IdParam,
      body: {
        content: {
          'application/json': {
            schema: z.object({ labelId: z.string() }),
          },
        },
      },
    },
    responses: {
      201: {
        content: {
          'application/json': {
            schema: z.object({
              success: z.literal(true),
              data: z.object({ id: z.string(), ticketId: z.string(), labelId: z.string() }),
            }),
          },
        },
        description: 'Label assigned',
      },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const { id: ticketId } = c.req.valid('param');
    const { labelId } = c.req.valid('json');
    await assertTicketAccess(db, ticketId, c);
    const assignment = await labelQueries.assignLabel(db, {
      id: crypto.randomUUID(),
      ticketId,
      labelId,
    });
    if (!assignment) {
      throw new Error('Failed to assign label');
    }
    return c.json(
      {
        success: true as const,
        data: { id: assignment.id, ticketId: assignment.ticketId, labelId: assignment.labelId },
      },
      201,
    );
  },
);

// DELETE /tickets/:id/labels/:labelId
app.openapi(
  createRoute({
    method: 'delete',
    path: '/tickets/{id}/labels/{labelId}',
    tags: ['labels'],
    summary: 'Remove a label from a ticket',
    request: {
      params: z.object({
        id: z.string().openapi({ param: { name: 'id', in: 'path' } }),
        labelId: z.string().openapi({ param: { name: 'labelId', in: 'path' } }),
      }),
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), message: z.string() }),
          },
        },
        description: 'Label removed',
      },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const { id: ticketId, labelId } = c.req.valid('param');
    await assertTicketAccess(db, ticketId, c);
    await labelQueries.removeLabel(db, ticketId, labelId);
    return c.json({ success: true as const, message: 'Label removed from ticket' });
  },
);

// GET /tickets/:id/labels
app.openapi(
  createRoute({
    method: 'get',
    path: '/tickets/{id}/labels',
    tags: ['labels'],
    summary: 'Get labels for a ticket',
    request: { params: IdParam },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: z.array(LabelSchema) }),
          },
        },
        description: 'Labels for ticket',
      },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const { id } = c.req.valid('param');
    await assertTicketAccess(db, id, c);
    const labels = await labelQueries.getLabelsForTicket(db, id);
    return c.json({ success: true as const, data: labels });
  },
);

export default app;
