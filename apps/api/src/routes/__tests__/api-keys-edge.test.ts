import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies (mirrors api-keys.test.ts setup)
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

vi.mock('@revealui/ai/llm/key-validator', () => ({
  validateProviderKey: vi.fn().mockResolvedValue({ valid: true }),
}));

import { validateProviderKey } from '@revealui/ai/llm/key-validator';
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('api-keys edge cases', () => {
  let mockInsertValues: ReturnType<typeof vi.fn>;
  let mockSelectFrom: ReturnType<typeof vi.fn>;
  let mockUpdateSet: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockInsertValues = vi.fn().mockResolvedValue(undefined);
    mockUpdateSet = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    mockSelectFrom = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
      }),
    });

    const mockDb = {
      insert: vi.fn().mockReturnValue({ values: mockInsertValues }),
      select: vi.fn().mockReturnValue({ from: mockSelectFrom }),
      delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      update: vi.fn().mockReturnValue({ set: mockUpdateSet }),
      // biome-ignore lint/suspicious/noExplicitAny: test mock
    } as any;
    mockDb.transaction = vi.fn(async (cb: (tx: typeof mockDb) => Promise<unknown>) => cb(mockDb));
    mockedGetClient.mockReturnValue(mockDb);
  });

  describe('POST /api-keys — key validation', () => {
    it('returns 400 with validation error when provider rejects the key', async () => {
      vi.mocked(validateProviderKey).mockResolvedValueOnce({
        valid: false,
        error: 'Invalid key format',
      });

      const app = createApp(testUser);
      const res = await jsonPost(app, '/api-keys', {
        provider: 'anthropic',
        apiKey: 'sk-test-12345678',
      });

      expect(res.status).toBe(400);
      const body = await parseBody(res);
      expect(body.error).toBe('Invalid key format');
    });
  });

  describe('POST /api-keys — setAsDefault model field', () => {
    it('stores model in new provider config when setAsDefault is true', async () => {
      // mockSelectFrom returns empty → INSERT path (no existing config)
      const app = createApp(testUser);
      const res = await jsonPost(app, '/api-keys', {
        provider: 'anthropic',
        apiKey: 'sk-test-12345678',
        setAsDefault: true,
        model: 'claude-sonnet-4-6',
      });

      expect(res.status).toBe(201);
      // Second insert is for tenantProviderConfigs
      expect(mockInsertValues).toHaveBeenCalledTimes(2);
      expect(mockInsertValues.mock.calls[1]![0]).toMatchObject({
        model: 'claude-sonnet-4-6',
        isDefault: true,
        provider: 'anthropic',
      });
    });

    it('sets model to null in new provider config when model is omitted', async () => {
      const app = createApp(testUser);
      await jsonPost(app, '/api-keys', {
        provider: 'anthropic',
        apiKey: 'sk-test-12345678',
        setAsDefault: true,
      });

      expect(mockInsertValues).toHaveBeenCalledTimes(2);
      expect(mockInsertValues.mock.calls[1]![0]).toMatchObject({
        model: null,
        isDefault: true,
      });
    });
  });

  describe('POST /api-keys — clear-previous-defaults sequence', () => {
    it('clears existing default (isDefault: false) before setting new default (isDefault: true)', async () => {
      // Return existing config so the UPDATE path is taken (not INSERT)
      mockSelectFrom.mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'cfg_existing' }]),
        }),
      });

      const app = createApp(testUser);
      const res = await jsonPost(app, '/api-keys', {
        provider: 'openai',
        apiKey: 'sk-test-12345678',
        setAsDefault: true,
        model: 'gpt-4o',
      });

      expect(res.status).toBe(201);
      // Two update calls must have fired
      expect(mockUpdateSet).toHaveBeenCalledTimes(2);
      // First: clear the current default
      expect(mockUpdateSet.mock.calls[0]![0]).toMatchObject({ isDefault: false });
      // Second: mark the new config as default
      expect(mockUpdateSet.mock.calls[1]![0]).toMatchObject({ isDefault: true, model: 'gpt-4o' });
    });
  });

  describe('POST /api-keys — validateProviderKey network failure', () => {
    it('returns 500 when validateProviderKey throws (best-effort validation gap)', async () => {
      // Current behavior: the catch in the dynamic import only handles module-not-found,
      // not runtime throws from validateProviderKey itself. A network error bubbles as 500.
      vi.mocked(validateProviderKey).mockRejectedValueOnce(new Error('Network timeout'));

      const app = createApp(testUser);
      const res = await jsonPost(app, '/api-keys', {
        provider: 'anthropic',
        apiKey: 'sk-test-12345678',
      });

      expect(res.status).toBe(500);
    });
  });

  describe('POST /api-keys — label length boundary', () => {
    it('accepts label of exactly 80 characters', async () => {
      const app = createApp(testUser);
      const res = await jsonPost(app, '/api-keys', {
        provider: 'anthropic',
        apiKey: 'sk-test-12345678',
        label: 'a'.repeat(80),
      });
      expect(res.status).toBe(201);
    });

    it('rejects label exceeding 80 characters', async () => {
      const app = createApp(testUser);
      const res = await jsonPost(app, '/api-keys', {
        provider: 'anthropic',
        apiKey: 'sk-test-12345678',
        label: 'a'.repeat(81),
      });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api-keys — missing required fields', () => {
    it('returns 400 when provider is missing', async () => {
      const app = createApp(testUser);
      const res = await jsonPost(app, '/api-keys', {
        apiKey: 'sk-test-12345678',
      });
      expect(res.status).toBe(400);
    });

    it('returns 400 when apiKey is missing', async () => {
      const app = createApp(testUser);
      const res = await jsonPost(app, '/api-keys', {
        provider: 'anthropic',
      });
      expect(res.status).toBe(400);
    });

    it('returns 400 when body is empty object', async () => {
      const app = createApp(testUser);
      const res = await jsonPost(app, '/api-keys', {});
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api-keys/:id/rotate — edge cases', () => {
    it('returns 400 when apiKey is missing from rotate body', async () => {
      const app = createApp(testUser);
      const res = await jsonPost(app, '/api-keys/key_abc/rotate', {});
      expect(res.status).toBe(400);
    });

    it('returns 400 when apiKey is exactly 7 characters (boundary below min)', async () => {
      const app = createApp(testUser);
      const res = await jsonPost(app, '/api-keys/key_abc/rotate', {
        apiKey: '1234567',
      });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api-keys — apiKey at exactly 8 characters (boundary at min)', () => {
    it('accepts apiKey of exactly 8 characters', async () => {
      const app = createApp(testUser);
      const res = await jsonPost(app, '/api-keys', {
        provider: 'anthropic',
        apiKey: '12345678',
      });
      expect(res.status).toBe(201);
    });
  });

  describe('POST /api-keys — label as empty string', () => {
    it('accepts empty string label (optional field)', async () => {
      const app = createApp(testUser);
      const res = await jsonPost(app, '/api-keys', {
        provider: 'anthropic',
        apiKey: 'sk-test-12345678',
        label: '',
      });
      // Empty string is a valid label (max(80) allows it)
      expect(res.status).toBe(201);
    });
  });
});
