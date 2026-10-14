/**
 * Admin chat counts an IP bucket before auth, then a user+route bucket after.
 * Both fail closed when the rate-limit store throws.
 */

import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const checkRateLimit = vi.fn();
const getSession = vi.fn();

vi.mock('@revealui/auth/server', () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimit(...args),
  getSession: (...args: unknown[]) => getSession(...args),
}));

vi.mock('@/lib/middleware/ai-feature-gate', () => ({
  checkAIFeatureGate: vi.fn().mockResolvedValue(null),
}));

vi.mock('@revealui/db', () => ({
  getClient: vi.fn().mockReturnValue({}),
}));

vi.mock('@revealui/ai/embeddings', () => ({
  generateEmbedding: vi.fn(),
}));

vi.mock('@revealui/ai/llm/server', () => ({
  createLLMClientFromEnv: vi.fn(() => ({
    chat: vi.fn(),
    getResponseCacheStats: () => undefined,
    getSemanticCacheStats: () => undefined,
  })),
  resolveLLMClientForRequest: vi.fn(async () => ({
    chat: vi.fn(),
    getResponseCacheStats: () => undefined,
    getSemanticCacheStats: () => undefined,
  })),
  hostedByokDispatchEnabled: vi.fn(() => false),
}));

vi.mock('@revealui/ai/memory/vector', () => ({
  VectorMemoryService: vi.fn().mockImplementation(() => ({
    searchSimilar: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock('@revealui/ai/tools/admin', () => ({
  createAdminTools: vi.fn().mockReturnValue([]),
}));

vi.mock('@revealui/ai/tools/registry', () => {
  class ToolRegistry {
    register = vi.fn();
    getAll = vi.fn(() => [{ name: 'list_collections' }]);
    getToolDefinitions = vi.fn(() => []);
    execute = vi.fn();
  }
  return { ToolRegistry };
});

vi.mock('@revealui/core/admin/utils/apiClient', () => ({
  apiClient: {},
}));

vi.mock('../../../../revealui.config', () => ({
  default: { collections: [], globals: [] },
}));

vi.mock('@/lib/ai/chat-cost-rails', () => ({
  ADMIN_CHAT_ROUTE: 'admin.chat',
  adminChatDisabledResponse: vi.fn(() => null),
  enforceAdminChatRails: vi.fn(async () => ({ accountId: 'acct-test' })),
  recordAdminChatCall: vi.fn(async () => undefined),
}));

vi.mock('@/lib/ai/chat-key-source', () => ({
  describeAdminChatKey: vi.fn(async () => ({
    keySource: 'env',
    provider: 'openai',
    model: 'gpt-4o',
  })),
  providerFromCircuitBreaker: vi.fn(() => 'openai'),
}));

import { POST } from '@/app/api/chat/route';

function request(): NextRequest {
  return {
    headers: new Headers({ 'x-forwarded-for': '198.51.100.20, 203.0.113.9' }),
    json: async () => ({ messages: [{ role: 'user', content: 'Hello' }] }),
  } as unknown as NextRequest;
}

describe('POST /api/chat rate limits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.REVEALUI_AI_DISABLED;
    process.env.ENABLE_VECTOR_MEMORY = 'false';
  });

  it('rejects an unauthenticated flood by IP before session lookup', async () => {
    checkRateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetAt: Date.now() + 1000 });

    const response = await POST(request());

    expect(response.status).toBe(429);
    expect(getSession).not.toHaveBeenCalled();
    expect(checkRateLimit).toHaveBeenCalledTimes(1);
    expect(checkRateLimit.mock.calls[0]?.[0]).toBe('rate_limit:203.0.113.9');
  });

  it('fails closed on the IP bucket when the store errors, before auth', async () => {
    checkRateLimit.mockRejectedValue(new Error('store down'));

    const response = await POST(request());

    expect(response.status).toBe(503);
    expect(getSession).not.toHaveBeenCalled();
    expect(checkRateLimit).toHaveBeenCalledTimes(1);
    expect(checkRateLimit.mock.calls[0]?.[0]).toBe('rate_limit:203.0.113.9');
  });

  it('still returns 401 after the IP bucket allows an anonymous request', async () => {
    checkRateLimit.mockResolvedValue({ allowed: true, remaining: 9, resetAt: Date.now() + 1000 });
    getSession.mockResolvedValue(null);

    const response = await POST(request());

    expect(response.status).toBe(401);
    expect(getSession).toHaveBeenCalledOnce();
    expect(checkRateLimit).toHaveBeenCalledTimes(1);
  });

  it('applies the user and route bucket after auth', async () => {
    checkRateLimit
      .mockResolvedValueOnce({ allowed: true, remaining: 9, resetAt: Date.now() + 1000 })
      .mockResolvedValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 1000 });
    getSession.mockResolvedValue({ user: { id: 'user-123', role: 'admin' } });

    const response = await POST(request());

    expect(response.status).toBe(429);
    expect(getSession).toHaveBeenCalledOnce();
    expect(checkRateLimit).toHaveBeenCalledTimes(2);
    expect(checkRateLimit.mock.calls[1]?.[0]).toBe('rate_limit:admin.chat:user-123');
    expect(String(checkRateLimit.mock.calls[1]?.[0])).not.toContain('203.0.113.9');
  });
});
