/**
 * Knowledge-graph flush embeds with the resolved account client.
 * Hosted with no key is a 409. The route must not construct an env model client.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { generateEmbedding, resolveLLM, createFromEnv, ingestEpisode } = vi.hoisted(() => ({
  generateEmbedding: vi.fn(async () => ({ vector: [0.5, 0.6] })),
  resolveLLM: vi.fn(),
  createFromEnv: vi.fn(() => {
    throw new Error('env model client must not be constructed');
  }),
  ingestEpisode: vi.fn(
    async (
      _exec: unknown,
      _input: unknown,
      opts?: { embedder?: (text: string) => Promise<number[]> },
    ) => {
      if (opts?.embedder) await opts.embedder('flushed fact');
      return { episodeId: 'ep-1', nodeCount: 1, edgeCount: 0 };
    },
  ),
}));

vi.mock('@revealui/auth/server', () => ({
  getSession: vi.fn(),
}));

vi.mock('@/lib/middleware/ai-feature-gate', () => ({
  checkAIFeatureGate: vi.fn(async () => null),
}));

vi.mock('@revealui/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock('@revealui/db/client', () => ({
  getClient: () => ({ kind: 'db' }),
}));

vi.mock('@revealui/db/pool', () => ({
  getPool: () => ({}),
}));

vi.mock('@revealui/knowledge-graph', () => ({
  ingestEpisode: (
    exec: unknown,
    input: unknown,
    opts?: { embedder?: (text: string) => Promise<number[]> },
  ) => ingestEpisode(exec, input, opts),
  makePoolExecutor: () => ({}),
}));

vi.mock('@revealui/mcp/kg-server', async () => {
  const { z } = await import('zod/v4');
  const node = z
    .object({
      kind: z.string(),
      name: z.string(),
    })
    .passthrough();
  const edge = z
    .object({
      source: z.string(),
      target: z.string(),
      relation: z.string(),
    })
    .passthrough();
  return {
    KgAddEpisodeArgsSchema: z.object({
      nodes: z.array(node),
      edges: z.array(edge),
    }),
  };
});

vi.mock('@revealui/sync/collab/server', () => ({
  isValidKgViewSlug: (slug: string) => slug === 'notes',
}));

vi.mock('@revealui/ai/embeddings', () => ({
  generateEmbedding: (...args: unknown[]) => generateEmbedding(...args),
}));

vi.mock('@revealui/ai/llm/server', () => ({
  resolveLLMClientForRequest: (...args: unknown[]) => resolveLLM(...args),
  createLLMClientFromEnv: (...args: unknown[]) => createFromEnv(...args),
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

const flushBody = {
  viewSlug: 'notes',
  source: 'explorer',
  nodes: [{ kind: 'note', name: 'Invoice' }],
  edges: [],
};

function makeRequest(body: unknown) {
  return {
    headers: { get: () => null },
    json: () => Promise.resolve(body),
  } as never;
}

describe('POST /api/sync/kg-episodes embedding key', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue({ user: { id: 'user-1', role: 'user' } } as never);
    resolveLLM.mockResolvedValue(resolvedClient);
    delete process.env.REVEALUI_DEPLOYMENT_MODE;
    delete process.env.REVEALUI_LICENSE_PRIVATE_KEY;
  });

  async function post() {
    const { POST } = await import('../kg-episodes/route.js');
    const res = await POST(makeRequest(flushBody));
    return res as { status: number; body: Record<string, unknown> };
  }

  it('embeds with the resolved client on hosted', async () => {
    process.env.REVEALUI_DEPLOYMENT_MODE = 'hosted';

    const res = await post();

    expect(res.status).toBe(201);
    expect(resolveLLM).toHaveBeenCalledWith(
      'user-1',
      expect.anything(),
      expect.objectContaining({ isHosted: true }),
    );
    expect(generateEmbedding).toHaveBeenCalledWith('flushed fact', { client: resolvedClient });
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

    const res = await post();

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('LLM_NOT_CONFIGURED');
    expect(generateEmbedding).not.toHaveBeenCalled();
    expect(ingestEpisode).not.toHaveBeenCalled();
    expect(createFromEnv).not.toHaveBeenCalled();
  });

  it('passes isHosted false on forge and still uses the resolved client', async () => {
    process.env.REVEALUI_DEPLOYMENT_MODE = 'forge';

    const res = await post();

    expect(res.status).toBe(201);
    expect(resolveLLM).toHaveBeenCalledWith(
      'user-1',
      expect.anything(),
      expect.objectContaining({ isHosted: false }),
    );
    expect(generateEmbedding).toHaveBeenCalledWith('flushed fact', { client: resolvedClient });
    expect(createFromEnv).not.toHaveBeenCalled();
  });
});
