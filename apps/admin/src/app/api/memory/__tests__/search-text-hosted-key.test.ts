/**
 * Text memory search must embed with the resolved account client.
 * Hosted with no key is a 409. The route must not construct an env model client.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { generateEmbedding, resolveLLM, createFromEnv, searchSimilar } = vi.hoisted(() => ({
  generateEmbedding: vi.fn(async () => ({
    vector: [0.2, 0.4],
    model: 'acct',
    dimension: 2,
    generatedAt: '2026-10-06T00:00:00.000Z',
  })),
  resolveLLM: vi.fn(),
  createFromEnv: vi.fn(() => {
    throw new Error('env model client must not be constructed');
  }),
  searchSimilar: vi.fn(async () => []),
}));

vi.mock('@revealui/auth/server', () => ({
  getSession: vi.fn(),
}));

vi.mock('@/lib/middleware/ai-feature-gate', () => ({
  checkAIMemoryFeatureGate: vi.fn(async () => null),
}));

vi.mock('@/lib/utils/error-response', () => {
  const { NextResponse } = require('next/server');
  return {
    createErrorResponse: (err: unknown) =>
      NextResponse.json(
        { error: err instanceof Error ? err.message : 'Unknown error' },
        { status: 500 },
      ),
    createValidationErrorResponse: (msg: string, field: string) =>
      NextResponse.json({ error: msg, field }, { status: 400 }),
  };
});

vi.mock('@revealui/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock('@revealui/db/client', () => ({
  getClient: () => ({ kind: 'db' }),
}));

vi.mock('@revealui/ai/embeddings', () => ({
  generateEmbedding,
}));

vi.mock('@revealui/ai/memory/vector', () => ({
  VectorMemoryService: class {
    searchSimilar = searchSimilar;
  },
}));

vi.mock('@revealui/ai/llm/server', () => ({
  resolveLLMClientForRequest: resolveLLM,
  createLLMClientFromEnv: createFromEnv,
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

import { getSession } from '@revealui/auth/server';

const resolvedClient = { marker: 'customer-key' };

function makeRequest(body: unknown) {
  return {
    headers: { get: () => null },
    json: () => Promise.resolve(body),
  } as never;
}

describe('POST /api/memory/search-text embedding key', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue({ user: { id: 'user-1', role: 'user' } } as never);
    resolveLLM.mockResolvedValue(resolvedClient);
    delete process.env.REVEALUI_DEPLOYMENT_MODE;
    delete process.env.REVEALUI_LICENSE_PRIVATE_KEY;
  });

  async function post(body: unknown) {
    const { POST } = await import('../search-text/route.js');
    const res = await POST(makeRequest(body));
    return res as unknown as { status: number; body: Record<string, unknown> };
  }

  it('embeds with the resolved client on hosted', async () => {
    process.env.REVEALUI_DEPLOYMENT_MODE = 'hosted';

    const res = await post({ query: 'where is the invoice' });

    expect(res.status).toBe(200);
    expect(resolveLLM).toHaveBeenCalledWith(
      'user-1',
      expect.anything(),
      expect.objectContaining({ isHosted: true }),
    );
    expect(generateEmbedding).toHaveBeenCalledWith('where is the invoice', {
      client: resolvedClient,
    });
    expect(createFromEnv).not.toHaveBeenCalled();
  });

  it('returns 409 on hosted when no provider key is configured', async () => {
    process.env.REVEALUI_DEPLOYMENT_MODE = 'hosted';
    resolveLLM.mockRejectedValueOnce(
      Object.assign(new Error('No LLM provider is configured for this account.'), {
        code: 'LLM_NOT_CONFIGURED',
        settingsPath: '/settings/api-keys',
      }),
    );

    const res = await post({ query: 'where is the invoice' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('LLM_NOT_CONFIGURED');
    expect(res.body.settingsPath).toBe('/settings/api-keys');
    expect(generateEmbedding).not.toHaveBeenCalled();
    expect(createFromEnv).not.toHaveBeenCalled();
  });

  it('passes isHosted false on forge and still uses the resolved client', async () => {
    process.env.REVEALUI_DEPLOYMENT_MODE = 'forge';

    const res = await post({ query: 'local notes' });

    expect(res.status).toBe(200);
    expect(resolveLLM).toHaveBeenCalledWith(
      'user-1',
      expect.anything(),
      expect.objectContaining({ isHosted: false }),
    );
    expect(generateEmbedding).toHaveBeenCalledWith('local notes', { client: resolvedClient });
    expect(createFromEnv).not.toHaveBeenCalled();
  });
});
