import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mock all DB query modules
// ---------------------------------------------------------------------------
vi.mock('@revealui/db/queries/boards', () => ({
  getAllBoards: vi.fn(),
  createBoard: vi.fn(),
  getBoardById: vi.fn(),
  updateBoard: vi.fn(),
  deleteBoard: vi.fn(),
  getColumnsByBoard: vi.fn(),
  createColumn: vi.fn(),
  updateColumn: vi.fn(),
  deleteColumn: vi.fn(),
}))

vi.mock('@revealui/db/queries/tickets', () => ({
  getTicketsByBoard: vi.fn(),
  createTicket: vi.fn(),
  getTicketById: vi.fn(),
  updateTicket: vi.fn(),
  deleteTicket: vi.fn(),
  moveTicket: vi.fn(),
  getSubtickets: vi.fn(),
}))

vi.mock('@revealui/db/queries/ticket-comments', () => ({
  getCommentsByTicket: vi.fn(),
  createComment: vi.fn(),
  updateComment: vi.fn(),
  deleteComment: vi.fn(),
}))

vi.mock('@revealui/db/queries/ticket-labels', () => ({
  getAllLabels: vi.fn(),
  createLabel: vi.fn(),
  updateLabel: vi.fn(),
  deleteLabel: vi.fn(),
  assignLabel: vi.fn(),
  removeLabel: vi.fn(),
  getLabelsForTicket: vi.fn(),
}))

import type { DatabaseClient } from '@revealui/db/client'
import * as boardQueries from '@revealui/db/queries/boards'
import * as commentQueries from '@revealui/db/queries/ticket-comments'
import * as labelQueries from '@revealui/db/queries/ticket-labels'
import * as ticketQueries from '@revealui/db/queries/tickets'
import ticketsApp from '../tickets.js'

const mb = vi.mocked(boardQueries)
const mt = vi.mocked(ticketQueries)
const mc = vi.mocked(commentQueries)
const ml = vi.mocked(labelQueries)

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = new Date().toISOString()

