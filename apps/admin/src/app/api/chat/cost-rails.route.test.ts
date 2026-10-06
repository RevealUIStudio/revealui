/**
 * Route wiring for admin chat cost rails.
 * The conversational tests mock the rails module. This file checks the route
 * calls the kill switch and returns a quota refusal before the model.
 */

import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RecordAdminChatCallInput } from '@/lib/ai/chat-cost-rails';

const chat = vi.fn();

vi.mock('@revealui/auth/server', () => ({
  getSession: vi.fn().mockResolvedValue({
    user: { id: 'user-123', role: 'admin' },
  }),
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
    chat,
    getResponseCacheStats: () => undefined,
    getSemanticCacheStats: () => undefined,
  })),
  resolveLLMClientForRequest: vi.fn(async () => ({
    chat,
    getResponseCacheStats: () => undefined,
    getSemanticCacheStats: () => undefined,
  })),
  hostedByokDispatchEnabled: vi.fn(() => true),
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

vi.mock('@/lib/middleware/rate-limit', () => ({
  rateLimit: vi.fn(() => async () => null),
}));

const enforceAdminChatRails = vi.fn(
  async (_input: { userId: string }): Promise<Response | { accountId: string | null }> => ({
    accountId: 'acct-test',
  }),
);
const recordAdminChatCall = vi.fn(async (_input: RecordAdminChatCallInput) => undefined);

vi.mock('@/lib/ai/chat-cost-rails', async () => {
  const actual = await vi.importActual<typeof import('@/lib/ai/chat-cost-rails')>(
    '@/lib/ai/chat-cost-rails',
  );
  return {
    ...actual,
    enforceAdminChatRails: (
      input: Parameters<typeof actual.enforceAdminChatRails>[0],
    ): ReturnType<typeof enforceAdminChatRails> => enforceAdminChatRails(input),
    recordAdminChatCall: (
      input: Parameters<typeof actual.recordAdminChatCall>[0],
    ): ReturnType<typeof recordAdminChatCall> => recordAdminChatCall(input),
  } as typeof actual;
});

vi.mock('@/lib/ai/chat-key-source', () => ({
  describeAdminChatKey: vi.fn(async () => ({
    keySource: 'byok',
    provider: 'openai',
    model: 'gpt-4o',
  })),
  providerFromCircuitBreaker: vi.fn(() => 'openai'),
}));

import { getSession } from '@revealui/auth/server';
import { POST } from '@/app/api/chat/route';

function request(): NextRequest {
  return {
    json: async () => ({ messages: [{ role: 'user', content: 'Hello' }] }),
    headers: new Headers(),
  } as unknown as NextRequest;
}

describe('POST /api/chat cost rails wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.REVEALUI_AI_DISABLED;
    process.env.ENABLE_VECTOR_MEMORY = 'false';
    chat.mockResolvedValue({ content: 'ok', toolCalls: [] });
    enforceAdminChatRails.mockResolvedValue({ accountId: 'acct-test' });
  });

  it('returns 503 from the kill switch before session lookup', async () => {
    process.env.REVEALUI_AI_DISABLED = 'true';
    const response = await POST(request());
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.code).toBe('AI_DISABLED');
    expect(getSession).not.toHaveBeenCalled();
    expect(chat).not.toHaveBeenCalled();
    delete process.env.REVEALUI_AI_DISABLED;
  });

  it('returns the quota refusal and does not call the model', async () => {
    enforceAdminChatRails.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: 'Agent task quota exceeded for this billing cycle.',
          code: 'TASK_QUOTA_EXCEEDED',
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const response = await POST(request());
    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body.code).toBe('TASK_QUOTA_EXCEEDED');
    expect(chat).not.toHaveBeenCalled();
    expect(recordAdminChatCall).not.toHaveBeenCalled();
  });

  it('records a meter row after a successful model call', async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(chat).toHaveBeenCalledOnce();
    expect(recordAdminChatCall).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-123',
        accountId: 'acct-test',
        keySource: 'byok',
        provider: 'openai',
        model: 'gpt-4o',
      }),
    );
    const recorded = recordAdminChatCall.mock.calls[0]?.[0];
    if (!recorded) {
      throw new Error('expected a recorded chat call');
    }
    expect(recorded).not.toHaveProperty('prompt');
    expect(recorded).not.toHaveProperty('apiKey');
    expect(JSON.stringify(recorded)).not.toContain('Hello');
  });
});
