/**
 * Tests for API key management routes:
 * - GET/POST/DELETE /api/user/api-keys
 * - GET /api/user/api-keys/value
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetSession = vi.fn();
const mockGetClient = vi.fn();
const mockEncryptApiKey = vi.fn();
const mockRedactApiKey = vi.fn();
const mockDecryptApiKey = vi.fn();

vi.mock('@revealui/auth/server', () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
}));

vi.mock('@revealui/db', () => ({
  getClient: () => mockGetClient(),
}));

vi.mock('@revealui/db/crypto', () => ({
  encryptApiKey: (...args: unknown[]) => mockEncryptApiKey(...args),
  redactApiKey: (...args: unknown[]) => mockRedactApiKey(...args),
  decryptApiKey: (...args: unknown[]) => mockDecryptApiKey(...args),
}));

vi.mock('@revealui/db/schema', () => ({
  userApiKeys: {
    id: 'id',
    userId: 'userId',
    provider: 'provider',
    encryptedKey: 'encryptedKey',
    keyHint: 'keyHint',
    lastUsedAt: 'lastUsedAt',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn(),
  eq: vi.fn(),
}));

vi.mock('next/server', () => {
  class MockNextResponse {
    body: unknown;
    status: number;
    constructor(body: unknown, init?: { status?: number }) {
      this.body = body;
      this.status = init?.status ?? 200;
    }
    static json(data: unknown, init?: { status?: number }) {
      return new MockNextResponse(data, init);
    }
  }
  return { NextResponse: MockNextResponse };
});

function makeRequest(body?: unknown) {
  return {
    headers: { get: () => null },
    json:
      body !== undefined ? () => Promise.resolve(body) : () => Promise.reject(new Error('no body')),
  } as never;
}

// ─── GET /api/user/api-keys ─────────────────────────────────────────────────

describe('GET /api/user/api-keys', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function loadRoute() {
    const mod = await import('../api-keys/route.js');
    return mod.GET;
  }

  it('returns 401 when not authenticated', async () => {
    mockGetSession.mockResolvedValue(null);
    const GET = await loadRoute();
    const res = await GET(makeRequest());
    expect((res as { status: number }).status).toBe(401);
  });

  it('returns key hint when key exists', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1' } });
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ provider: 'huggingface', keyHint: 'sk-...abc' }]),
        }),
      }),
    });
    mockGetClient.mockReturnValue({ select: mockSelect });

    const GET = await loadRoute();
    const res = await GET(makeRequest());

    expect((res as { status: number }).status).toBe(200);
    expect((res as unknown as { body: { provider: string; keyHint: string } }).body).toEqual({
      provider: 'huggingface',
      keyHint: 'sk-...abc',
    });
  });

  it('returns null when no key configured', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1' } });
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
    mockGetClient.mockReturnValue({ select: mockSelect });

    const GET = await loadRoute();
    const res = await GET(makeRequest());

    expect((res as { status: number }).status).toBe(200);
    expect((res as unknown as { body: unknown }).body).toBeNull();
  });
});

// ─── POST /api/user/api-keys ────────────────────────────────────────────────

describe('POST /api/user/api-keys', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function loadRoute() {
    const mod = await import('../api-keys/route.js');
    return mod.POST;
  }

  it('returns 401 when not authenticated', async () => {
    mockGetSession.mockResolvedValue(null);
    const POST = await loadRoute();
    const res = await POST(makeRequest({ provider: 'huggingface', key: 'sk-test' }));
    expect((res as { status: number }).status).toBe(401);
  });

  it('returns 400 for invalid JSON body', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1' } });
    const POST = await loadRoute();
    const req = {
      headers: { get: () => null },
      json: () => Promise.reject(new Error('bad')),
    } as never;
    const res = await POST(req);
    expect((res as { status: number }).status).toBe(400);
  });

  it('returns 400 for invalid provider', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1' } });
    const POST = await loadRoute();
    const res = await POST(makeRequest({ provider: 'invalid', key: 'sk-test' }));
    expect((res as { status: number }).status).toBe(400);
  });

  it('encrypts key and upserts successfully', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1' } });
    mockEncryptApiKey.mockReturnValue('encrypted-data');
    mockRedactApiKey.mockReturnValue('sk-...xyz');
    const mockDelete = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    const mockInsert = vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
    mockGetClient.mockReturnValue({ delete: mockDelete, insert: mockInsert });

    const POST = await loadRoute();
    const res = await POST(makeRequest({ provider: 'ollama', key: 'sk-ant-test-key' }));

    expect((res as { status: number }).status).toBe(200);
    expect((res as unknown as { body: { provider: string; keyHint: string } }).body).toEqual({
      provider: 'ollama',
      keyHint: 'sk-...xyz',
    });
    expect(mockEncryptApiKey).toHaveBeenCalledWith('sk-ant-test-key');
  });
});

// ─── DELETE /api/user/api-keys ──────────────────────────────────────────────

describe('DELETE /api/user/api-keys', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function loadRoute() {
    const mod = await import('../api-keys/route.js');
    return mod.DELETE;
  }

  it('returns 401 when not authenticated', async () => {
    mockGetSession.mockResolvedValue(null);
    const DEL = await loadRoute();
    const res = await DEL(makeRequest());
    expect((res as { status: number }).status).toBe(401);
  });

  it('deletes all user keys and returns success', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1' } });
    const mockDelete = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    mockGetClient.mockReturnValue({ delete: mockDelete });

    const DEL = await loadRoute();
    const res = await DEL(makeRequest());

    expect((res as { status: number }).status).toBe(200);
    expect((res as unknown as { body: { deleted: boolean } }).body.deleted).toBe(true);
  });
});

// ─── GET /api/user/api-keys/value ───────────────────────────────────────────

describe('GET /api/user/api-keys/value', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function loadRoute() {
    const mod = await import('../api-keys/value/route.js');
    return mod.GET;
  }

  it('returns 401 when not authenticated', async () => {
    mockGetSession.mockResolvedValue(null);
    const GET = await loadRoute();
    const res = await GET(makeRequest());
    expect((res as { status: number }).status).toBe(401);
  });

  it('returns 404 when no key configured', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1' } });
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
    mockGetClient.mockReturnValue({ select: mockSelect });

    const GET = await loadRoute();
    const res = await GET(makeRequest());
    expect((res as { status: number }).status).toBe(404);
  });

  it('decrypts and returns key with fire-and-forget lastUsedAt update', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1' } });
    mockDecryptApiKey.mockReturnValue('sk-real-key-decrypted');
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi
            .fn()
            .mockResolvedValue([
              { id: 'key-1', provider: 'huggingface', encryptedKey: 'enc-data' },
            ]),
        }),
      }),
    });
    const mockUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          catch: vi.fn(),
        }),
      }),
    });
    mockGetClient.mockReturnValue({ select: mockSelect, update: mockUpdate });

    const GET = await loadRoute();
    const res = await GET(makeRequest());

    expect((res as { status: number }).status).toBe(200);
    expect((res as unknown as { body: { provider: string; key: string } }).body).toEqual({
      provider: 'huggingface',
      key: 'sk-real-key-decrypted',
    });
    expect(mockDecryptApiKey).toHaveBeenCalledWith('enc-data');
  });
});
