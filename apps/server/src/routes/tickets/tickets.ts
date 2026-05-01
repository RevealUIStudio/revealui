import { TICKET_PRIORITIES, TICKET_STATUSES, TICKET_TYPES } from '@revealui/contracts/entities';
import * as boardQueries from '@revealui/db/queries/boards';
import * as ticketQueries from '@revealui/db/queries/tickets';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { HTTPException } from 'hono/http-exception';
import { asNonEmptyTuple } from '../../lib/type-guards.js';
import type { Variables } from '../_helpers/access.js';
import {
  assertBoardAccess,
  assertBoardTenantAccess,
  assertTicketAccess,
} from '../_helpers/access.js';
import { dateToString, nullableDateToString } from '../_helpers/serialize.js';

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

const TicketSchema = z
  .object({
    id: z.string(),
    boardId: z.string(),
    columnId: z.string().nullable(),
    parentTicketId: z.string().nullable(),
    ticketNumber: z.number(),
    title: z.string(),
    description: z.unknown().nullable(),
    status: z.enum(asNonEmptyTuple(TICKET_STATUSES)),
    priority: z.enum(asNonEmptyTuple(TICKET_PRIORITIES)),
    type: z.enum(asNonEmptyTuple(TICKET_TYPES)),
    assigneeId: z.string().nullable(),
    reporterId: z.string().nullable(),
    dueDate: z.string().nullable().openapi({ type: 'string', format: 'date-time' }),
    estimatedEffort: z.number().nullable(),
    sortOrder: z.number(),
    commentCount: z.number(),
    attachments: z.unknown().nullable(),
    metadata: z.unknown().nullable(),
    closedAt: z.string().nullable().openapi({ type: 'string', format: 'date-time' }),
    createdAt: z.string().openapi({ type: 'string', format: 'date-time' }),
    updatedAt: z.string().openapi({ type: 'string', format: 'date-time' }),
  })
  .openapi('Ticket');

type SerializedTicket = z.infer<typeof TicketSchema>;

function serializeTicket(
  ticket: NonNullable<Awaited<ReturnType<typeof ticketQueries.getTicketById>>>,
): SerializedTicket {
  return {
    id: ticket.id,
    boardId: ticket.boardId,
    columnId: ticket.columnId ?? null,
    parentTicketId: ticket.parentTicketId ?? null,
    ticketNumber: ticket.ticketNumber,
    title: ticket.title,
    description: ticket.description ?? null,
    status: ticket.status as SerializedTicket['status'],
    priority: ticket.priority as SerializedTicket['priority'],
    type: ticket.type as SerializedTicket['type'],
    assigneeId: ticket.assigneeId ?? null,
    reporterId: ticket.reporterId ?? null,
    dueDate: nullableDateToString(ticket.dueDate),
    estimatedEffort: ticket.estimatedEffort ?? null,
    sortOrder: ticket.sortOrder,
    commentCount: ticket.commentCount,
    attachments: ticket.attachments ?? null,
    metadata: ticket.metadata ?? null,
    closedAt: nullableDateToString(ticket.closedAt),
    createdAt: dateToString(ticket.createdAt),
    updatedAt: dateToString(ticket.updatedAt),
  };
}

const app = new OpenAPIHono<{ Variables: Variables }>();

// GET /boards/:boardId/tickets
app.openapi(
  createRoute({
    method: 'get',
    path: '/boards/{boardId}/tickets',
    tags: ['tickets'],
    summary: 'List tickets for a board',
    request: {
      params: BoardIdParam,
      query: z.object({
        status: z.enum(asNonEmptyTuple(TICKET_STATUSES)).optional().openapi({ example: 'open' }),
        priority: z
          .enum(asNonEmptyTuple(TICKET_PRIORITIES))
          .optional()
          .openapi({ example: 'high' }),
        type: z.enum(asNonEmptyTuple(TICKET_TYPES)).optional().openapi({ example: 'task' }),
        assigneeId: z.string().optional(),
        columnId: z.string().optional(),
      }),
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: z.array(TicketSchema) }),
          },
        },
        description: 'Ticket list',
      },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const { boardId } = c.req.valid('param');
    const filters = c.req.valid('query');
    const board = await boardQueries.getBoardById(db, boardId);
    if (!board) throw new HTTPException(404, { message: 'Board not found' });
    assertBoardTenantAccess(board, c.get('tenant'));
    const user = c.get('user');
    if (board.ownerId && board.ownerId !== user?.id && user?.role !== 'admin') {
      throw new HTTPException(403, { message: 'Forbidden' });
    }
    const tickets = await ticketQueries.getTicketsByBoard(db, boardId, filters);
    return c.json({ success: true as const, data: tickets.map(serializeTicket) });
  },
);

