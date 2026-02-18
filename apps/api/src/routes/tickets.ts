/**
 * Ticket & Kanban Board API routes
 *
 * Replaces the old todos routes with a full ticketing system:
 * - Boards CRUD
 * - Board columns management
 * - Tickets CRUD + kanban move
 * - Comments CRUD
 * - Labels CRUD + assignment
 */

import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import type { DatabaseClient } from '@revealui/db/client'
import * as boardQueries from '@revealui/db/queries/boards'
import * as commentQueries from '@revealui/db/queries/ticket-comments'
import * as labelQueries from '@revealui/db/queries/ticket-labels'
import * as ticketQueries from '@revealui/db/queries/tickets'

type Variables = {
  db: DatabaseClient
  tenant?: { id: string }
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

const BoardIdParam = z.object({
  boardId: z.string().openapi({
    param: { name: 'boardId', in: 'path' },
    example: 'board-001',
  }),
})

const ErrorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
})

const BoardSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    description: z.string().nullable(),
    ownerId: z.string().nullable(),
    tenantId: z.string().nullable(),
    isDefault: z.boolean(),
    createdAt: z.any().openapi({ type: 'string', format: 'date-time' }),
    updatedAt: z.any().openapi({ type: 'string', format: 'date-time' }),
  })
  .openapi('Board')

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
    createdAt: z.any().openapi({ type: 'string', format: 'date-time' }),
    updatedAt: z.any().openapi({ type: 'string', format: 'date-time' }),
  })
  .openapi('BoardColumn')

const TicketSchema = z
  .object({
    id: z.string(),
    boardId: z.string(),
    columnId: z.string().nullable(),
    parentTicketId: z.string().nullable(),
    ticketNumber: z.number(),
    title: z.string(),
    description: z.any().nullable(),
    status: z.string(),
    priority: z.string(),
    type: z.string(),
    assigneeId: z.string().nullable(),
    reporterId: z.string().nullable(),
    dueDate: z.any().nullable().openapi({ type: 'string', format: 'date-time' }),
    estimatedEffort: z.number().nullable(),
    sortOrder: z.number(),
    commentCount: z.number(),
    attachments: z.any().nullable(),
    metadata: z.any().nullable(),
    closedAt: z.any().nullable().openapi({ type: 'string', format: 'date-time' }),
    createdAt: z.any().openapi({ type: 'string', format: 'date-time' }),
    updatedAt: z.any().openapi({ type: 'string', format: 'date-time' }),
  })
  .openapi('Ticket')

const CommentSchema = z
  .object({
    id: z.string(),
    ticketId: z.string(),
    authorId: z.string().nullable(),
    body: z.any(),
    createdAt: z.any().openapi({ type: 'string', format: 'date-time' }),
    updatedAt: z.any().openapi({ type: 'string', format: 'date-time' }),
  })
  .openapi('TicketComment')

const LabelSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    color: z.string().nullable(),
    description: z.string().nullable(),
    tenantId: z.string().nullable(),
    createdAt: z.any().openapi({ type: 'string', format: 'date-time' }),
    updatedAt: z.any().openapi({ type: 'string', format: 'date-time' }),
  })
  .openapi('TicketLabel')

// =============================================================================
// Board Routes
// =============================================================================

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
    const db = c.get('db')
    const tenant = c.get('tenant')
    const boards = await boardQueries.getAllBoards(db, tenant?.id)
    return c.json({ success: true as const, data: boards })
  },
)

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
    const db = c.get('db')
    const tenant = c.get('tenant')
    const body = c.req.valid('json')
    const board = await boardQueries.createBoard(db, {
      id: crypto.randomUUID(),
      ...body,
      tenantId: tenant?.id,
    })
    return c.json({ success: true as const, data: board! }, 201)
  },
)

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
    const db = c.get('db')
    const { id } = c.req.valid('param')
    const board = await boardQueries.getBoardById(db, id)
    if (!board) return c.json({ success: false as const, error: 'Board not found' }, 404)
    return c.json({ success: true as const, data: board }, 200)
  },
)

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
    const db = c.get('db')
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')
    const board = await boardQueries.updateBoard(db, id, body)
    if (!board) return c.json({ success: false as const, error: 'Board not found' }, 404)
    return c.json({ success: true as const, data: board }, 200)
  },
)

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
    const db = c.get('db')
    const { id } = c.req.valid('param')
    await boardQueries.deleteBoard(db, id)
    return c.json({ success: true as const, message: 'Board deleted' })
  },
)

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
    const db = c.get('db')
    const { boardId } = c.req.valid('param')
    const columns = await boardQueries.getColumnsByBoard(db, boardId)
    return c.json({ success: true as const, data: columns })
  },
)

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
    const db = c.get('db')
    const { boardId } = c.req.valid('param')
    const body = c.req.valid('json')
    const column = await boardQueries.createColumn(db, {
      id: crypto.randomUUID(),
      boardId,
      ...body,
    })
    return c.json({ success: true as const, data: column! }, 201)
  },
)

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
    const db = c.get('db')
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')
    const column = await boardQueries.updateColumn(db, id, body)
    if (!column) return c.json({ success: false as const, error: 'Column not found' }, 404)
    return c.json({ success: true as const, data: column }, 200)
  },
)

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
    const db = c.get('db')
    const { id } = c.req.valid('param')
    await boardQueries.deleteColumn(db, id)
    return c.json({ success: true as const, message: 'Column deleted' })
  },
)

