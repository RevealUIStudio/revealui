/**
 * Chat API Integration Tests
 * Tests the conversational AI interface for CMS management
 */

import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/chat/route';

// Mock dependencies
vi.mock('@revealui/auth/server', () => ({
  getSession: vi.fn().mockResolvedValue({
    session: {
      id: 'session-abc',
      schemaVersion: '1',
      userId: 'user-123',
      tokenHash: 'hash',
      userAgent: null,
      ipAddress: null,
      persistent: false,
      lastActivityAt: new Date(),
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 3_600_000),
    },
    user: {
      id: 'user-123',
      schemaVersion: '1',
      type: 'standard',
      name: 'Test User',
      email: 'test@example.com',
      avatarUrl: null,
      password: null,
      role: 'admin',
      status: 'active',
      agentModel: null,
      agentCapabilities: null,
      agentConfig: null,
      emailVerified: true,
      emailVerificationToken: null,
      emailVerifiedAt: null,
      preferences: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastActiveAt: null,
    },
  }),
}));

vi.mock('@revealui/core/features', () => ({
  isFeatureEnabled: vi.fn().mockReturnValue(true),
}));

vi.mock('@revealui/db', () => ({
  getClient: vi.fn().mockReturnValue({}),
}));

vi.mock('@revealui/ai/embeddings', () => ({
  generateEmbedding: vi.fn().mockResolvedValue({
    vector: new Array(1536).fill(0),
  }),
}));

vi.mock('@revealui/ai/llm/server', () => ({
  createLLMClientFromEnv: vi.fn(() => ({
    chat: vi.fn().mockResolvedValue({
      content: 'I can help you with that!',
      toolCalls: [],
    }),
    getResponseCacheStats: vi.fn().mockReturnValue(undefined),
    getSemanticCacheStats: vi.fn().mockReturnValue(undefined),
  })),
  createLLMClientForUser: vi.fn().mockResolvedValue(null),
}));

