import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DELETE as deleteAgentContext,
  GET as getAgentContext,
  POST as postAgentContext,
} from '../../app/api/memory/context/[sessionId]/[agentId]/route';
import { DELETE as deleteEpisodicMemory } from '../../app/api/memory/episodic/[userId]/[memoryId]/route';
import {
  GET as getEpisodicMemory,
  POST as postEpisodicMemory,
} from '../../app/api/memory/episodic/[userId]/route';
import {
  GET as getWorkingMemory,
  POST as postWorkingMemory,
} from '../../app/api/memory/working/[sessionId]/route';

vi.mock('@revealui/core/features', () => ({
  isFeatureEnabled: vi.fn().mockReturnValue(true),
}));

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

vi.mock('@revealui/db/client', () => {
  const chain = {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn().mockResolvedValue([{ userId: 'user-123' }]),
    insert: vi.fn(),
    values: vi.fn().mockResolvedValue([]),
  };
  chain.select.mockReturnValue(chain);
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.insert.mockReturnValue(chain);
  return { getClient: vi.fn(() => chain) };
});

vi.mock('@revealui/ai/memory/persistence', () => {
  class CRDTPersistence {
    loadCompositeState = vi.fn().mockResolvedValue(new Map());
    saveCompositeState = vi.fn().mockResolvedValue(undefined);
  }
  return { CRDTPersistence };
});

vi.mock('@revealui/ai/memory/stores', () => {
  class WorkingMemory {
    load = vi.fn().mockResolvedValue(undefined);
    save = vi.fn().mockResolvedValue(undefined);
    getSessionId = vi.fn().mockReturnValue('session-123');
    getContext = vi.fn().mockReturnValue({ userId: 'user-1' });
    getSessionState = vi.fn().mockReturnValue({ active: true });
    getActiveAgents = vi.fn().mockReturnValue([]);
    setContext = vi.fn();
    updateSessionState = vi.fn();
    addAgent = vi.fn();
    removeAgentById = vi.fn();
  }
  class EpisodicMemory {
    load = vi.fn().mockResolvedValue(undefined);
    save = vi.fn().mockResolvedValue(undefined);
    getAll = vi.fn().mockResolvedValue([]);
    get = vi.fn().mockResolvedValue(null);
    add = vi.fn().mockResolvedValue('tag-123');
    removeById = vi.fn().mockResolvedValue(1);
    getUserId = vi.fn().mockReturnValue('user-123');
    getAccessCount = vi.fn().mockReturnValue(0);
  }
  return { WorkingMemory, EpisodicMemory };
});

vi.mock('@revealui/ai/memory/agent', () => {
  class AgentContextManager {
    load = vi.fn().mockResolvedValue(undefined);
    save = vi.fn().mockResolvedValue(undefined);
    getSessionId = vi.fn().mockReturnValue('session-123');
    getAgentId = vi.fn().mockReturnValue('agent-456');
    getAllContext = vi.fn().mockReturnValue({ theme: 'dark' });
    updateContext = vi.fn();
    removeContext = vi.fn();
  }
  return { AgentContextManager };
});

vi.mock('@/lib/utilities/nodeId', () => ({
  getNodeIdFromSession: vi.fn().mockResolvedValue('node-session-123'),
  getNodeIdFromUser: vi.fn().mockResolvedValue('node-user-123'),
}));

vi.mock('@revealui/contracts', () => ({
  AgentMemoryContract: {
    validate: vi.fn((body: unknown) => {
      if (body && typeof body === 'object' && 'id' in body && 'content' in body && 'type' in body) {
        return { success: true, data: body, errors: { issues: [] } };
      }
      return {
        success: false,
        data: null,
        errors: { issues: [{ message: 'Invalid memory', path: ['body'] }] },
      };
    }),
  },
}));

function makeRequest(url: string, options?: RequestInit): Request {
  return new Request(url, options);
}

