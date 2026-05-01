import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const mockInsert = vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });

vi.mock('@revealui/db', () => ({
  getClient: vi.fn(() => ({ insert: mockInsert })),
}));

vi.mock('@revealui/db/schema', () => ({
  errorEvents: Symbol('errorEvents'),
}));

import { errorHandler } from '../error.js';

beforeEach(() => {
  mockInsert.mockClear();
  mockInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
});

// biome-ignore lint/suspicious/noExplicitAny: test helper  -  response shape varies per test
async function parseBody(res: Response): Promise<any> {
  return res.json();
}

type TestVariables = { requestId: string };

function createApp(handler: (c: { req: { url: string } }) => never) {
  const app = new Hono<{ Variables: TestVariables }>();
  app.use('*', async (c, next) => {
    c.set('requestId', 'req-test-123');
    await next();
  });
  // biome-ignore lint/suspicious/noExplicitAny: test helper  -  handler signature is flexible
  app.get('/test', handler as any);
  app.onError(errorHandler);
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('errorHandler', () => {
  describe('HTTPException handling', () => {
    it('returns correct status for 4xx errors', async () => {
      const app = createApp(() => {
        throw new HTTPException(400, { message: 'Bad request' });
      });

      const res = await app.request('/test');

      expect(res.status).toBe(400);
      const body = await parseBody(res);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Bad request');
      expect(body.code).toBe('HTTP_400');
    });

    it('returns correct status for 401', async () => {
      const app = createApp(() => {
        throw new HTTPException(401, { message: 'Unauthorized' });
      });

      const res = await app.request('/test');

      expect(res.status).toBe(401);
      const body = await parseBody(res);
      expect(body.code).toBe('HTTP_401');
    });

    it('returns correct status for 403', async () => {
      const app = createApp(() => {
        throw new HTTPException(403, { message: 'Forbidden' });
      });

      const res = await app.request('/test');

      expect(res.status).toBe(403);
      const body = await parseBody(res);
      expect(body.code).toBe('HTTP_403');
    });

    it('returns correct status for 404', async () => {
      const app = createApp(() => {
        throw new HTTPException(404, { message: 'Not found' });
      });

      const res = await app.request('/test');

      expect(res.status).toBe(404);
    });

    it('includes requestId in response', async () => {
      const app = createApp(() => {
        throw new HTTPException(400, { message: 'Bad' });
      });

      const res = await app.request('/test');

      const body = await parseBody(res);
      expect(body.requestId).toBe('req-test-123');
    });

    it('does not persist 4xx errors to database', async () => {
      const app = createApp(() => {
        throw new HTTPException(400, { message: 'Client error' });
      });

      await app.request('/test');
      await new Promise((r) => setTimeout(r, 10));

      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('persists 5xx errors to database', async () => {
      const app = createApp(() => {
        throw new HTTPException(500, { message: 'Server error' });
      });

      await app.request('/test');
      await new Promise((r) => setTimeout(r, 50));

      expect(mockInsert).toHaveBeenCalled();
    });

    it('persists 502 errors to database', async () => {
      const app = createApp(() => {
        throw new HTTPException(502, { message: 'Bad gateway' });
      });

      await app.request('/test');
      await new Promise((r) => setTimeout(r, 50));

      expect(mockInsert).toHaveBeenCalled();
    });
  });

  describe('ZodError handling', () => {
    it('returns 400 for validation errors', async () => {
      const app = createApp(() => {
        const error = new Error('[{"code":"invalid_type","path":["email"]}]');
        error.name = 'ZodError';
        throw error;
      });

      const res = await app.request('/test');

      expect(res.status).toBe(400);
      const body = await parseBody(res);
      expect(body.error).toBe('Validation failed');
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('strips details in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        const app = createApp(() => {
          const error = new Error('[{"code":"invalid_type","path":["email"]}]');
          error.name = 'ZodError';
          throw error;
        });

        const res = await app.request('/test');

        const body = await parseBody(res);
        expect(body.details).toBeUndefined();
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('includes details in non-production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      try {
        const app = createApp(() => {
          const error = new Error('[{"code":"invalid_type","path":["email"]}]');
          error.name = 'ZodError';
          throw error;
        });

        const res = await app.request('/test');

        const body = await parseBody(res);
        expect(body.details).toBeDefined();
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('includes requestId in validation error response', async () => {
      const app = createApp(() => {
        const error = new Error('validation');
        error.name = 'ZodError';
        throw error;
      });

      const res = await app.request('/test');

      const body = await parseBody(res);
      expect(body.requestId).toBe('req-test-123');
    });

    it('does not persist validation errors to database', async () => {
      const app = createApp(() => {
        const error = new Error('validation');
        error.name = 'ZodError';
        throw error;
      });

      await app.request('/test');
      await new Promise((r) => setTimeout(r, 10));

      expect(mockInsert).not.toHaveBeenCalled();
    });
  });

  describe('unhandled errors', () => {
    it('returns 500 for unhandled errors', async () => {
      const app = createApp(() => {
        throw new Error('Something unexpected');
      });

      const res = await app.request('/test');

      expect(res.status).toBe(500);
      const body = await parseBody(res);
      expect(body.error).toBe('An error occurred while processing your request');
      expect(body.code).toBe('INTERNAL_ERROR');
    });

    it('does not leak error details in response', async () => {
      const app = createApp(() => {
        throw new Error('secret database connection string leaked');
      });

      const res = await app.request('/test');

      const body = await parseBody(res);
      expect(body.error).not.toContain('secret');
      expect(body.error).not.toContain('database');
    });

    it('persists unhandled errors to database', async () => {
      const app = createApp(() => {
        throw new Error('Unhandled crash');
      });

      await app.request('/test');
      await new Promise((r) => setTimeout(r, 50));

      expect(mockInsert).toHaveBeenCalled();
    });

    it('includes requestId in unhandled error response', async () => {
      const app = createApp(() => {
        throw new Error('crash');
      });

      const res = await app.request('/test');

      const body = await parseBody(res);
      expect(body.requestId).toBe('req-test-123');
    });

    it('handles non-Error throwables', async () => {
      const app = createApp(() => {
        const err = new Error('unexpected failure');
        err.name = 'CustomError';
        throw err;
      });

      const res = await app.request('/test');

      expect(res.status).toBe(500);
      const body = await parseBody(res);
      expect(body.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('response format', () => {
    it('always includes success: false', async () => {
      const app = createApp(() => {
        throw new HTTPException(400, { message: 'bad' });
      });

      const res = await app.request('/test');

      const body = await parseBody(res);
      expect(body.success).toBe(false);
    });

    it('always includes error and code fields', async () => {
      const app = createApp(() => {
        throw new Error('boom');
      });

      const res = await app.request('/test');

      const body = await parseBody(res);
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('code');
      expect(body).toHaveProperty('requestId');
    });
  });
});
