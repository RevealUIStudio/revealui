import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the DB query module
// ---------------------------------------------------------------------------
vi.mock('@revealui/db/queries/code-provenance', () => ({
  getAllProvenance: vi.fn(),
  getProvenanceStats: vi.fn(),
  getProvenanceByFile: vi.fn(),
  getProvenanceById: vi.fn(),
  createProvenance: vi.fn(),
  updateProvenance: vi.fn(),
  deleteProvenance: vi.fn(),
  createReview: vi.fn(),
  updateReviewStatus: vi.fn(),
  getReviewsForProvenance: vi.fn(),
}));

import type { DatabaseClient } from '@revealui/db/client';
import * as provenanceQueries from '@revealui/db/queries/code-provenance';
import provenanceApp from '../code-provenance.js';

const mq = vi.mocked(provenanceQueries);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = new Date();

function makeEntry(overrides = {}) {
  return {
    id: 'prov-1',
    schemaVersion: '1',
    filePath: 'packages/core/src/index.ts',
    functionName: null as string | null,
    lineStart: null as number | null,
    lineEnd: null as number | null,
    authorType: 'ai_generated',
    aiModel: 'claude-3' as string | null,
    aiSessionId: null as string | null,
    gitCommitHash: null as string | null,
    gitAuthor: null as string | null,
    confidence: 0.9,
    reviewStatus: 'unreviewed',
    reviewedBy: null as string | null,
    reviewedAt: null as Date | null,
    linesOfCode: 42,
    metadata: null as unknown,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeReview(overrides = {}) {
  return {
    id: 'rev-1',
    provenanceId: 'prov-1',
    reviewerId: null as string | null,
    reviewType: 'human_review',
    status: 'approved',
    comment: null as string | null,
    metadata: null as unknown,
    createdAt: NOW,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// App factory
// ---------------------------------------------------------------------------

const DEFAULT_USER = { id: 'test-user', role: 'admin' };

function createApp(user?: { id: string; role: string } | null) {
  const app = new Hono<{
    Variables: { db: DatabaseClient; user?: { id: string; role: string } };
  }>();
  // Pass `null` to explicitly omit user context; omitting the argument uses DEFAULT_USER.
  const effectiveUser = user === null ? undefined : (user ?? DEFAULT_USER);
  app.use('*', async (c, next) => {
    c.set('db', {} as DatabaseClient);
    if (effectiveUser) c.set('user', effectiveUser);
    await next();
  });
  app.route('/', provenanceApp);
  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return c.json({ success: false, error: err.message, code: `HTTP_${err.status}` }, err.status);
    }
    return c.json({ success: false, error: 'Internal error' }, 500);
  });
  return app;
}

function json(body: unknown) {
  return {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  };
}

function patch(body: unknown) {
  return {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  };
}

// biome-ignore lint/suspicious/noExplicitAny: test helper  -  response shape varies per endpoint
async function parseBody(res: Response): Promise<any> {
  return res.json();
}

// ---------------------------------------------------------------------------

describe('GET /  -  list provenance', () => {
  it('returns 200 with a data array', async () => {
    mq.getAllProvenance.mockResolvedValue([makeEntry()] as never);
    const app = createApp();
    const res = await app.request('/');
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(1);
  });

  it('returns empty data array when no entries exist', async () => {
    mq.getAllProvenance.mockResolvedValue([]);
    const app = createApp();
    const res = await app.request('/');
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
  });

  it('passes query filters to getAllProvenance', async () => {
    mq.getAllProvenance.mockResolvedValue([]);
    const app = createApp();
    await app.request('/?authorType=ai_generated&reviewStatus=unreviewed');
    expect(mq.getAllProvenance).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ authorType: 'ai_generated', reviewStatus: 'unreviewed' }),
    );
  });
});

describe('GET /stats', () => {
  it('returns aggregate stats', async () => {
    mq.getProvenanceStats.mockResolvedValue({
      byAuthorType: [{ authorType: 'ai_generated', count: 5, totalLines: 100 }],
      byReviewStatus: [{ reviewStatus: 'unreviewed', count: 5 }],
    });
    const app = createApp();
    const res = await app.request('/stats');
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.success).toBe(true);
    expect(body.data.byAuthorType).toHaveLength(1);
    expect(body.data.byReviewStatus).toHaveLength(1);
  });
});

describe('GET /file/:filePath', () => {
  it('returns entries for a specific file', async () => {
    mq.getProvenanceByFile.mockResolvedValue([makeEntry()] as never);
    const app = createApp();
    const res = await app.request('/file/packages%2Fcore%2Fsrc%2Findex.ts');
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });
});