// =============================================================================
// Ticket Routes
// =============================================================================

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
        status: z.string().optional().openapi({ example: 'open' }),
        priority: z.string().optional().openapi({ example: 'high' }),
        type: z.string().optional().openapi({ example: 'task' }),
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
    const db = c.get('db')
    const { boardId } = c.req.valid('param')
    const filters = c.req.valid('query')
    const tickets = await ticketQueries.getTicketsByBoard(db, boardId, filters)
    return c.json({ success: true as const, data: tickets })
  },
)

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
              description: z.any().optional(),
              columnId: z.string().optional(),
              parentTicketId: z.string().optional(),
              status: z.string().optional(),
              priority: z.string().optional(),
              type: z.string().optional(),
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
    const db = c.get('db')
    const { boardId } = c.req.valid('param')
    const body = c.req.valid('json')
    const ticket = await ticketQueries.createTicket(db, {
      id: crypto.randomUUID(),
      boardId,
      ...body,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
    })
    return c.json({ success: true as const, data: ticket! }, 201)
  },
)

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
    const db = c.get('db')
    const { id } = c.req.valid('param')
    const ticket = await ticketQueries.getTicketById(db, id)
    if (!ticket) return c.json({ success: false as const, error: 'Ticket not found' }, 404)
    return c.json({ success: true as const, data: ticket }, 200)
  },
)

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
              description: z.any().optional(),
              status: z.string().optional(),
              priority: z.string().optional(),
              type: z.string().optional(),
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
    const db = c.get('db')
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')
    const ticket = await ticketQueries.updateTicket(db, id, {
      ...body,
      dueDate: body.dueDate === null ? null : body.dueDate ? new Date(body.dueDate) : undefined,
    })
    if (!ticket) return c.json({ success: false as const, error: 'Ticket not found' }, 404)
    return c.json({ success: true as const, data: ticket }, 200)
  },
)

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
    const db = c.get('db')
    const { id } = c.req.valid('param')
    await ticketQueries.deleteTicket(db, id)
    return c.json({ success: true as const, message: 'Ticket deleted' })
  },
)

// POST /tickets/:id/move — kanban drag-and-drop
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
    const db = c.get('db')
    const { id } = c.req.valid('param')
    const { columnId, sortOrder } = c.req.valid('json')
    const ticket = await ticketQueries.moveTicket(db, id, columnId, sortOrder)
    if (!ticket) return c.json({ success: false as const, error: 'Ticket not found' }, 404)
    return c.json({ success: true as const, data: ticket }, 200)
  },
)

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
    const db = c.get('db')
    const { id } = c.req.valid('param')
    const subtasks = await ticketQueries.getSubtickets(db, id)
    return c.json({ success: true as const, data: subtasks })
  },
)

// =============================================================================
// Comment Routes
// =============================================================================

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
    const db = c.get('db')
    const { id } = c.req.valid('param')
    const comments = await commentQueries.getCommentsByTicket(db, id)
    return c.json({ success: true as const, data: comments })
  },
)

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
              body: z.any(),
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
    const db = c.get('db')
    const { id: ticketId } = c.req.valid('param')
    const body = c.req.valid('json')
    const comment = await commentQueries.createComment(db, {
      id: crypto.randomUUID(),
      ticketId,
      ...body,
    })
    return c.json({ success: true as const, data: comment! }, 201)
  },
)

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
            schema: z.object({ body: z.any() }),
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
    const db = c.get('db')
    const { id } = c.req.valid('param')
    const data = c.req.valid('json')
    const comment = await commentQueries.updateComment(db, id, data)
    if (!comment) return c.json({ success: false as const, error: 'Comment not found' }, 404)
    return c.json({ success: true as const, data: comment }, 200)
  },
)

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
    const db = c.get('db')
    const { id } = c.req.valid('param')
    await commentQueries.deleteComment(db, id)
    return c.json({ success: true as const, message: 'Comment deleted' })
  },
)

// =============================================================================
// Label Routes
// =============================================================================

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
    const db = c.get('db')
    const tenant = c.get('tenant')
    const labels = await labelQueries.getAllLabels(db, tenant?.id)
    return c.json({ success: true as const, data: labels })
  },
)

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
    const db = c.get('db')
    const tenant = c.get('tenant')
    const body = c.req.valid('json')
    const label = await labelQueries.createLabel(db, {
      id: crypto.randomUUID(),
      ...body,
      tenantId: tenant?.id,
    })
    return c.json({ success: true as const, data: label! }, 201)
  },
)

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
    const db = c.get('db')
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')
    const label = await labelQueries.updateLabel(db, id, body)
    if (!label) return c.json({ success: false as const, error: 'Label not found' }, 404)
    return c.json({ success: true as const, data: label }, 200)
  },
)

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
    const db = c.get('db')
    const { id } = c.req.valid('param')
    await labelQueries.deleteLabel(db, id)
    return c.json({ success: true as const, message: 'Label deleted' })
  },
)

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
    const db = c.get('db')
    const { id: ticketId } = c.req.valid('param')
    const { labelId } = c.req.valid('json')
    const assignment = await labelQueries.assignLabel(db, {
      id: crypto.randomUUID(),
      ticketId,
      labelId,
    })
    if (!assignment) {
      throw new Error('Failed to assign label')
    }
    return c.json(
      {
        success: true as const,
        data: { id: assignment.id, ticketId: assignment.ticketId, labelId: assignment.labelId },
      },
      201,
    )
  },
)

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
    const db = c.get('db')
    const { id: ticketId, labelId } = c.req.valid('param')
    await labelQueries.removeLabel(db, ticketId, labelId)
    return c.json({ success: true as const, message: 'Label removed from ticket' })
  },
)

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
    const db = c.get('db')
    const { id } = c.req.valid('param')
    const labels = await labelQueries.getLabelsForTicket(db, id)
    return c.json({ success: true as const, data: labels })
  },
)

export default app