function makeBoard(overrides = {}) {
  return {
    id: 'board-1',
    name: 'Main Board',
    slug: 'main-board',
    description: null,
    ownerId: null,
    tenantId: null,
    isDefault: false,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

function makeColumn(overrides = {}) {
  return {
    id: 'col-1',
    boardId: 'board-1',
    name: 'To Do',
    slug: 'to-do',
    position: 0,
    wipLimit: null,
    color: null,
    isDefault: true,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

function makeTicket(overrides = {}) {
  return {
    id: 'ticket-1',
    boardId: 'board-1',
    columnId: 'col-1',
    parentTicketId: null,
    ticketNumber: 1,
    title: 'Fix bug',
    description: null,
    status: 'open',
    priority: 'medium',
    type: 'task',
    assigneeId: null,
    reporterId: null,
    dueDate: null,
    estimatedEffort: null,
    sortOrder: 0,
    commentCount: 0,
    attachments: null,
    metadata: null,
    closedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

function makeComment(overrides = {}) {
  return {
    id: 'comment-1',
    ticketId: 'ticket-1',
    authorId: null,
    body: { type: 'doc', content: [] },
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

function makeLabel(overrides = {}) {
  return {
    id: 'label-1',
    name: 'bug',
    slug: 'bug',
    color: '#ff0000',
    description: null,
    tenantId: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// App factory
// ---------------------------------------------------------------------------

function createApp() {
  const app = new Hono<{ Variables: { db: DatabaseClient } }>()
  app.use('*', async (c, next) => {
    c.set('db', {} as DatabaseClient)
    await next()
  })
  app.route('/', ticketsApp)
  return app
}

function post(body: unknown) {
  return {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }
}

function patch(body: unknown) {
  return {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }
}

// biome-ignore lint/suspicious/noExplicitAny: test helper — response shape varies per endpoint
async function parseBody(res: Response): Promise<any> {
  return res.json()
}

// ---------------------------------------------------------------------------
// Board tests
// ---------------------------------------------------------------------------

describe('Boards', () => {
  it('GET /boards — returns board list', async () => {
    mb.getAllBoards.mockResolvedValue([makeBoard()] as never)
    const app = createApp()
    const res = await app.request('/boards')
    expect(res.status).toBe(200)
    const body = await parseBody(res)
    expect(body.success).toBe(true)
    expect(body.data[0].id).toBe('board-1')
  })

  it('POST /boards — creates a board', async () => {
    mb.createBoard.mockResolvedValue(makeBoard() as never)
    const app = createApp()
    const res = await app.request('/boards', post({ name: 'Main Board', slug: 'main-board' }))
    expect(res.status).toBe(201)
    const body = await parseBody(res)
    expect(body.success).toBe(true)
  })

  it('GET /boards/:id — returns board by ID', async () => {
    mb.getBoardById.mockResolvedValue(makeBoard() as never)
    const app = createApp()
    const res = await app.request('/boards/board-1')
    expect(res.status).toBe(200)
  })

  it('GET /boards/:id — 404 for missing board', async () => {
    mb.getBoardById.mockResolvedValue(null as never)
    const app = createApp()
    const res = await app.request('/boards/no-board')
    expect(res.status).toBe(404)
  })

  it('PATCH /boards/:id — updates board', async () => {
    mb.getBoardById.mockResolvedValue(makeBoard() as never)
    mb.updateBoard.mockResolvedValue(makeBoard({ name: 'Updated' }) as never)
    const app = createApp()
    const res = await app.request('/boards/board-1', patch({ name: 'Updated' }))
    expect(res.status).toBe(200)
  })

  it('DELETE /boards/:id — deletes board', async () => {
    mb.getBoardById.mockResolvedValue(makeBoard() as never)
    mb.deleteBoard.mockResolvedValue(undefined as never)
    const app = createApp()
    const res = await app.request('/boards/board-1', { method: 'DELETE' })
    expect(res.status).toBe(200)
    const body = await parseBody(res)
    expect(body.success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Column tests
// ---------------------------------------------------------------------------

describe('Columns', () => {
  it('GET /boards/:boardId/columns — returns columns', async () => {
    mb.getColumnsByBoard.mockResolvedValue([makeColumn()] as never)
    const app = createApp()
    const res = await app.request('/boards/board-1/columns')
    expect(res.status).toBe(200)
    const body = await parseBody(res)
    expect(body.data[0].boardId).toBe('board-1')
  })

  it('POST /boards/:boardId/columns — creates column', async () => {
    mb.createColumn.mockResolvedValue(makeColumn() as never)
    const app = createApp()
    const res = await app.request(
      '/boards/board-1/columns',
      post({ name: 'To Do', slug: 'to-do', position: 0 }),
    )
    expect(res.status).toBe(201)
  })

  it('PATCH /columns/:id — updates column', async () => {
    mb.updateColumn.mockResolvedValue(makeColumn({ name: 'In Progress' }) as never)
    const app = createApp()
    const res = await app.request('/columns/col-1', patch({ name: 'In Progress' }))
    expect(res.status).toBe(200)
  })

  it('PATCH /columns/:id — 404 for missing column', async () => {
    mb.updateColumn.mockResolvedValue(null as never)
    const app = createApp()
    const res = await app.request('/columns/no-col', patch({ name: 'x' }))
    expect(res.status).toBe(404)
  })

  it('DELETE /columns/:id — deletes column', async () => {
    mb.deleteColumn.mockResolvedValue(undefined as never)
    const app = createApp()
    const res = await app.request('/columns/col-1', { method: 'DELETE' })
    expect(res.status).toBe(200)
  })
})

// ---------------------------------------------------------------------------
// Ticket tests
// ---------------------------------------------------------------------------

describe('Tickets', () => {
  it('GET /boards/:boardId/tickets — returns ticket list', async () => {
    mb.getBoardById.mockResolvedValue(makeBoard() as never)
    mt.getTicketsByBoard.mockResolvedValue([makeTicket()] as never)
    const app = createApp()
    const res = await app.request('/boards/board-1/tickets')
    expect(res.status).toBe(200)
    const body = await parseBody(res)
    expect(body.data[0].id).toBe('ticket-1')
  })

  it('POST /boards/:boardId/tickets — creates ticket', async () => {
    mt.createTicket.mockResolvedValue(makeTicket() as never)
    const app = createApp()
    const res = await app.request('/boards/board-1/tickets', post({ title: 'Fix bug' }))
    expect(res.status).toBe(201)
  })

  it('POST /boards/:boardId/tickets — 400 when title is missing', async () => {
    const app = createApp()
    const res = await app.request('/boards/board-1/tickets', post({}))
    expect(res.status).toBe(400)
  })

  it('GET /tickets/:id — returns ticket by ID', async () => {
    mt.getTicketById.mockResolvedValue(makeTicket() as never)
    const app = createApp()
    const res = await app.request('/tickets/ticket-1')
    expect(res.status).toBe(200)
    const body = await parseBody(res)
    expect(body.data.title).toBe('Fix bug')
  })

  it('GET /tickets/:id — 404 for missing ticket', async () => {
    mt.getTicketById.mockResolvedValue(null as never)
    const app = createApp()
    const res = await app.request('/tickets/missing')
    expect(res.status).toBe(404)
  })

  it('PATCH /tickets/:id — updates ticket', async () => {
    mt.getTicketById.mockResolvedValue(makeTicket() as never)
    mb.getBoardById.mockResolvedValue(makeBoard() as never)
    mt.updateTicket.mockResolvedValue(makeTicket({ status: 'closed' }) as never)
    const app = createApp()
    const res = await app.request('/tickets/ticket-1', patch({ status: 'closed' }))
    expect(res.status).toBe(200)
  })

  it('PATCH /tickets/:id — 404 for missing ticket', async () => {
    mt.updateTicket.mockResolvedValue(null as never)
    const app = createApp()
    const res = await app.request('/tickets/no-ticket', patch({ status: 'closed' }))
    expect(res.status).toBe(404)
  })

  it('DELETE /tickets/:id — deletes ticket', async () => {
    mt.getTicketById.mockResolvedValue(makeTicket() as never)
    mb.getBoardById.mockResolvedValue(makeBoard() as never)
    mt.deleteTicket.mockResolvedValue(undefined as never)
    const app = createApp()
    const res = await app.request('/tickets/ticket-1', { method: 'DELETE' })
    expect(res.status).toBe(200)
  })

  it('POST /tickets/:id/move — moves ticket to column', async () => {
    mt.moveTicket.mockResolvedValue(makeTicket({ columnId: 'col-2' }) as never)
    const app = createApp()
    const res = await app.request(
      '/tickets/ticket-1/move',
      post({ columnId: 'col-2', sortOrder: 0 }),
    )
    expect(res.status).toBe(200)
    const body = await parseBody(res)
    expect(body.data.columnId).toBe('col-2')
  })

  it('POST /tickets/:id/move — 404 when ticket not found', async () => {
    mt.moveTicket.mockResolvedValue(null as never)
    const app = createApp()
    const res = await app.request('/tickets/bad/move', post({ columnId: 'col-1', sortOrder: 0 }))
    expect(res.status).toBe(404)
  })

  it('GET /tickets/:id/subtasks — returns subtasks', async () => {
    mt.getSubtickets.mockResolvedValue([
      makeTicket({ id: 'sub-1', parentTicketId: 'ticket-1' }),
    ] as never)
    const app = createApp()
    const res = await app.request('/tickets/ticket-1/subtasks')
    expect(res.status).toBe(200)
    const body = await parseBody(res)
    expect(body.data[0].parentTicketId).toBe('ticket-1')
  })
})

// ---------------------------------------------------------------------------
// Comment tests
// ---------------------------------------------------------------------------

describe('Comments', () => {
  it('GET /tickets/:id/comments — returns comment list', async () => {
    mc.getCommentsByTicket.mockResolvedValue([makeComment()] as never)
    const app = createApp()
    const res = await app.request('/tickets/ticket-1/comments')
    expect(res.status).toBe(200)
    const body = await parseBody(res)
    expect(body.data[0].ticketId).toBe('ticket-1')
  })

  it('POST /tickets/:id/comments — creates comment', async () => {
    mc.createComment.mockResolvedValue(makeComment() as never)
    const app = createApp()
    const res = await app.request('/tickets/ticket-1/comments', post({ body: { type: 'doc' } }))
    expect(res.status).toBe(201)
  })

  it('PATCH /comments/:id — updates comment', async () => {
    mc.updateComment.mockResolvedValue(makeComment() as never)
    const app = createApp()
    const res = await app.request('/comments/comment-1', patch({ body: { type: 'doc' } }))
    expect(res.status).toBe(200)
  })

  it('PATCH /comments/:id — 404 for missing comment', async () => {
    mc.updateComment.mockResolvedValue(null as never)
    const app = createApp()
    const res = await app.request('/comments/no-comment', patch({ body: { type: 'doc' } }))
    expect(res.status).toBe(404)
  })

  it('DELETE /comments/:id — deletes comment', async () => {
    mc.deleteComment.mockResolvedValue(undefined as never)
    const app = createApp()
    const res = await app.request('/comments/comment-1', { method: 'DELETE' })
    expect(res.status).toBe(200)
  })
})

// ---------------------------------------------------------------------------
// Label tests
// ---------------------------------------------------------------------------

describe('Labels', () => {
  it('GET /labels — returns label list', async () => {
    ml.getAllLabels.mockResolvedValue([makeLabel()] as never)
    const app = createApp()
    const res = await app.request('/labels')
    expect(res.status).toBe(200)
    const body = await parseBody(res)
    expect(body.data[0].name).toBe('bug')
  })

  it('POST /labels — creates label', async () => {
    ml.createLabel.mockResolvedValue(makeLabel() as never)
    const app = createApp()
    const res = await app.request('/labels', post({ name: 'bug', slug: 'bug' }))
    expect(res.status).toBe(201)
  })

  it('PATCH /labels/:id — updates label', async () => {
    ml.updateLabel.mockResolvedValue(makeLabel({ name: 'feature' }) as never)
    const app = createApp()
    const res = await app.request('/labels/label-1', patch({ name: 'feature' }))
    expect(res.status).toBe(200)
  })

  it('PATCH /labels/:id — 404 for missing label', async () => {
    ml.updateLabel.mockResolvedValue(null as never)
    const app = createApp()
    const res = await app.request('/labels/no-label', patch({ name: 'x' }))
    expect(res.status).toBe(404)
  })

  it('DELETE /labels/:id — deletes label', async () => {
    ml.deleteLabel.mockResolvedValue(undefined as never)
    const app = createApp()
    const res = await app.request('/labels/label-1', { method: 'DELETE' })
    expect(res.status).toBe(200)
  })

  it('POST /tickets/:id/labels — assigns label to ticket', async () => {
    ml.assignLabel.mockResolvedValue({
      id: 'assign-1',
      ticketId: 'ticket-1',
      labelId: 'label-1',
      assignedAt: new Date(),
    } as never)
    const app = createApp()
    const res = await app.request('/tickets/ticket-1/labels', post({ labelId: 'label-1' }))
    expect(res.status).toBe(201)
    const body = await parseBody(res)
    expect(body.data.labelId).toBe('label-1')
  })

  it('GET /tickets/:id/labels — returns labels for ticket', async () => {
    ml.getLabelsForTicket.mockResolvedValue([makeLabel()] as never)
    const app = createApp()
    const res = await app.request('/tickets/ticket-1/labels')
    expect(res.status).toBe(200)
    const body = await parseBody(res)
    expect(body.data[0].name).toBe('bug')
  })

  it('DELETE /tickets/:id/labels/:labelId — removes label from ticket', async () => {
    ml.removeLabel.mockResolvedValue(undefined as never)
    const app = createApp()
    const res = await app.request('/tickets/ticket-1/labels/label-1', { method: 'DELETE' })
    expect(res.status).toBe(200)
  })
})
