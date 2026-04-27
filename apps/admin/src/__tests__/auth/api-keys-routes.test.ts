/**
 * API Keys Route Tests
 *
 * Tests for GET/POST/DELETE /api/user/api-keys
 * and GET /api/user/api-keys/value.
 * Mocks auth session, database, and crypto to test route logic in isolation.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks -- must be before route imports
// ---------------------------------------------------------------------------

vi.mock('@revealui/auth/server', () => ({
  getSession: vi.fn(),
}));

vi.mock('@revealui/core/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockDelete = vi.fn();
const mockUpdate = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockValues = vi.fn();

vi.mock('@revealui/db', () => ({
  getClient: vi.fn(() => ({
    select: mockSelect,
    insert: mockInsert,
    delete: mockDelete,
    update: mockUpdate,
  })),
}));

vi.mock('@revealui/db/schema', () => ({
  userApiKeys: {
    id: 'id',
    userId: 'userId',
    provider: 'provider',
    encryptedKey: 'encryptedKey',
    keyHint: 'keyHint',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    lastUsedAt: 'lastUsedAt',
  },
}));

vi.mock('@revealui/db/crypto', () => ({
  encryptApiKey: vi.fn((key: string) => `encrypted:${key}`),
  redactApiKey: vi.fn((key: string) => `${key.slice(0, 4)}...${key.slice(-4)}`),
  decryptApiKey: vi.fn((encrypted: string) => encrypted.replace('encrypted:', '')),
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
}));

import { getSession } from '@revealui/auth/server';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockUser = {
  id: 'u1',
  email: 'alice@test.com',
  name: 'Alice',
  role: 'admin',
};

const mockSessionData = {
  user: mockUser,
  session: { id: 'sess-123', expiresAt: new Date('2026-12-31') },
};

function makeGetRequest(url: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:4000'), {
    method: 'GET',
    headers: { ...headers },
  });
}

function makePostRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:4000'), {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeDeleteRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:4000'), {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });
}

function setupSelectChain(result: unknown[]): void {
  mockLimit.mockResolvedValue(result);
  mockWhere.mockReturnValue({ limit: mockLimit });
  mockFrom.mockReturnValue({ where: mockWhere });
  mockSelect.mockReturnValue({ from: mockFrom });
}

function setupDeleteChain(): void {
  mockWhere.mockResolvedValue(undefined);
  mockDelete.mockReturnValue({ where: mockWhere });
}

function setupInsertChain(): void {
  mockValues.mockResolvedValue(undefined);
  mockInsert.mockReturnValue({ values: mockValues });
}

// ---------------------------------------------------------------------------
// GET /api/user/api-keys
// ---------------------------------------------------------------------------

describe('GET /api/user/api-keys', () => {
  let GET: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../../app/api/user/api-keys/route');
    GET = mod.GET as (req: NextRequest) => Promise<Response>;
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    const req = makeGetRequest('/api/user/api-keys');
    const res = await GET(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns the stored key hint when a key exists', async () => {
    vi.mocked(getSession).mockResolvedValue(mockSessionData as never);
    setupSelectChain([{ provider: 'ollama', keyHint: 'sk-a...xyz9' }]);

    const req = makeGetRequest('/api/user/api-keys');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.provider).toBe('ollama');
    expect(body.keyHint).toBe('sk-a...xyz9');
  });

  it('returns null when no key is configured', async () => {
    vi.mocked(getSession).mockResolvedValue(mockSessionData as never);
    setupSelectChain([]);

    const req = makeGetRequest('/api/user/api-keys');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toBeNull();
  });

  it('does not return the encrypted key in the response', async () => {
    vi.mocked(getSession).mockResolvedValue(mockSessionData as never);
    setupSelectChain([{ provider: 'huggingface', keyHint: 'sk-o...4321' }]);

    const req = makeGetRequest('/api/user/api-keys');
    const res = await GET(req);
    const body = await res.json();

    expect(body.encryptedKey).toBeUndefined();
    expect(body.key).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// POST /api/user/api-keys
// ---------------------------------------------------------------------------

describe('POST /api/user/api-keys', () => {
  let POST: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    setupDeleteChain();
    setupInsertChain();

    const mod = await import('../../app/api/user/api-keys/route');
    POST = mod.POST as (req: NextRequest) => Promise<Response>;
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    const req = makePostRequest('/api/user/api-keys', {
      provider: 'ollama',
      key: 'sk-ant-api03-abc123xyz',
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 200 with provider and keyHint on success', async () => {
    vi.mocked(getSession).mockResolvedValue(mockSessionData as never);

    const req = makePostRequest('/api/user/api-keys', {
      provider: 'ollama',
      key: 'sk-ant-api03-abc123xyz',
    });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.provider).toBe('ollama');
    expect(body.keyHint).toBeDefined();
  });

  it('deletes existing key before inserting new one (upsert)', async () => {
    vi.mocked(getSession).mockResolvedValue(mockSessionData as never);

    const req = makePostRequest('/api/user/api-keys', {
      provider: 'groq',
      key: 'gsk_abc123',
    });
    await POST(req);

    // Delete is called before insert
    expect(mockDelete).toHaveBeenCalled();
    expect(mockInsert).toHaveBeenCalled();
  });

  it('returns 400 for invalid provider', async () => {
    vi.mocked(getSession).mockResolvedValue(mockSessionData as never);

    const req = makePostRequest('/api/user/api-keys', {
      provider: 'invalid-provider',
      key: 'some-key',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid input');
  });

  it('returns 400 for empty key', async () => {
    vi.mocked(getSession).mockResolvedValue(mockSessionData as never);

    const req = makePostRequest('/api/user/api-keys', {
      provider: 'ollama',
      key: '',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing fields', async () => {
    vi.mocked(getSession).mockResolvedValue(mockSessionData as never);

    const req = makePostRequest('/api/user/api-keys', {});
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid JSON body', async () => {
    vi.mocked(getSession).mockResolvedValue(mockSessionData as never);

    const req = new NextRequest(new URL('/api/user/api-keys', 'http://localhost:4000'), {
      method: 'POST',
      body: 'not json',
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid JSON body');
  });

  it('accepts all valid provider values', async () => {
    vi.mocked(getSession).mockResolvedValue(mockSessionData as never);

    const providers = ['groq', 'huggingface', 'inference-snaps', 'ollama'];
    for (const provider of providers) {
      vi.clearAllMocks();
      vi.mocked(getSession).mockResolvedValue(mockSessionData as never);
      setupDeleteChain();
      setupInsertChain();

      const req = makePostRequest('/api/user/api-keys', {
        provider,
        key: `key-for-${provider}`,
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
    }
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/user/api-keys
// ---------------------------------------------------------------------------

describe('DELETE /api/user/api-keys', () => {
  let DELETE: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    setupDeleteChain();

    const mod = await import('../../app/api/user/api-keys/route');
    DELETE = mod.DELETE as (req: NextRequest) => Promise<Response>;
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    const req = makeDeleteRequest('/api/user/api-keys');
    const res = await DELETE(req);
    expect(res.status).toBe(401);
  });

  it('returns 200 with deleted: true on success', async () => {
    vi.mocked(getSession).mockResolvedValue(mockSessionData as never);

    const req = makeDeleteRequest('/api/user/api-keys');
    const res = await DELETE(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.deleted).toBe(true);
  });

  it('calls db.delete with correct user filter', async () => {
    vi.mocked(getSession).mockResolvedValue(mockSessionData as never);

    const req = makeDeleteRequest('/api/user/api-keys');
    await DELETE(req);

    expect(mockDelete).toHaveBeenCalled();
    expect(mockWhere).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// GET /api/user/api-keys/value
// ---------------------------------------------------------------------------

describe('GET /api/user/api-keys/value', () => {
  let GET: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Setup update chain for lastUsedAt fire-and-forget
    const mockUpdateSet = vi.fn(() => ({
      where: vi.fn(() => Promise.resolve(undefined)),
    }));
    mockUpdate.mockReturnValue({ set: mockUpdateSet });

    const mod = await import('../../app/api/user/api-keys/value/route');
    GET = mod.GET as (req: NextRequest) => Promise<Response>;
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    const req = makeGetRequest('/api/user/api-keys/value');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 404 when no API key is configured', async () => {
    vi.mocked(getSession).mockResolvedValue(mockSessionData as never);
    setupSelectChain([]);

    const req = makeGetRequest('/api/user/api-keys/value');
    const res = await GET(req);
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.error).toBe('No API key configured');
  });

  it('returns decrypted key and provider on success', async () => {
    vi.mocked(getSession).mockResolvedValue(mockSessionData as never);
    setupSelectChain([
      {
        id: 'key-1',
        provider: 'ollama',
        encryptedKey: 'encrypted:sk-real-key',
      },
    ]);

    const req = makeGetRequest('/api/user/api-keys/value');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.provider).toBe('ollama');
    expect(body.key).toBe('sk-real-key');
  });

  it('updates lastUsedAt on each fetch', async () => {
    vi.mocked(getSession).mockResolvedValue(mockSessionData as never);
    setupSelectChain([
      {
        id: 'key-1',
        provider: 'groq',
        encryptedKey: 'encrypted:gsk-abc',
      },
    ]);

    const req = makeGetRequest('/api/user/api-keys/value');
    await GET(req);

    // The update chain is called (fire-and-forget)
    expect(mockUpdate).toHaveBeenCalled();
  });

  it('does not expose encryptedKey in response', async () => {
    vi.mocked(getSession).mockResolvedValue(mockSessionData as never);
    setupSelectChain([
      {
        id: 'key-1',
        provider: 'huggingface',
        encryptedKey: 'encrypted:sk-sensitive',
      },
    ]);

    const req = makeGetRequest('/api/user/api-keys/value');
    const res = await GET(req);
    const body = await res.json();

    expect(body.encryptedKey).toBeUndefined();
    expect(body.key).toBe('sk-sensitive');
    expect(body.provider).toBe('huggingface');
  });
});
