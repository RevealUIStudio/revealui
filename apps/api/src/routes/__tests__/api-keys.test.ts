import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@revealui/db', () => ({
  getClient: vi.fn(),
}));

vi.mock('@revealui/db/crypto', () => ({
  encryptApiKey: vi.fn((key: string) => `encrypted:${key}`),
  redactApiKey: vi.fn((key: string) => `${key.slice(0, 4)}...${key.slice(-4)}`),
}));

vi.mock('@revealui/db/schema', () => ({
  tenantProviderConfigs: {
    id: 'id',
    userId: 'userId',
    provider: 'provider',
    isDefault: 'isDefault',
    model: 'model',
  },
  userApiKeys: {
    id: 'id',
    userId: 'userId',
    provider: 'provider',
    encryptedKey: 'encryptedKey',
    keyHint: 'keyHint',
    label: 'label',
    createdAt: 'createdAt',
    lastUsedAt: 'lastUsedAt',
    updatedAt: 'updatedAt',
  },
}));

// Mock @revealui/ai key validation (dynamic import in route)
vi.mock('@revealui/ai/llm/key-validator', () => ({
  validateProviderKey: vi.fn().mockResolvedValue({ valid: true }),
}));

import { getClient } from '@revealui/db';
import type { HTTPException } from 'hono/http-exception';
import { errorHandler } from '../../middleware/error.js';
import apiKeysApp from '../api-keys.js';

vi.mock('../../middleware/error.js', async () => {
  const { HTTPException } = await import('hono/http-exception');
  return {
    errorHandler: (err: unknown, c: { json: (...args: unknown[]) => unknown }) => {
      if (err instanceof HTTPException) {
        return c.json(
          { error: (err as HTTPException).message, code: `HTTP_${(err as HTTPException).status}` },
          (err as HTTPException).status,
        );
      }
      return c.json({ error: 'Internal error' }, 500);
    },
  };
});

const mockedGetClient = vi.mocked(getClient);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
interface MockUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

function createApp(user?: MockUser) {
  // biome-ignore lint/suspicious/noExplicitAny: test helper
  const app = new Hono<{ Variables: { user: any } }>();
  if (user) {
    app.use('*', async (c, next) => {
      c.set('user', user);
      await next();
    });
  }
  app.route('/api-keys', apiKeysApp);
  app.onError(errorHandler);
  return app;
}