describe('Memory API Routes', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─── Working Memory ────────────────────────────────────────────────────────

  describe('GET /api/memory/working/:sessionId', () => {
    it('returns working memory for valid sessionId', async () => {
      const request = makeRequest('http://localhost/api/memory/working/session-123');
      const params = Promise.resolve({ sessionId: 'session-123' });

      const response = await getWorkingMemory(request as never, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('sessionId', 'session-123');
      expect(data).toHaveProperty('context');
      expect(data).toHaveProperty('sessionState');
      expect(data).toHaveProperty('activeAgents');
    });

    it('returns 400 for empty sessionId', async () => {
      const request = makeRequest('http://localhost/api/memory/working/');
      const params = Promise.resolve({ sessionId: '' });

      const response = await getWorkingMemory(request as never, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toContain('Invalid sessionId');
    });
  });

  describe('POST /api/memory/working/:sessionId', () => {
    it('updates working memory', async () => {
      const request = makeRequest('http://localhost/api/memory/working/session-123', {
        method: 'POST',
        body: JSON.stringify({ context: { userId: 'user-1' }, sessionState: { active: true } }),
      });
      const params = Promise.resolve({ sessionId: 'session-123' });

      const response = await postWorkingMemory(request as never, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('returns 400 for empty sessionId', async () => {
      const request = makeRequest('http://localhost/api/memory/working/', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const params = Promise.resolve({ sessionId: '' });

      const response = await postWorkingMemory(request as never, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toContain('Invalid sessionId');
    });
  });

  // ─── Episodic Memory ───────────────────────────────────────────────────────

  describe('GET /api/memory/episodic/:userId', () => {
    it('returns episodic memories for valid userId', async () => {
      const request = makeRequest('http://localhost/api/memory/episodic/user-123');
      const params = Promise.resolve({ userId: 'user-123' });

      const response = await getEpisodicMemory(request as never, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('userId');
      expect(data).toHaveProperty('memories');
      expect(Array.isArray(data.memories)).toBe(true);
    });

    it('returns 400 for empty userId', async () => {
      const request = makeRequest('http://localhost/api/memory/episodic/');
      const params = Promise.resolve({ userId: '' });

      const response = await getEpisodicMemory(request as never, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toContain('Invalid userId');
    });
  });

  describe('POST /api/memory/episodic/:userId', () => {
    const validMemory = {
      id: 'mem-1',
      content: 'Test memory content',
      type: 'episodic',
      source: 'test',
      embedding: null,
      metadata: {},
      verified: false,
      createdAt: new Date().toISOString(),
      accessedAt: new Date().toISOString(),
      accessCount: 0,
    };

    it('adds a valid memory', async () => {
      const request = makeRequest('http://localhost/api/memory/episodic/user-123', {
        method: 'POST',
        body: JSON.stringify(validMemory),
      });
      const params = Promise.resolve({ userId: 'user-123' });

      const response = await postEpisodicMemory(request as never, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data).toHaveProperty('tag');
    });

    it('returns 400 for invalid memory schema', async () => {
      const request = makeRequest('http://localhost/api/memory/episodic/user-123', {
        method: 'POST',
        body: JSON.stringify({ bad: 'data' }),
      });
      const params = Promise.resolve({ userId: 'user-123' });

      const response = await postEpisodicMemory(request as never, { params });
      await response.json();

      expect(response.status).toBe(400);
    });

    it('returns 400 for invalid JSON', async () => {
      const request = makeRequest('http://localhost/api/memory/episodic/user-123', {
        method: 'POST',
        body: '{bad',
      });
      const params = Promise.resolve({ userId: 'user-123' });

      const response = await postEpisodicMemory(request as never, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toContain('Invalid JSON');
    });

    it('returns 400 for empty userId', async () => {
      const request = makeRequest('http://localhost/api/memory/episodic/', {
        method: 'POST',
        body: JSON.stringify(validMemory),
      });
      const params = Promise.resolve({ userId: '' });

      const response = await postEpisodicMemory(request as never, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toContain('Invalid userId');
    });
  });

  describe('DELETE /api/memory/episodic/:userId/:memoryId', () => {
    it('removes a memory', async () => {
      const request = makeRequest('http://localhost/api/memory/episodic/user-123/mem-1', {
        method: 'DELETE',
      });
      const params = Promise.resolve({ userId: 'user-123', memoryId: 'mem-1' });

      const response = await deleteEpisodicMemory(request as never, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('returns 400 for empty userId', async () => {
      const request = makeRequest('http://localhost/api/memory/episodic//mem-1', {
        method: 'DELETE',
      });
      const params = Promise.resolve({ userId: '', memoryId: 'mem-1' });

      const response = await deleteEpisodicMemory(request as never, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toContain('Invalid userId');
    });

    it('returns 400 for empty memoryId', async () => {
      const request = makeRequest('http://localhost/api/memory/episodic/user-123/', {
        method: 'DELETE',
      });
      const params = Promise.resolve({ userId: 'user-123', memoryId: '' });

      const response = await deleteEpisodicMemory(request as never, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toContain('Invalid memoryId');
    });
  });

  // ─── Agent Context ─────────────────────────────────────────────────────────

  describe('GET /api/memory/context/:sessionId/:agentId', () => {
    it('returns agent context for valid params', async () => {
      const request = makeRequest('http://localhost/api/memory/context/session-123/agent-456');
      const params = Promise.resolve({ sessionId: 'session-123', agentId: 'agent-456' });

      const response = await getAgentContext(request as never, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('sessionId', 'session-123');
      expect(data).toHaveProperty('agentId', 'agent-456');
      expect(data).toHaveProperty('context');
    });

    it('returns 400 for empty sessionId', async () => {
      const request = makeRequest('http://localhost/api/memory/context//agent-456');
      const params = Promise.resolve({ sessionId: '', agentId: 'agent-456' });

      const response = await getAgentContext(request as never, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toContain('Invalid sessionId');
    });

    it('returns 400 for empty agentId', async () => {
      const request = makeRequest('http://localhost/api/memory/context/session-123/');
      const params = Promise.resolve({ sessionId: 'session-123', agentId: '' });

      const response = await getAgentContext(request as never, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toContain('Invalid agentId');
    });
  });

  describe('POST /api/memory/context/:sessionId/:agentId', () => {
    it('updates context with single key-value', async () => {
      const request = makeRequest('http://localhost/api/memory/context/session-123/agent-456', {
        method: 'POST',
        body: JSON.stringify({ theme: 'dark' }),
      });
      const params = Promise.resolve({ sessionId: 'session-123', agentId: 'agent-456' });

      const response = await postAgentContext(request as never, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.sessionId).toBe('session-123');
      expect(data.agentId).toBe('agent-456');
    });

    it('updates context with multiple keys', async () => {
      const request = makeRequest('http://localhost/api/memory/context/session-123/agent-456', {
        method: 'POST',
        body: JSON.stringify({ theme: 'dark', language: 'en' }),
      });
      const params = Promise.resolve({ sessionId: 'session-123', agentId: 'agent-456' });

      const response = await postAgentContext(request as never, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('returns 400 for invalid JSON', async () => {
      const request = makeRequest('http://localhost/api/memory/context/session-123/agent-456', {
        method: 'POST',
        body: 'invalid json{',
      });
      const params = Promise.resolve({ sessionId: 'session-123', agentId: 'agent-456' });

      const response = await postAgentContext(request as never, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toContain('Invalid JSON');
    });

    it('returns 400 for non-object body', async () => {
      const request = makeRequest('http://localhost/api/memory/context/session-123/agent-456', {
        method: 'POST',
        body: JSON.stringify('not an object'),
      });
      const params = Promise.resolve({ sessionId: 'session-123', agentId: 'agent-456' });

      const response = await postAgentContext(request as never, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toContain('must be a JSON object');
    });

    it('returns 400 for empty sessionId', async () => {
      const request = makeRequest('http://localhost/api/memory/context//agent-456', {
        method: 'POST',
        body: JSON.stringify({ theme: 'dark' }),
      });
      const params = Promise.resolve({ sessionId: '', agentId: 'agent-456' });

      const response = await postAgentContext(request as never, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toContain('Invalid sessionId');
    });

    it('returns 400 for empty agentId', async () => {
      const request = makeRequest('http://localhost/api/memory/context/session-123/', {
        method: 'POST',
        body: JSON.stringify({ theme: 'dark' }),
      });
      const params = Promise.resolve({ sessionId: 'session-123', agentId: '' });

      const response = await postAgentContext(request as never, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toContain('Invalid agentId');
    });
  });

  describe('DELETE /api/memory/context/:sessionId/:agentId', () => {
    it('removes a context key', async () => {
      const request = makeRequest('http://localhost/api/memory/context/session-123/agent-456', {
        method: 'DELETE',
        body: JSON.stringify({ key: 'theme' }),
      });
      const params = Promise.resolve({ sessionId: 'session-123', agentId: 'agent-456' });

      const response = await deleteAgentContext(request as never, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('returns 400 for missing key', async () => {
      const request = makeRequest('http://localhost/api/memory/context/session-123/agent-456', {
        method: 'DELETE',
        body: JSON.stringify({}),
      });
      const params = Promise.resolve({ sessionId: 'session-123', agentId: 'agent-456' });

      const response = await deleteAgentContext(request as never, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toContain('Missing or invalid key');
    });

    it('returns 400 when body is absent', async () => {
      const request = makeRequest('http://localhost/api/memory/context/session-123/agent-456', {
        method: 'DELETE',
      });
      const params = Promise.resolve({ sessionId: 'session-123', agentId: 'agent-456' });

      const response = await deleteAgentContext(request as never, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toContain('Missing or invalid key');
    });

    it('returns 400 for empty sessionId', async () => {
      const request = makeRequest('http://localhost/api/memory/context//agent-456', {
        method: 'DELETE',
        body: JSON.stringify({ key: 'theme' }),
      });
      const params = Promise.resolve({ sessionId: '', agentId: 'agent-456' });

      const response = await deleteAgentContext(request as never, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toContain('Invalid sessionId');
    });
  });
});