vi.mock('@revealui/ai/memory/vector', () => ({
  VectorMemoryService: vi.fn().mockImplementation(() => ({
    searchSimilar: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock('@revealui/core/admin/utils/apiClient', () => ({
  apiClient: {
    find: vi.fn().mockResolvedValue({
      docs: [],
      totalDocs: 0,
      page: 1,
      totalPages: 1,
    }),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findGlobal: vi.fn(),
    updateGlobal: vi.fn(),
  },
}));

vi.mock('../../../../revealui.config', () => ({
  default: {
    collections: [
      { slug: 'pages', labels: { singular: 'Page' } },
      { slug: 'posts', labels: { singular: 'Post' } },
    ],
    globals: [
      { slug: 'header', label: 'Header' },
      { slug: 'footer', label: 'Footer' },
    ],
  },
}));

vi.mock('@/lib/middleware/rate-limit', () => ({
  rateLimit: vi.fn(() => async () => null), // Return null = no rate limit response
}));

describe('Chat API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock environment to skip vector memory
    process.env.ENABLE_VECTOR_MEMORY = 'false';
  });

  describe('POST /api/chat', () => {
    it('should handle basic chat request', async () => {
      const request = {
        json: async () => ({
          messages: [
            {
              role: 'user',
              content: 'Hello, can you help me?',
            },
          ],
        }),
        headers: new Headers(),
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('content');
      expect(typeof data.content).toBe('string');
    });

    it('should validate request body', async () => {
      const request = {
        json: async () => ({
          // Missing required messages field
        }),
        headers: new Headers(),
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
    });

    it('should handle malformed JSON', async () => {
      const request = {
        json: async () => {
          throw new Error('Invalid JSON');
        },
        headers: new Headers(),
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
      expect(typeof data.error).toBe('string');
    });

    it('should initialize CMS tools', async () => {
      const { createLLMClientFromEnv } = await import('@revealui/ai/llm/server');
      const mockChat = vi.fn().mockResolvedValue({
        content: 'Tools are ready!',
        toolCalls: [],
      });

      vi.mocked(createLLMClientFromEnv).mockReturnValue({
        chat: mockChat,
        getResponseCacheStats: vi.fn().mockReturnValue(undefined),
        getSemanticCacheStats: vi.fn().mockReturnValue(undefined),
      } as unknown as ReturnType<typeof createLLMClientFromEnv>);

      const request = {
        json: async () => ({
          messages: [
            {
              role: 'user',
              content: 'List all collections',
            },
          ],
        }),
        headers: new Headers(),
      } as unknown as NextRequest;

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockChat).toHaveBeenCalled();

      // Verify tools were passed to LLM
      const callArgs = mockChat.mock.calls[0];
      expect(callArgs).toBeDefined();
      expect(callArgs?.[1]).toHaveProperty('tools');
      expect(Array.isArray(callArgs?.[1].tools)).toBe(true);
      expect(callArgs?.[1].tools.length).toBeGreaterThan(0);
    });

    it('should handle tool calls from LLM', async () => {
      const { createLLMClientFromEnv } = await import('@revealui/ai/llm/server');

      // Mock LLM to request a tool call
      const mockChat = vi
        .fn()
        // First call: LLM requests tool
        .mockResolvedValueOnce({
          content: '',
          toolCalls: [
            {
              id: 'call_1',
              type: 'function',
              function: {
                name: 'list_collections',
                arguments: '{}',
              },
            },
          ],
        })
        // Second call: LLM responds with final answer
        .mockResolvedValueOnce({
          content: 'Here are your collections: pages, posts',
          toolCalls: [],
        });

      vi.mocked(createLLMClientFromEnv).mockReturnValue({
        chat: mockChat,
        getResponseCacheStats: vi.fn().mockReturnValue(undefined),
        getSemanticCacheStats: vi.fn().mockReturnValue(undefined),
      } as unknown as ReturnType<typeof createLLMClientFromEnv>);

      const request = {
        json: async () => ({
          messages: [
            {
              role: 'user',
              content: 'What collections exist?',
            },
          ],
        }),
        headers: new Headers(),
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.content).toContain('collections');

      // Verify tool was called twice (once for tool, once for final response)
      expect(mockChat).toHaveBeenCalledTimes(2);
    });

    it('should handle find_documents tool call', async () => {
      const { createLLMClientFromEnv } = await import('@revealui/ai/llm/server');

      const mockChat = vi
        .fn()
        .mockResolvedValueOnce({
          content: '',
          toolCalls: [
            {
              id: 'call_1',
              type: 'function',
              function: {
                name: 'find_documents',
                arguments: JSON.stringify({
                  collection: 'pages',
                  limit: 10,
                }),
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: 'Found 2 pages',
          toolCalls: [],
        });

      vi.mocked(createLLMClientFromEnv).mockReturnValue({
        chat: mockChat,
        getResponseCacheStats: vi.fn().mockReturnValue(undefined),
        getSemanticCacheStats: vi.fn().mockReturnValue(undefined),
      } as unknown as ReturnType<typeof createLLMClientFromEnv>);

      const request = {
        json: async () => ({
          messages: [
            {
              role: 'user',
              content: 'Show me all pages',
            },
          ],
        }),
        headers: new Headers(),
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.content).toBe('Found 2 pages');

      // Verify the tool was called - check that chat was called twice
      expect(mockChat).toHaveBeenCalledTimes(2);
    });

    it('should respect max iterations limit', async () => {
      const { createLLMClientFromEnv } = await import('@revealui/ai/llm/server');

      // Mock LLM to always request tools (infinite loop)
      const mockChat = vi.fn().mockResolvedValue({
        content: '',
        toolCalls: [
          {
            id: 'call_1',
            type: 'function',
            function: {
              name: 'list_collections',
              arguments: '{}',
            },
          },
        ],
      });

      vi.mocked(createLLMClientFromEnv).mockReturnValue({
        chat: mockChat,
        getResponseCacheStats: vi.fn().mockReturnValue(undefined),
        getSemanticCacheStats: vi.fn().mockReturnValue(undefined),
      } as unknown as ReturnType<typeof createLLMClientFromEnv>);

      const request = {
        json: async () => ({
          messages: [
            {
              role: 'user',
              content: 'Test max iterations',
            },
          ],
        }),
        headers: new Headers(),
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.content).toContain('processing limit');

      // Should stop at max iterations (5)
      expect(mockChat).toHaveBeenCalledTimes(5);
    });
  });
});