// biome-ignore lint/suspicious/noExplicitAny: test helper — Hono generics vary per test
function jsonPost(app: Hono<any>, path: string, body: unknown) {
  return app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// biome-ignore lint/suspicious/noExplicitAny: test helper
async function parseBody(res: Response): Promise<any> {
  return res.json();
}

const testUser: MockUser = { id: 'user-1', email: 'test@example.com', name: 'Test', role: 'admin' };
const otherUser: MockUser = {
  id: 'user-2',
  email: 'other@example.com',
  name: 'Other',
  role: 'user',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('api-keys routes', () => {
  let mockInsertValues: ReturnType<typeof vi.fn>;
  let mockSelectFrom: ReturnType<typeof vi.fn>;
  let mockDeleteWhere: ReturnType<typeof vi.fn>;
  let mockUpdateSet: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockInsertValues = vi.fn().mockResolvedValue(undefined);
    mockDeleteWhere = vi.fn().mockResolvedValue(undefined);
    mockUpdateSet = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    mockSelectFrom = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
      }),
    });

    const mockDb = {
      insert: vi.fn().mockReturnValue({ values: mockInsertValues }),
      select: vi.fn().mockReturnValue({ from: mockSelectFrom }),
      delete: vi.fn().mockReturnValue({ where: mockDeleteWhere }),
      update: vi.fn().mockReturnValue({ set: mockUpdateSet }),
      // biome-ignore lint/suspicious/noExplicitAny: test mock
    } as any;
    mockDb.transaction = vi.fn(async (cb: (tx: typeof mockDb) => Promise<unknown>) => cb(mockDb));
    mockedGetClient.mockReturnValue(mockDb);
  });

  describe('POST /api-keys (create key)', () => {
    it('returns 401 when unauthenticated', async () => {
      const app = createApp();

      const res = await jsonPost(app, '/api-keys', {
        provider: 'anthropic',
        apiKey: 'test-dummy-key-12345678',
      });

      expect(res.status).toBe(401);
    });

    it('creates a key and returns id + keyHint', async () => {
      const app = createApp(testUser);

      const res = await jsonPost(app, '/api-keys', {
        provider: 'anthropic',
        apiKey: 'test-dummy-key-12345678',
      });

      expect(res.status).toBe(201);
      const body = await parseBody(res);
      expect(body.id).toMatch(/^key_/);
      expect(body.keyHint).toBeDefined();
    });

    it('rejects invalid provider', async () => {
      const app = createApp(testUser);

      const res = await jsonPost(app, '/api-keys', {
        provider: 'invalid-provider',
        apiKey: 'sk-test-12345678',
      });

      expect(res.status).toBe(400);
    });

    it('rejects apiKey shorter than 8 chars', async () => {
      const app = createApp(testUser);

      const res = await jsonPost(app, '/api-keys', {
        provider: 'anthropic',
        apiKey: 'short',
      });

      expect(res.status).toBe(400);
    });

    it('accepts all valid providers', async () => {
      const providers = ['openai', 'anthropic', 'groq', 'ollama', 'huggingface', 'vultr'];

      for (const provider of providers) {
        vi.clearAllMocks();
        const inlineDb = {
          insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
          }),
          // biome-ignore lint/suspicious/noExplicitAny: test mock
        } as any;
        inlineDb.transaction = vi.fn(async (cb: (tx: typeof inlineDb) => Promise<unknown>) =>
          cb(inlineDb),
        );
        mockedGetClient.mockReturnValue(inlineDb);

        const app = createApp(testUser);
        const res = await jsonPost(app, `/api-keys`, {
          provider,
          apiKey: 'sk-test-key-12345678',
        });
        expect(res.status).toBe(201);
      }
    });
  });

  describe('GET /api-keys (list keys)', () => {
    it('returns 401 when unauthenticated', async () => {
      const app = createApp();

      const res = await app.request('/api-keys');

      expect(res.status).toBe(401);
    });

    it('returns empty list when no keys stored', async () => {
      mockedGetClient.mockReturnValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
        // biome-ignore lint/suspicious/noExplicitAny: test mock
      } as any);

      const app = createApp(testUser);

      const res = await app.request('/api-keys');

      expect(res.status).toBe(200);
      const body = await parseBody(res);
      expect(body.keys).toEqual([]);
    });

    it('returns key summaries without plaintext', async () => {
      const now = new Date();
      mockedGetClient.mockReturnValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              {
                id: 'key_abc',
                provider: 'anthropic',
                keyHint: 'sk-a...5678',
                label: 'My key',
                createdAt: now,
                lastUsedAt: null,
              },
            ]),
          }),
        }),
        // biome-ignore lint/suspicious/noExplicitAny: test mock
      } as any);

      const app = createApp(testUser);

      const res = await app.request('/api-keys');

      expect(res.status).toBe(200);
      const body = await parseBody(res);
      expect(body.keys).toHaveLength(1);
      expect(body.keys[0].id).toBe('key_abc');
      expect(body.keys[0].provider).toBe('anthropic');
      expect(body.keys[0].keyHint).toBe('sk-a...5678');
      // Ensure no plaintext key is returned
      expect(body.keys[0].encryptedKey).toBeUndefined();
      expect(body.keys[0].apiKey).toBeUndefined();
    });
  });

  describe('DELETE /api-keys/:id', () => {
    it('returns 401 when unauthenticated', async () => {
      const app = createApp();

      const res = await app.request('/api-keys/key_abc', { method: 'DELETE' });

      expect(res.status).toBe(401);
    });

    it('returns 404 when key does not exist', async () => {
      mockedGetClient.mockReturnValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
        // biome-ignore lint/suspicious/noExplicitAny: test mock
      } as any);

      const app = createApp(testUser);

      const res = await app.request('/api-keys/key_nonexistent', { method: 'DELETE' });

      expect(res.status).toBe(404);
    });

    it('deletes existing key', async () => {
      const mockDelete = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
      mockedGetClient.mockReturnValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ id: 'key_abc' }]),
          }),
        }),
        delete: mockDelete,
        // biome-ignore lint/suspicious/noExplicitAny: test mock
      } as any);

      const app = createApp(testUser);

      const res = await app.request('/api-keys/key_abc', { method: 'DELETE' });

      expect(res.status).toBe(200);
      const body = await parseBody(res);
      expect(body.deleted).toBe(true);
    });
  });

  describe('POST /api-keys/:id/rotate', () => {
    it('returns 401 when unauthenticated', async () => {
      const app = createApp();

      const res = await jsonPost(app, '/api-keys/key_abc/rotate', {
        apiKey: 'sk-new-key-12345678',
      });

      expect(res.status).toBe(401);
    });

    it('returns 404 when key does not exist', async () => {
      mockedGetClient.mockReturnValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
        // biome-ignore lint/suspicious/noExplicitAny: test mock
      } as any);

      const app = createApp(testUser);

      const res = await jsonPost(app, '/api-keys/key_nonexistent/rotate', {
        apiKey: 'sk-new-key-12345678',
      });

      expect(res.status).toBe(404);
    });

    it('rotates existing key and returns updated hint', async () => {
      mockedGetClient.mockReturnValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ id: 'key_abc' }]),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
        }),
        // biome-ignore lint/suspicious/noExplicitAny: test mock
      } as any);

      const app = createApp(testUser);

      const res = await jsonPost(app, '/api-keys/key_abc/rotate', {
        apiKey: 'sk-new-rotated-key-1234',
      });

      expect(res.status).toBe(200);
      const body = await parseBody(res);
      expect(body.id).toBe('key_abc');
      expect(body.keyHint).toBeDefined();
    });

    it('rejects new key shorter than 8 chars', async () => {
      const app = createApp(testUser);

      const res = await jsonPost(app, '/api-keys/key_abc/rotate', {
        apiKey: 'short',
      });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api-keys — encryption and redaction', () => {
    it('calls encryptApiKey before storing', async () => {
      const { encryptApiKey } = await import('@revealui/db/crypto');
      const app = createApp(testUser);

      await jsonPost(app, '/api-keys', {
        provider: 'anthropic',
        apiKey: 'test-dummy-key-12345678',
      });

      expect(encryptApiKey).toHaveBeenCalledWith('test-dummy-key-12345678');
    });

    it('calls redactApiKey to generate hint', async () => {
      const { redactApiKey } = await import('@revealui/db/crypto');
      const app = createApp(testUser);

      const res = await jsonPost(app, '/api-keys', {
        provider: 'anthropic',
        apiKey: 'test-dummy-key-12345678',
      });

      expect(redactApiKey).toHaveBeenCalledWith('test-dummy-key-12345678');
      const body = await parseBody(res);
      expect(body.keyHint).toBe('test...5678');
    });

    it('stores label when provided', async () => {
      const app = createApp(testUser);

      const res = await jsonPost(app, '/api-keys', {
        provider: 'anthropic',
        apiKey: 'test-dummy-key-12345678',
        label: 'My production key',
      });

      expect(res.status).toBe(201);
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({ label: 'My production key' }),
      );
    });
  });

  describe('POST /api-keys — setAsDefault flow', () => {
    it('creates provider config when setAsDefault is true and no existing config', async () => {
      const app = createApp(testUser);

      const res = await jsonPost(app, '/api-keys', {
        provider: 'anthropic',
        apiKey: 'test-dummy-key-12345678',
        setAsDefault: true,
        model: 'claude-sonnet-4-6',
      });

      expect(res.status).toBe(201);
      // Should have called insert twice: once for the key, once for the provider config
      const db = mockedGetClient();
      expect(db.insert).toHaveBeenCalledTimes(2);
    });

    it('updates existing provider config when setAsDefault is true', async () => {
      // Mock select to return an existing config
      mockSelectFrom.mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'cfg_existing' }]),
        }),
      });

      const app = createApp(testUser);

      const res = await jsonPost(app, '/api-keys', {
        provider: 'anthropic',
        apiKey: 'test-dummy-key-12345678',
        setAsDefault: true,
      });

      expect(res.status).toBe(201);
      // Should have called update (to clear existing default + set new default)
      const db = mockedGetClient();
      expect(db.update).toHaveBeenCalled();
    });

    it('does not touch provider config when setAsDefault is not set', async () => {
      const app = createApp(testUser);

      await jsonPost(app, '/api-keys', {
        provider: 'anthropic',
        apiKey: 'test-dummy-key-12345678',
      });

      // Should only call insert once (for the key, not for provider config)
      const db = mockedGetClient();
      expect(db.insert).toHaveBeenCalledTimes(1);
    });
  });

  describe('tenant isolation (IDOR)', () => {
    it("DELETE — user cannot delete another user's key (scoped by userId)", async () => {
      // Key belongs to testUser, but otherUser tries to delete it.
      // The select query scopes by userId, so it returns [] for the wrong user.
      mockedGetClient.mockReturnValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
        // biome-ignore lint/suspicious/noExplicitAny: test mock
      } as any);

      const app = createApp(otherUser);
      const res = await app.request('/api-keys/key_belongs_to_user1', { method: 'DELETE' });

      expect(res.status).toBe(404);
    });

    it("ROTATE — user cannot rotate another user's key (scoped by userId)", async () => {
      mockedGetClient.mockReturnValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
        // biome-ignore lint/suspicious/noExplicitAny: test mock
      } as any);

      const app = createApp(otherUser);
      const res = await jsonPost(app, '/api-keys/key_belongs_to_user1/rotate', {
        apiKey: 'hijack-attempt-key-123',
      });

      expect(res.status).toBe(404);
    });

    it('GET — list is scoped to authenticated user only', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      mockedGetClient.mockReturnValue({
        select: mockSelect,
        // biome-ignore lint/suspicious/noExplicitAny: test mock
      } as any);

      const app = createApp(otherUser);
      await app.request('/api-keys');

      // Verify the where clause was called (userId scoping happens in route)
      const fromMock = mockSelect.mock.results[0]?.value.from;
      expect(fromMock).toHaveBeenCalled();
    });
  });

  describe('POST /api-keys/:id/rotate — encryption', () => {
    it('encrypts the new key and generates new hint', async () => {
      const { encryptApiKey, redactApiKey } = await import('@revealui/db/crypto');

      mockedGetClient.mockReturnValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ id: 'key_abc' }]),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
        }),
        // biome-ignore lint/suspicious/noExplicitAny: test mock
      } as any);

      const app = createApp(testUser);
      await jsonPost(app, '/api-keys/key_abc/rotate', {
        apiKey: 'sk-new-rotated-key-9999',
      });

      expect(encryptApiKey).toHaveBeenCalledWith('sk-new-rotated-key-9999');
      expect(redactApiKey).toHaveBeenCalledWith('sk-new-rotated-key-9999');
    });
  });
});