// POST /boards/:boardId/tickets
app.openapi(
  createRoute({
    method: 'post',
    path: '/boards/{boardId}/tickets',
    tags: ['tickets'],
    summary: 'Create a ticket',
    request: {
      params: BoardIdParam,
      body: {
        content: {
          'application/json': {
            schema: z.object({
              title: z.string().min(1).max(500),
              description: z.record(z.string(), z.unknown()).optional(),
              columnId: z.string().optional(),
              parentTicketId: z.string().optional(),
              status: z.enum(asNonEmptyTuple(TICKET_STATUSES)).optional(),
              priority: z.enum(asNonEmptyTuple(TICKET_PRIORITIES)).optional(),
              type: z.enum(asNonEmptyTuple(TICKET_TYPES)).optional(),
              assigneeId: z.string().optional(),
              reporterId: z.string().optional(),
              dueDate: z.string().datetime().optional(),
              estimatedEffort: z.number().int().min(0).optional(),
            }),
          },
        },
      },
    },
    responses: {
      201: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: TicketSchema }),
          },
        },
        description: 'Ticket created',
      },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const { boardId } = c.req.valid('param');
    const body = c.req.valid('json');
    await assertBoardAccess(db, boardId, c);
    const ticket = await ticketQueries.createTicket(db, {
      id: crypto.randomUUID(),
      boardId,
      ...body,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
    });
    // biome-ignore lint/style/noNonNullAssertion: createTicket always returns the created row
    return c.json({ success: true as const, data: serializeTicket(ticket!) }, 201);
  },
);

// GET /tickets/:id
app.openapi(
  createRoute({
    method: 'get',
    path: '/tickets/{id}',
    tags: ['tickets'],
    summary: 'Get a ticket by ID',
    request: { params: IdParam },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: TicketSchema }),
          },
        },
        description: 'Ticket found',
      },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not found' },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const { id } = c.req.valid('param');
    const ticket = await assertTicketAccess(db, id, c);
    return c.json({ success: true as const, data: serializeTicket(ticket) }, 200);
  },
);

// PATCH /tickets/:id
app.openapi(
  createRoute({
    method: 'patch',
    path: '/tickets/{id}',
    tags: ['tickets'],
    summary: 'Update a ticket',
    request: {
      params: IdParam,
      body: {
        content: {
          'application/json': {
            schema: z.object({
              title: z.string().min(1).max(500).optional(),
              description: z.record(z.string(), z.unknown()).optional(),
              status: z.enum(asNonEmptyTuple(TICKET_STATUSES)).optional(),
              priority: z.enum(asNonEmptyTuple(TICKET_PRIORITIES)).optional(),
              type: z.enum(asNonEmptyTuple(TICKET_TYPES)).optional(),
              assigneeId: z.string().nullable().optional(),
              reporterId: z.string().nullable().optional(),
              columnId: z.string().nullable().optional(),
              dueDate: z.string().datetime().nullable().optional(),
              estimatedEffort: z.number().int().min(0).nullable().optional(),
              sortOrder: z.number().optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: TicketSchema }),
          },
        },
        description: 'Ticket updated',
      },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not found' },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    await assertTicketAccess(db, id, c);
    const ticket = await ticketQueries.updateTicket(db, id, {
      ...body,
      dueDate: body.dueDate === null ? null : body.dueDate ? new Date(body.dueDate) : undefined,
    });
    if (!ticket) throw new HTTPException(404, { message: 'Ticket not found' });
    return c.json({ success: true as const, data: serializeTicket(ticket) }, 200);
  },
);

// DELETE /tickets/:id
app.openapi(
  createRoute({
    method: 'delete',
    path: '/tickets/{id}',
    tags: ['tickets'],
    summary: 'Delete a ticket',
    request: { params: IdParam },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), message: z.string() }),
          },
        },
        description: 'Ticket deleted',
      },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const { id } = c.req.valid('param');
    await assertTicketAccess(db, id, c);
    await ticketQueries.deleteTicket(db, id);
    return c.json({ success: true as const, message: 'Ticket deleted' });
  },
);

// POST /tickets/:id/move  -  kanban drag-and-drop
app.openapi(
  createRoute({
    method: 'post',
    path: '/tickets/{id}/move',
    tags: ['tickets'],
    summary: 'Move a ticket to a different column',
    request: {
      params: IdParam,
      body: {
        content: {
          'application/json': {
            schema: z.object({
              columnId: z.string(),
              sortOrder: z.number().int().min(0),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: TicketSchema }),
          },
        },
        description: 'Ticket moved',
      },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not found' },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const { id } = c.req.valid('param');
    await assertTicketAccess(db, id, c);
    const { columnId, sortOrder } = c.req.valid('json');
    const ticket = await ticketQueries.moveTicket(db, id, columnId, sortOrder);
    if (!ticket) throw new HTTPException(404, { message: 'Ticket not found' });
    return c.json({ success: true as const, data: serializeTicket(ticket) }, 200);
  },
);

// GET /tickets/:id/subtasks
app.openapi(
  createRoute({
    method: 'get',
    path: '/tickets/{id}/subtasks',
    tags: ['tickets'],
    summary: 'Get subtasks for a ticket',
    request: { params: IdParam },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: z.array(TicketSchema) }),
          },
        },
        description: 'Subtask list',
      },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const { id } = c.req.valid('param');
    await assertTicketAccess(db, id, c);
    const subtasks = await ticketQueries.getSubtickets(db, id);
    return c.json({ success: true as const, data: subtasks.map(serializeTicket) });
  },
);

export default app;
