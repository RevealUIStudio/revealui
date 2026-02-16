import type { DatabaseClient } from '@revealui/db/client'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import app from '../src/index.js'

/**
 * Integration Tests for apps/api
 *
 * Covers:
 * 1. Health endpoint (/health)
 * 2. Boards CRUD (/api/tickets/boards)
 * 3. Tickets CRUD (/api/tickets/boards/:boardId/tickets, /api/tickets/tickets/:id)
 * 4. Ticket move (/api/tickets/tickets/:id/move)
 * 5. Comments (/api/tickets/tickets/:id/comments)
 * 6. Labels (/api/tickets/labels, /api/tickets/tickets/:id/labels)
 * 7. CORS headers
 */

const mockBoards = [
  {
    id: 'board-1',
    name: 'Main Board',
    slug: 'main-board',
    description: null,
    ownerId: null,
    tenantId: null,
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]

const mockTickets = [
  {
    id: 'ticket-1',
    boardId: 'board-1',
    columnId: 'col-1',
    parentTicketId: null,
    ticketNumber: 1,
    title: 'Test ticket',
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
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]

const mockDb = {
  query: {},
  insert: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
} as unknown as DatabaseClient

// Mock the board queries module
vi.mock('@revealui/db/queries/boards', () => ({
  getAllBoards: vi.fn().mockResolvedValue(mockBoards),
  getBoardById: vi.fn().mockImplementation((_db: unknown, id: string) => {
    const board = mockBoards.find((b) => b.id === id)
    return Promise.resolve(board ?? null)
  }),
  getBoardBySlug: vi.fn().mockResolvedValue(mockBoards[0]),
  createBoard: vi.fn().mockResolvedValue(mockBoards[0]),
  updateBoard: vi.fn().mockResolvedValue(mockBoards[0]),
  deleteBoard: vi.fn().mockResolvedValue(undefined),
  getColumnsByBoard: vi.fn().mockResolvedValue([]),
  createColumn: vi
    .fn()
    .mockResolvedValue({
      id: 'col-1',
      boardId: 'board-1',
      name: 'To Do',
      slug: 'todo',
      position: 0,
    }),
  updateColumn: vi.fn().mockResolvedValue({ id: 'col-1', name: 'Updated' }),
  deleteColumn: vi.fn().mockResolvedValue(undefined),
}))

// Mock the ticket queries module
vi.mock('@revealui/db/queries/tickets', () => ({
  getTicketsByBoard: vi.fn().mockResolvedValue(mockTickets),
  getTicketById: vi.fn().mockImplementation((_db: unknown, id: string) => {
    const ticket = mockTickets.find((t) => t.id === id)
    return Promise.resolve(ticket ?? null)
  }),
  getTicketByNumber: vi.fn().mockResolvedValue(mockTickets[0]),
  createTicket: vi.fn().mockResolvedValue(mockTickets[0]),
  updateTicket: vi.fn().mockResolvedValue(mockTickets[0]),
  deleteTicket: vi.fn().mockResolvedValue(undefined),
  moveTicket: vi.fn().mockResolvedValue(mockTickets[0]),
  getSubtickets: vi.fn().mockResolvedValue([]),
  getTicketsByColumn: vi.fn().mockResolvedValue(mockTickets),
  getOverdueTickets: vi.fn().mockResolvedValue([]),
}))

// Mock the comment queries module
vi.mock('@revealui/db/queries/ticket-comments', () => ({
  getCommentsByTicket: vi.fn().mockResolvedValue([]),
  createComment: vi
    .fn()
    .mockResolvedValue({
      id: 'comment-1',
      ticketId: 'ticket-1',
      body: 'test',
      createdAt: new Date(),
    }),
  updateComment: vi.fn().mockResolvedValue({ id: 'comment-1', body: 'updated' }),
  deleteComment: vi.fn().mockResolvedValue(undefined),
}))

// Mock the label queries module
vi.mock('@revealui/db/queries/ticket-labels', () => ({
  getAllLabels: vi.fn().mockResolvedValue([]),
  createLabel: vi
    .fn()
    .mockResolvedValue({ id: 'label-1', name: 'Bug', slug: 'bug', color: '#ff0000' }),
  updateLabel: vi.fn().mockResolvedValue({ id: 'label-1', name: 'Updated' }),
  deleteLabel: vi.fn().mockResolvedValue(undefined),
  assignLabel: vi
    .fn()
    .mockResolvedValue({ id: 'assign-1', ticketId: 'ticket-1', labelId: 'label-1' }),
  removeLabel: vi.fn().mockResolvedValue(undefined),
  getLabelsForTicket: vi.fn().mockResolvedValue([]),
}))

// Mock the database middleware
vi.mock('../src/middleware/db.js', () => ({
  dbMiddleware:
    () => async (c: { set: (key: string, value: unknown) => void }, next: () => Promise<void>) => {
      c.set('db', mockDb)
      await next()
    },
}))

describe('API Endpoints', () => {
  beforeAll(() => {
    vi.stubEnv('NODE_ENV', 'test')
  })

  afterAll(() => {
    vi.unstubAllEnvs()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // =========================================================================
  // Health
  // =========================================================================

  describe('GET /health', () => {
    it('should return healthy status', async () => {
      const res = await app.request('/health')
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.status).toBe('ok')
    })
  })

  // =========================================================================
  // Boards
  // =========================================================================

  describe('Boards API', () => {
    it('GET /api/tickets/boards — list boards', async () => {
      const res = await app.request('/api/tickets/boards')
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(Array.isArray(body.data)).toBe(true)
    })

    it('POST /api/tickets/boards — create board', async () => {
      const res = await app.request('/api/tickets/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Board', slug: 'new-board' }),
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.success).toBe(true)
    })

    it('GET /api/tickets/boards/:id — get board', async () => {
      const res = await app.request('/api/tickets/boards/board-1')
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
    })

    it('GET /api/tickets/boards/:id — 404 for missing board', async () => {
      const res = await app.request('/api/tickets/boards/nonexistent')
      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.success).toBe(false)
    })
  })

  // =========================================================================
  // Tickets
  // =========================================================================

  describe('Tickets API', () => {
    it('GET /api/tickets/boards/:boardId/tickets — list tickets', async () => {
      const res = await app.request('/api/tickets/boards/board-1/tickets')
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(Array.isArray(body.data)).toBe(true)
    })

    it('POST /api/tickets/boards/:boardId/tickets — create ticket', async () => {
      const res = await app.request('/api/tickets/boards/board-1/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New ticket' }),
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.success).toBe(true)
    })

    it('GET /api/tickets/tickets/:id — get ticket', async () => {
      const res = await app.request('/api/tickets/tickets/ticket-1')
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
    })

    it('GET /api/tickets/tickets/:id — 404 for missing ticket', async () => {
      const res = await app.request('/api/tickets/tickets/nonexistent')
      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.success).toBe(false)
    })

    it('POST /api/tickets/tickets/:id/move — move ticket', async () => {
      const res = await app.request('/api/tickets/tickets/ticket-1/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ columnId: 'col-2', sortOrder: 0 }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
    })
  })

  // =========================================================================
  // Comments
  // =========================================================================

  describe('Comments API', () => {
    it('GET /api/tickets/tickets/:id/comments — list comments', async () => {
      const res = await app.request('/api/tickets/tickets/ticket-1/comments')
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(Array.isArray(body.data)).toBe(true)
    })

    it('POST /api/tickets/tickets/:id/comments — add comment', async () => {
      const res = await app.request('/api/tickets/tickets/ticket-1/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: 'Test comment' }),
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.success).toBe(true)
    })
  })

  // =========================================================================
  // Labels
  // =========================================================================

  describe('Labels API', () => {
    it('GET /api/tickets/labels — list labels', async () => {
      const res = await app.request('/api/tickets/labels')
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(Array.isArray(body.data)).toBe(true)
    })

    it('POST /api/tickets/labels — create label', async () => {
      const res = await app.request('/api/tickets/labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Bug', slug: 'bug', color: '#ff0000' }),
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.success).toBe(true)
    })
  })

  // =========================================================================
  // CORS
  // =========================================================================

  describe('CORS', () => {
    it('should include CORS headers for allowed origins', async () => {
      const res = await app.request('/health', {
        headers: { Origin: 'http://localhost:3000' },
      })
      expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:3000')
    })
  })
})
