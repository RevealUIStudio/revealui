import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@revealui/sync', () => ({
  useAgentContexts: vi.fn(),
}));

import { useAgentContexts } from '@revealui/sync';
import { AgentContexts } from '../agent-contexts';

const mockUseAgentContexts = vi.mocked(useAgentContexts);

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AgentContexts', () => {
  it('renders loading spinner while shape is loading', () => {
    mockUseAgentContexts.mockReturnValue({
      contexts: [],
      isLoading: true,
      error: null,
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    });

    render(<AgentContexts agentId="agent-1" />);

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders error alert on shape error', () => {
    mockUseAgentContexts.mockReturnValue({
      contexts: [],
      isLoading: false,
      error: new Error('Shape error'),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    });

    render(<AgentContexts agentId="agent-1" />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Failed to load agent contexts')).toBeInTheDocument();
  });

  it('renders empty state when no contexts exist for the agent', () => {
    mockUseAgentContexts.mockReturnValue({
      contexts: [],
      isLoading: false,
      error: null,
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    });

    render(<AgentContexts agentId="agent-1" />);

    expect(screen.getByText('No active contexts for this agent.')).toBeInTheDocument();
  });

  it('filters contexts by agentId and renders matching ones', () => {
    mockUseAgentContexts.mockReturnValue({
      contexts: [
        {
          id: 'ctx-1',
          session_id: 'sess-1',
          agent_id: 'agent-1',
          context: { key: 'value' },
          priority: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'ctx-2',
          session_id: 'sess-2',
          agent_id: 'agent-other',
          context: { key: 'other' },
          priority: 2,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      isLoading: false,
      error: null,
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    });

    render(<AgentContexts agentId="agent-1" />);

    expect(screen.getByText('priority 1')).toBeInTheDocument();
    expect(screen.queryByText('priority 2')).not.toBeInTheDocument();
  });

  it('renders context JSON for matching agent', () => {
    mockUseAgentContexts.mockReturnValue({
      contexts: [
        {
          id: 'ctx-1',
          session_id: 'sess-1',
          agent_id: 'agent-1',
          context: { task: 'analysis' },
          priority: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      isLoading: false,
      error: null,
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    });

    render(<AgentContexts agentId="agent-1" />);

    expect(screen.getByText(/"task": "analysis"/)).toBeInTheDocument();
  });

  it('shows empty context label when context object is empty', () => {
    mockUseAgentContexts.mockReturnValue({
      contexts: [
        {
          id: 'ctx-1',
          session_id: 'sess-1',
          agent_id: 'agent-1',
          context: {},
          priority: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      isLoading: false,
      error: null,
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    });

    render(<AgentContexts agentId="agent-1" />);

    expect(screen.getByText('empty context')).toBeInTheDocument();
  });
});
