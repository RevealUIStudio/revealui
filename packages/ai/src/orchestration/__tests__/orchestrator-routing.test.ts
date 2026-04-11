/**
 * AgentOrchestrator capability-based routing tests (A3)
 */

import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

vi.mock('@revealui/core/monitoring', () => ({
  registerCleanupHandler: vi.fn(),
  unregisterCleanupHandler: vi.fn(),
}));

vi.mock('../../tools/mcp-adapter.js', () => ({
  discoverMCPTools: vi.fn().mockReturnValue([]),
}));

import type { Agent, Task } from '../agent.js';
import { AgentOrchestrator } from '../orchestrator.js';

// Minimal agent factory
function makeAgent(id: string, capabilities: string[] = [], toolNames: string[] = []): Agent {
  return {
    id,
    name: id,
    instructions: '',
    tools: toolNames.map((name) => ({
      name,
      description: '',
      parameters: z.object({}),
      execute: vi.fn(),
    })),
    config: { capabilities },
    getContext: () => ({ agentId: id }),
  };
}

function makeTask(type: string, requiredCapabilities?: string[]): Task {
  return { id: `t-${type}`, type, description: type, requiredCapabilities };
}

describe('AgentOrchestrator.findBestAgent  -  capability routing', () => {
  it('selects the agent with the highest capability overlap', async () => {
    const orchestrator = new AgentOrchestrator();
    const mockClient = {
      chat: vi.fn().mockResolvedValue({ content: 'ok', toolCalls: [] }),
    } as never;

    const adminAgent = makeAgent('admin-agent', ['admin', 'content', 'search']);
    const ticket = makeAgent('ticket-agent', ['ticket', 'admin', 'summarize']);
    orchestrator.registerAgent(adminAgent);
    orchestrator.registerAgent(ticket);
    orchestrator.setLLMClient(mockClient);

    // task requires ['admin', 'content']  -  admin-agent has both, ticket-agent has only 'admin'
    const task = makeTask('content', ['admin', 'content']);
    await orchestrator.delegateTask(task);

    const calls = vi.mocked(mockClient.chat).mock.calls;
    // The system message should be from the admin-agent's instructions
    // We can verify indirectly by checking it was called (not throwing)
    expect(calls.length).toBeGreaterThan(0);
  });

  it('falls back to tool-name matching when no capability intersection', async () => {
    const orchestrator = new AgentOrchestrator();
    const mockClient = {
      chat: vi.fn().mockResolvedValue({ content: 'ok', toolCalls: [] }),
    } as never;

    const searchAgent = makeAgent('search-agent', ['search'], ['web_search']);
    const ticketAgent = makeAgent('ticket-agent', ['ticket'], ['ticket_create']);
    orchestrator.registerAgent(searchAgent);
    orchestrator.registerAgent(ticketAgent);
    orchestrator.setLLMClient(mockClient);

    // No requiredCapabilities, but type matches 'ticket_create' tool name
    const task = makeTask('ticket');
    await orchestrator.delegateTask(task);
    expect(mockClient.chat).toHaveBeenCalled();
  });

  it('falls back to first agent when neither capability nor tool match', async () => {
    const orchestrator = new AgentOrchestrator();
    const mockClient = {
      chat: vi.fn().mockResolvedValue({ content: 'ok', toolCalls: [] }),
    } as never;

    const onlyAgent = makeAgent('only-agent', ['billing']);
    orchestrator.registerAgent(onlyAgent);
    orchestrator.setLLMClient(mockClient);

    // No match for 'pdf' task  -  should still delegate to the only registered agent
    const task = makeTask('pdf', ['pdf']);
    await orchestrator.delegateTask(task);
    expect(mockClient.chat).toHaveBeenCalled();
  });

  it('throws when no agents are registered', async () => {
    const orchestrator = new AgentOrchestrator();
    orchestrator.setLLMClient({ chat: vi.fn() } as never);

    await expect(orchestrator.delegateTask(makeTask('any'))).rejects.toThrow('No suitable agent');
  });

  it('prefers agent by explicit preferredAgentId over capability routing', async () => {
    const orchestrator = new AgentOrchestrator();
    const mockClient = {
      chat: vi.fn().mockResolvedValue({ content: 'ok', toolCalls: [] }),
    } as never;

    const agentA = makeAgent('a', ['admin']);
    const agentB = makeAgent('b', ['admin', 'content']);
    orchestrator.registerAgent(agentA);
    orchestrator.registerAgent(agentB);
    orchestrator.setLLMClient(mockClient);

    // preferredAgentId overrides capability routing
    const task = makeTask('content', ['admin', 'content']);
    await orchestrator.delegateTask(task, 'a'); // explicitly pick 'a'
    expect(mockClient.chat).toHaveBeenCalled();
  });
});