describe('GET /:id', () => {
  it('returns 200 for an existing entry', async () => {
    mq.getProvenanceById.mockResolvedValue(makeEntry() as never);
    const app = createApp();
    const res = await app.request('/prov-1');
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe('prov-1');
  });

  it('returns 404 when entry does not exist', async () => {
    mq.getProvenanceById.mockResolvedValue(null as never);
    const app = createApp();
    const res = await app.request('/no-such-id');
    expect(res.status).toBe(404);
    const body = await parseBody(res);
    expect(body.success).toBe(false);
  });
});

describe('POST /  -  create entry', () => {
  it('creates and returns a new entry with 201', async () => {
    mq.createProvenance.mockResolvedValue(makeEntry() as never);
    const app = createApp();
    const res = await app.request(
      '/',
      json({ filePath: 'src/foo.ts', authorType: 'ai_generated' }),
    );
    expect(res.status).toBe(201);
    const body = await parseBody(res);
    expect(body.success).toBe(true);
    expect(body.data.filePath).toBe('packages/core/src/index.ts');
  });

  it('returns 400 when filePath is missing', async () => {
    const app = createApp();
    const res = await app.request('/', json({ authorType: 'ai_generated' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when authorType is not a valid enum value', async () => {
    const app = createApp();
    const res = await app.request('/', json({ filePath: 'src/x.ts', authorType: 'robot' }));
    expect(res.status).toBe(400);
  });

  it('returns 500 when createProvenance returns null', async () => {
    mq.createProvenance.mockResolvedValue(null as never);
    const app = createApp();
    const res = await app.request(
      '/',
      json({ filePath: 'src/foo.ts', authorType: 'human_written' }),
    );
    expect(res.status).toBe(500);
  });

  it('returns 400 when authorType is missing', async () => {
    const app = createApp();
    const res = await app.request('/', json({ filePath: 'src/foo.ts' }));
    expect(res.status).toBe(400);
  });
});

describe('PATCH /:id  -  update entry', () => {
  it('updates and returns the entry', async () => {
    mq.updateProvenance.mockResolvedValue(makeEntry({ reviewStatus: 'human_reviewed' }) as never);
    const app = createApp();
    const res = await app.request('/prov-1', patch({ reviewStatus: 'human_reviewed' }));
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.data.reviewStatus).toBe('human_reviewed');
  });

  it('returns 404 when entry does not exist', async () => {
    mq.updateProvenance.mockResolvedValue(null as never);
    const app = createApp();
    const res = await app.request('/missing', patch({ reviewStatus: 'human_reviewed' }));
    expect(res.status).toBe(404);
  });

  it('returns 400 when reviewStatus is not a valid enum value', async () => {
    const app = createApp();
    const res = await app.request('/prov-1', patch({ reviewStatus: 'robot_reviewed' }));
    expect(res.status).toBe(400);
  });
});

describe('DELETE /:id', () => {
  it('deletes an entry and returns success message', async () => {
    mq.deleteProvenance.mockResolvedValue(undefined as never);
    const app = createApp({ id: 'admin-1', role: 'admin' });
    const res = await app.request('/prov-1', { method: 'DELETE' });
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.success).toBe(true);
    expect(typeof body.message).toBe('string');
  });

  it('returns 403 when a non-admin user tries to delete', async () => {
    const app = createApp({ id: 'user-1', role: 'user' });
    const res = await app.request('/prov-1', { method: 'DELETE' });
    expect(res.status).toBe(403);
    const body = await parseBody(res);
    expect(body.error).toContain('Admin role required');
  });

  it('returns 403 when no user context is set', async () => {
    const app = createApp(null); // no user
    const res = await app.request('/prov-1', { method: 'DELETE' });
    expect(res.status).toBe(403);
  });
});

describe('POST /:id/review', () => {
  it('adds a review and returns 201', async () => {
    mq.getProvenanceById.mockResolvedValue(makeEntry() as never);
    mq.createReview.mockResolvedValue(makeReview() as never);
    mq.updateReviewStatus.mockResolvedValue(undefined as never);
    const app = createApp();
    const res = await app.request(
      '/prov-1/review',
      json({ reviewType: 'human_review', status: 'approved' }),
    );
    expect(res.status).toBe(201);
    const body = await parseBody(res);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe('rev-1');
  });

  it('returns 404 when provenance entry does not exist', async () => {
    mq.getProvenanceById.mockResolvedValue(null as never);
    const app = createApp();
    const res = await app.request(
      '/no-id/review',
      json({ reviewType: 'human_review', status: 'approved' }),
    );
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid reviewType', async () => {
    const app = createApp();
    const res = await app.request(
      '/prov-1/review',
      json({ reviewType: 'bad', status: 'approved' }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 500 when createReview returns null', async () => {
    mq.getProvenanceById.mockResolvedValue(makeEntry() as never);
    mq.createReview.mockResolvedValue(null as never);
    mq.updateReviewStatus.mockResolvedValue(undefined as never);
    const app = createApp();
    const res = await app.request(
      '/prov-1/review',
      json({ reviewType: 'human_review', status: 'approved' }),
    );
    expect(res.status).toBe(500);
  });

  it('returns 400 for invalid review status', async () => {
    const app = createApp();
    const res = await app.request(
      '/prov-1/review',
      json({ reviewType: 'human_review', status: 'invalid_status' }),
    );
    expect(res.status).toBe(400);
  });

  it('transitions unreviewed → human_reviewed on human_review', async () => {
    mq.getProvenanceById.mockResolvedValue(makeEntry({ reviewStatus: 'unreviewed' }) as never);
    mq.createReview.mockResolvedValue(makeReview() as never);
    mq.updateReviewStatus.mockResolvedValue(undefined as never);
    const app = createApp();
    await app.request('/prov-1/review', json({ reviewType: 'human_review', status: 'approved' }));
    expect(mq.updateReviewStatus).toHaveBeenCalledWith(
      expect.anything(),
      'prov-1',
      'human_reviewed',
      undefined,
    );
  });

  it('transitions unreviewed → ai_reviewed on ai_review', async () => {
    mq.getProvenanceById.mockResolvedValue(makeEntry({ reviewStatus: 'unreviewed' }) as never);
    mq.createReview.mockResolvedValue(makeReview({ reviewType: 'ai_review' }) as never);
    mq.updateReviewStatus.mockResolvedValue(undefined as never);
    const app = createApp();
    await app.request('/prov-1/review', json({ reviewType: 'ai_review', status: 'approved' }));
    expect(mq.updateReviewStatus).toHaveBeenCalledWith(
      expect.anything(),
      'prov-1',
      'ai_reviewed',
      undefined,
    );
  });

  it('transitions ai_reviewed → human_and_ai_reviewed on human_review', async () => {
    mq.getProvenanceById.mockResolvedValue(makeEntry({ reviewStatus: 'ai_reviewed' }) as never);
    mq.createReview.mockResolvedValue(makeReview() as never);
    mq.updateReviewStatus.mockResolvedValue(undefined as never);
    const app = createApp();
    await app.request('/prov-1/review', json({ reviewType: 'human_review', status: 'approved' }));
    expect(mq.updateReviewStatus).toHaveBeenCalledWith(
      expect.anything(),
      'prov-1',
      'human_and_ai_reviewed',
      undefined,
    );
  });

  it('transitions human_reviewed → human_and_ai_reviewed on ai_review', async () => {
    mq.getProvenanceById.mockResolvedValue(makeEntry({ reviewStatus: 'human_reviewed' }) as never);
    mq.createReview.mockResolvedValue(makeReview({ reviewType: 'ai_review' }) as never);
    mq.updateReviewStatus.mockResolvedValue(undefined as never);
    const app = createApp();
    await app.request('/prov-1/review', json({ reviewType: 'ai_review', status: 'approved' }));
    expect(mq.updateReviewStatus).toHaveBeenCalledWith(
      expect.anything(),
      'prov-1',
      'human_and_ai_reviewed',
      undefined,
    );
  });

  it('human_approval counts as human review for transitions', async () => {
    mq.getProvenanceById.mockResolvedValue(makeEntry({ reviewStatus: 'ai_reviewed' }) as never);
    mq.createReview.mockResolvedValue(makeReview({ reviewType: 'human_approval' }) as never);
    mq.updateReviewStatus.mockResolvedValue(undefined as never);
    const app = createApp();
    await app.request('/prov-1/review', json({ reviewType: 'human_approval', status: 'approved' }));
    expect(mq.updateReviewStatus).toHaveBeenCalledWith(
      expect.anything(),
      'prov-1',
      'human_and_ai_reviewed',
      undefined,
    );
  });

  it('passes reviewerId to updateReviewStatus', async () => {
    mq.getProvenanceById.mockResolvedValue(makeEntry() as never);
    mq.createReview.mockResolvedValue(makeReview() as never);
    mq.updateReviewStatus.mockResolvedValue(undefined as never);
    const app = createApp();
    await app.request(
      '/prov-1/review',
      json({
        reviewType: 'human_review',
        status: 'approved',
        reviewerId: 'reviewer-42',
      }),
    );
    expect(mq.updateReviewStatus).toHaveBeenCalledWith(
      expect.anything(),
      'prov-1',
      'human_reviewed',
      'reviewer-42',
    );
  });
});

describe('GET /:id/reviews', () => {
  it('returns reviews for a provenance entry', async () => {
    mq.getReviewsForProvenance.mockResolvedValue([makeReview()] as never);
    const app = createApp();
    const res = await app.request('/prov-1/reviews');
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data[0].provenanceId).toBe('prov-1');
  });

  it('returns empty data array when entry has no reviews', async () => {
    mq.getReviewsForProvenance.mockResolvedValue([]);
    const app = createApp();
    const res = await app.request('/prov-1/reviews');
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.data).toEqual([]);
  });
});
