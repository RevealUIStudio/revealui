import type { DatabaseClient } from '@revealui/db/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../src/index.js';

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
 * 7. Code Provenance CRUD (/api/provenance)
 * 8. CORS headers
 */

// Use vi.hoisted so mock data is available to hoisted vi.mock factories
const { mockBoards, mockTickets } = vi.hoisted(() => ({
  mockBoards: [
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
  ],
  mockTickets: [
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
  ],
}));

const mockDb = {
  query: {},
  insert: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
} as unknown as DatabaseClient;

// Mock the board queries module
vi.mock('@revealui/db/queries/boards', () => ({
  getAllBoards: vi.fn().mockResolvedValue(mockBoards),
  getBoardById: vi.fn().mockImplementation((_db: unknown, id: string) => {
    const board = mockBoards.find((b) => b.id === id);
    return Promise.resolve(board ?? null);
  }),
  getBoardBySlug: vi.fn().mockResolvedValue(mockBoards[0]),
  createBoard: vi.fn().mockResolvedValue(mockBoards[0]),
  updateBoard: vi.fn().mockResolvedValue(mockBoards[0]),
  deleteBoard: vi.fn().mockResolvedValue(undefined),
  getColumnsByBoard: vi.fn().mockResolvedValue([]),
  createColumn: vi.fn().mockResolvedValue({
    id: 'col-1',
    boardId: 'board-1',
    name: 'To Do',
    slug: 'todo',
    position: 0,
  }),
  getColumnById: vi
    .fn()
    .mockImplementation((_db: unknown, id: string) =>
      Promise.resolve(id === 'col-1' ? { id: 'col-1', boardId: 'board-1' } : null),
    ),
  updateColumn: vi.fn().mockResolvedValue({ id: 'col-1', name: 'Updated' }),
  deleteColumn: vi.fn().mockResolvedValue(undefined),
}));

// Mock the ticket queries module
vi.mock('@revealui/db/queries/tickets', () => ({
  getTicketsByBoard: vi.fn().mockResolvedValue(mockTickets),
  getTicketById: vi.fn().mockImplementation((_db: unknown, id: string) => {
    const ticket = mockTickets.find((t) => t.id === id);
    return Promise.resolve(ticket ?? null);
  }),
  getTicketByNumber: vi.fn().mockResolvedValue(mockTickets[0]),
  createTicket: vi.fn().mockResolvedValue(mockTickets[0]),
  updateTicket: vi.fn().mockResolvedValue(mockTickets[0]),
  deleteTicket: vi.fn().mockResolvedValue(undefined),
  moveTicket: vi.fn().mockResolvedValue(mockTickets[0]),
  getSubtickets: vi.fn().mockResolvedValue([]),
  getTicketsByColumn: vi.fn().mockResolvedValue(mockTickets),
  getOverdueTickets: vi.fn().mockResolvedValue([]),
}));

// Mock the comment queries module
vi.mock('@revealui/db/queries/ticket-comments', () => ({
  getCommentsByTicket: vi.fn().mockResolvedValue([]),
  createComment: vi.fn().mockResolvedValue({
    id: 'comment-1',
    ticketId: 'ticket-1',
    body: 'test',
    createdAt: new Date(),
  }),
  getCommentById: vi
    .fn()
    .mockImplementation((_db: unknown, id: string) =>
      Promise.resolve(
        id === 'comment-1' ? { id: 'comment-1', ticketId: 'ticket-1', authorId: null } : null,
      ),
    ),
  updateComment: vi.fn().mockResolvedValue({ id: 'comment-1', body: 'updated' }),
  deleteComment: vi.fn().mockResolvedValue(undefined),
}));

