import type { AgentDefinition } from '@revealui/contracts/agents';
import { beforeEach, describe, expect, it } from 'vitest';
import { WorkingMemory } from '../memory/stores/working-memory.js';

describe('WorkingMemory', () => {
  let memory: WorkingMemory;
  const sessionId = 'session-123';
  const nodeId = 'node-abc';

  beforeEach(() => {
    memory = new WorkingMemory(sessionId, nodeId);
  });

  describe('Context Operations', () => {
    it('should initialize with empty context', () => {
      expect(memory.getContext()).toEqual({});
    });

    it('should set and get context', () => {
      const context = { userId: 'user-1', theme: 'dark' };
      memory.setContext(context);
      expect(memory.getContext()).toEqual(context);
    });

    it('should update context with partial data', () => {
      memory.setContext({ userId: 'user-1', theme: 'dark' });
      memory.updateContext({ theme: 'light' });
      expect(memory.getContext()).toEqual({ userId: 'user-1', theme: 'light' });
    });

    it('should set and get context values', () => {
      memory.setContextValue('userId', 'user-1');
      expect(memory.getContextValue('userId')).toBe('user-1');
    });
  });

  describe('Agent Operations', () => {
    const agent: AgentDefinition = {
      id: 'agent-1',
      version: 1,
      name: 'Test Agent',
      description: 'A test agent',
      model: 'gpt-4',
      systemPrompt: 'You are a test agent',
      tools: [],
      capabilities: ['test'],
      temperature: 0.7,
      maxTokens: 4096,
    };

    it('should add an agent', () => {
      const tag = memory.addAgent(agent);
      expect(tag).toBeTruthy();
      expect(memory.getActiveAgents()).toHaveLength(1);
      expect(memory.getActiveAgents()[0]).toEqual(agent);
    });

    it('should remove an agent by tag', () => {
      const tag = memory.addAgent(agent);
      const removed = memory.removeAgent(tag);
      expect(removed).toBe(true);
      expect(memory.getActiveAgents()).toHaveLength(0);
    });

    it('should remove an agent by ID', () => {
      memory.addAgent(agent);
      const count = memory.removeAgentById('agent-1');
      expect(count).toBe(1);
      expect(memory.getActiveAgents()).toHaveLength(0);
    });

    it('should check if agent is active', () => {
      expect(memory.hasAgent('agent-1')).toBe(false);
      memory.addAgent(agent);
      expect(memory.hasAgent('agent-1')).toBe(true);
    });
  });

  describe('Session State Operations', () => {
    it('should initialize with active status', () => {
      expect(memory.getSessionState().status).toBe('active');
    });

    it('should update session state', () => {
      memory.updateSessionState({ status: 'paused' });
      expect(memory.getSessionState().status).toBe('paused');
    });

    it('should update session state with partial data', () => {
      memory.updateSessionState({
        focus: { siteId: 'site-1', pageId: 'page-1' },
      });
      const state = memory.getSessionState();
      expect(state.status).toBe('active'); // Should preserve existing
      expect(state.focus?.siteId).toBe('site-1');
      expect(state.focus?.pageId).toBe('page-1');
    });
  });

  describe('Merge Operations', () => {
    it('should merge two WorkingMemory instances', () => {
      const memory1 = new WorkingMemory(sessionId, 'node-1');
      const memory2 = new WorkingMemory(sessionId, 'node-2');

      memory1.setContext({ userId: 'user-1', theme: 'dark' });
      memory2.setContext({ userId: 'user-2', theme: 'light' });

      // Later write wins (LWW)
      const merged = memory1.merge(memory2);
      expect(merged.getContext().theme).toBe('light');
    });

    it('should merge active agents', () => {
      const memory1 = new WorkingMemory(sessionId, 'node-1');
      const memory2 = new WorkingMemory(sessionId, 'node-2');

      const agent1: AgentDefinition = {
        id: 'agent-1',
        version: 1,
        name: 'Agent 1',
        description: 'First agent',
        model: 'gpt-4',
        systemPrompt: 'You are agent 1',
        tools: [],
        capabilities: [],
        temperature: 0.7,
        maxTokens: 4096,
      };

      const agent2: AgentDefinition = {
        id: 'agent-2',
        version: 1,
        name: 'Agent 2',
        description: 'Second agent',
        model: 'gpt-4',
        systemPrompt: 'You are agent 2',
        tools: [],
        capabilities: [],
        temperature: 0.7,
        maxTokens: 4096,
      };

      memory1.addAgent(agent1);
      memory2.addAgent(agent2);

      const merged = memory1.merge(memory2);
      expect(merged.getActiveAgents()).toHaveLength(2);
    });
  });

  describe('Serialization', () => {
    it('should serialize to data', () => {
      memory.setContext({ userId: 'user-1' });
      const data = memory.toData();
      expect(data.sessionId).toBe(sessionId);
      expect(data.nodeId).toBe(nodeId);
      expect(data.context).toBeDefined();
      expect(data.sessionState).toBeDefined();
      expect(data.activeAgents).toBeDefined();
    });

    it('should deserialize from data', () => {
      memory.setContext({ userId: 'user-1' });
      const data = memory.toData();
      const restored = WorkingMemory.fromData(data);
      expect(restored.getContext()).toEqual(memory.getContext());
    });

    it('should clone WorkingMemory', () => {
      memory.setContext({ userId: 'user-1' });
      const cloned = memory.clone();
      expect(cloned.getContext()).toEqual(memory.getContext());
      expect(cloned).not.toBe(memory);
    });
  });

  describe('Getters', () => {
    it('should get session ID', () => {
      expect(memory.getSessionId()).toBe(sessionId);
    });

    it('should get node ID', () => {
      expect(memory.getNodeId()).toBe(nodeId);
    });
  });
});