// Mock the provenance queries module
// Note: inline data because vi.mock factories are hoisted before const declarations
vi.mock('@revealui/db/queries/code-provenance', () => {
  const prov = {
    id: 'prov-1',
    schemaVersion: '1',
    filePath: 'packages/core/src/index.ts',
    functionName: null,
    lineStart: null,
    lineEnd: null,
    authorType: 'ai_generated',
    aiModel: 'claude-opus-4.6',
    aiSessionId: null,
    gitCommitHash: 'abc123',
    gitAuthor: 'Claude',
    confidence: 0.95,
    reviewStatus: 'unreviewed',
    reviewedBy: null,
    reviewedAt: null,
    linesOfCode: 150,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return {
    getAllProvenance: vi.fn().mockResolvedValue([prov]),
    getProvenanceById: vi.fn().mockImplementation((_db: unknown, id: string) => {
      return Promise.resolve(id === 'prov-1' ? prov : null);
    }),
    getProvenanceByFile: vi.fn().mockResolvedValue([prov]),
    getProvenanceByCommit: vi.fn().mockResolvedValue([prov]),
    getUnreviewedProvenance: vi.fn().mockResolvedValue([prov]),
    createProvenance: vi.fn().mockResolvedValue(prov),
    updateProvenance: vi.fn().mockImplementation((_db: unknown, id: string) => {
      return Promise.resolve(id === 'prov-1' ? prov : null);
    }),
    updateReviewStatus: vi.fn().mockResolvedValue(prov),
    deleteProvenance: vi.fn().mockResolvedValue(undefined),
    getProvenanceStats: vi.fn().mockResolvedValue({
      byAuthorType: [{ authorType: 'ai_generated', count: 1, totalLines: 150 }],
      byReviewStatus: [{ reviewStatus: 'unreviewed', count: 1 }],
    }),
    getReviewsForProvenance: vi.fn().mockResolvedValue([]),
    createReview: vi.fn().mockResolvedValue({
      id: 'review-1',
      provenanceId: 'prov-1',
      reviewerId: null,
      reviewType: 'human_review',
      status: 'approved',
      comment: null,
      metadata: {},
      createdAt: new Date(),
    }),
  };
});

// Mock the label queries module
vi.mock('@revealui/db/queries/ticket-labels', () => ({
  getAllLabels: vi.fn().mockResolvedValue([]),
  createLabel: vi
    .fn()
    .mockResolvedValue({ id: 'label-1', name: 'Bug', slug: 'bug', color: '#ff0000' }),
  getLabelById: vi
    .fn()
    .mockImplementation((_db: unknown, id: string) =>
      Promise.resolve(id === 'label-1' ? { id: 'label-1', name: 'Bug', tenantId: null } : null),
    ),
  updateLabel: vi.fn().mockResolvedValue({ id: 'label-1', name: 'Updated' }),
  deleteLabel: vi.fn().mockResolvedValue(undefined),
  assignLabel: vi
    .fn()
    .mockResolvedValue({ id: 'assign-1', ticketId: 'ticket-1', labelId: 'label-1' }),
  removeLabel: vi.fn().mockResolvedValue(undefined),
  getLabelsForTicket: vi.fn().mockResolvedValue([]),
}));

// Mock external I/O dependencies that hang in test environment
vi.mock('@revealui/auth/server', () => ({
  checkRateLimit: vi
    .fn()
    .mockResolvedValue({ allowed: true, remaining: 100, resetAt: Date.now() + 60_000 }),
  getSession: vi.fn().mockResolvedValue({
    user: { id: 'test-user', email: 'test@example.com', role: 'admin' },
    session: { id: 'test-session', expiresAt: new Date(Date.now() + 86_400_000) },
  }),
}));

vi.mock('@revealui/core/license', () => ({
  getCurrentTier: vi.fn(() => 'free'),
  isLicensed: vi.fn(() => true),
  getLicensePayload: vi.fn(() => null),
  initializeLicense: vi.fn().mockResolvedValue('free'),
}));

vi.mock('@revealui/core/features', () => ({
  isFeatureEnabled: vi.fn(() => true),
  getRequiredTier: vi.fn(() => 'pro'),
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// Mock the database middleware
vi.mock('../src/middleware/db.js', () => ({
  dbMiddleware:
    () => async (c: { set: (key: string, value: unknown) => void }, next: () => Promise<void>) => {
      c.set('db', mockDb);
      await next();
    },
}));

vi.mock('../src/middleware/entitlements.js', () => ({
  entitlementMiddleware:
    () => async (c: { set: (key: string, value: unknown) => void }, next: () => Promise<void>) => {
      c.set('entitlements', {
        userId: 'test-user',
        accountId: 'account-1',
        membershipRole: 'owner',
        subscriptionStatus: 'active',
        tier: 'enterprise',
        features: {
          ai: true,
          dashboard: true,
        },
        limits: {
          maxAgentTasks: 1000,
        },
        resolvedAt: new Date(),
      });
      await next();
    },
}));

describe('API Endpoints', () => {
  beforeAll(() => {
    vi.stubEnv('NODE_ENV', 'test');
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // Health
  // =========================================================================

  describe('GET /health', () => {
    it('should return healthy status', async () => {
      const res = await app.request('/health');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('ok');
    });
  });

  // =========================================================================
  // Boards
  // =========================================================================

  describe('Boards API', () => {
    it('GET /api/tickets/boards  -  list boards', async () => {
      const res = await app.request('/api/tickets/boards');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });

    it('POST /api/tickets/boards  -  create board', async () => {
      const res = await app.request('/api/tickets/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Board', slug: 'new-board' }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    it('GET /api/tickets/boards/:id  -  get board', async () => {
      const res = await app.request('/api/tickets/boards/board-1');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    it('GET /api/tickets/boards/:id  -  404 for missing board', async () => {
      const res = await app.request('/api/tickets/boards/nonexistent');
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.success).toBe(false);
    });
  });

  // =========================================================================
  // Tickets
  // =========================================================================

  describe('Tickets API', () => {
    it('GET /api/tickets/boards/:boardId/tickets  -  list tickets', async () => {
      const res = await app.request('/api/tickets/boards/board-1/tickets');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });

    it('POST /api/tickets/boards/:boardId/tickets  -  create ticket', async () => {
      const res = await app.request('/api/tickets/boards/board-1/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New ticket' }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    it('GET /api/tickets/tickets/:id  -  get ticket', async () => {
      const res = await app.request('/api/tickets/tickets/ticket-1');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    it('GET /api/tickets/tickets/:id  -  404 for missing ticket', async () => {
      const res = await app.request('/api/tickets/tickets/nonexistent');
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.success).toBe(false);
    });

    it('POST /api/tickets/tickets/:id/move  -  move ticket', async () => {
      const res = await app.request('/api/tickets/tickets/ticket-1/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ columnId: 'col-2', sortOrder: 0 }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });
  });

  // =========================================================================
  // Comments
  // =========================================================================

  describe('Comments API', () => {
    it('GET /api/tickets/tickets/:id/comments  -  list comments', async () => {
      const res = await app.request('/api/tickets/tickets/ticket-1/comments');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });

    it('POST /api/tickets/tickets/:id/comments  -  add comment', async () => {
      const res = await app.request('/api/tickets/tickets/ticket-1/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: { content: 'Test comment' } }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);
    });
  });

  // =========================================================================
  // Labels
  // =========================================================================

  describe('Labels API', () => {
    it('GET /api/tickets/labels  -  list labels', async () => {
      const res = await app.request('/api/tickets/labels');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });

    it('POST /api/tickets/labels  -  create label', async () => {
      const res = await app.request('/api/tickets/labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Bug', slug: 'bug', color: '#ff0000' }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);
    });
  });

  // =========================================================================
  // Code Provenance
  // =========================================================================

  describe('Provenance API', () => {
    it('GET /api/provenance  -  list provenance entries', async () => {
      const res = await app.request('/api/provenance');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });

    it('GET /api/provenance?authorType=ai_generated  -  filter by author type', async () => {
      const res = await app.request('/api/provenance?authorType=ai_generated');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    it('POST /api/provenance  -  create provenance entry', async () => {
      const res = await app.request('/api/provenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: 'packages/core/src/new.ts',
          authorType: 'ai_generated',
          aiModel: 'claude-opus-4.6',
          confidence: 0.9,
          linesOfCode: 50,
        }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    it('GET /api/provenance/:id  -  get provenance entry', async () => {
      const res = await app.request('/api/provenance/prov-1');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    it('GET /api/provenance/:id  -  404 for missing entry', async () => {
      const res = await app.request('/api/provenance/nonexistent');
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.success).toBe(false);
    });

    it('PATCH /api/provenance/:id  -  update provenance entry', async () => {
      const res = await app.request('/api/provenance/prov-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confidence: 1.0 }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    it('DELETE /api/provenance/:id  -  delete provenance entry', async () => {
      const res = await app.request('/api/provenance/prov-1', {
        method: 'DELETE',
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    it('GET /api/provenance/stats  -  get aggregate statistics', async () => {
      const res = await app.request('/api/provenance/stats');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('byAuthorType');
      expect(body.data).toHaveProperty('byReviewStatus');
    });

    it('POST /api/provenance/:id/review  -  add review', async () => {
      const res = await app.request('/api/provenance/prov-1/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewType: 'human_review',
          status: 'approved',
          comment: 'Looks good',
        }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    it('GET /api/provenance/:id/reviews  -  list reviews', async () => {
      const res = await app.request('/api/provenance/prov-1/reviews');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });
  });

  // =========================================================================
  // CORS
  // =========================================================================

  describe('CORS', () => {
    it('should include CORS headers for allowed origins', async () => {
      const res = await app.request('/health', {
        headers: { Origin: 'http://localhost:3000' },
      });
      expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
    });
  });
});
