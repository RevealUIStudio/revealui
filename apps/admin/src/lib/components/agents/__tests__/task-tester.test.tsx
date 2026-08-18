import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockApiFetch = vi.fn();
vi.mock('@/lib/utils/csrf', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

vi.mock('@/components/UpgradePrompt', () => ({
  UpgradePrompt: ({ feature, description }: { feature: string; description?: string }) => (
    <div data-testid="upgrade-prompt">
      Upgrade required for {feature}
      {description ? `: ${description}` : ''}
    </div>
  ),
}));

import { TaskTester } from '../task-tester';

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('TaskTester', () => {
  it('offers Send Task when the account can reach the tester', () => {
    render(<TaskTester agentId="agent-1" agentName="Ticket Agent" />);

    expect(screen.getByRole('button', { name: /send task/i })).toBeInTheDocument();
  });

  it('replaces a license-gate 403 with the upgrade prompt instead of the raw API sentence', async () => {
    mockApiFetch.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        error: {
          code: -32003,
          message:
            "Feature 'ai' requires a Pro or Enterprise license. Upgrade at https://revealui.com/pricing",
        },
      }),
    });

    render(<TaskTester agentId="agent-1" agentName="Ticket Agent" />);

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'List my open tickets.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send task/i }));

    await waitFor(() => {
      expect(screen.getByTestId('upgrade-prompt')).toBeInTheDocument();
    });
    expect(
      screen.queryByText(/Feature 'ai' requires a Pro or Enterprise license/i),
    ).not.toBeInTheDocument();
  });

  it('surfaces a string CSRF body and HTTP status instead of a silent no-op', async () => {
    mockApiFetch.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: 'CSRF token missing' }),
    });

    render(<TaskTester agentId="agent-1" agentName="Ticket Agent" />);

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'List my open tickets.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send task/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('CSRF token missing');
    });
    expect(screen.getByRole('alert')).toHaveTextContent('HTTP 403');
  });

  it('surfaces HTTP status when the POST fails without a parseable error object', async () => {
    mockApiFetch.mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({}),
    });

    render(<TaskTester agentId="agent-1" agentName="Ticket Agent" />);

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'List my open tickets.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send task/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('HTTP 502');
    });
  });

  it('surfaces unreadable JSON instead of a silent no-op', async () => {
    mockApiFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new SyntaxError('Unexpected token < in JSON');
      },
    });

    render(<TaskTester agentId="agent-1" agentName="Ticket Agent" />);

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'List my open tickets.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send task/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('HTTP 500');
    });
    expect(screen.getByRole('alert')).toHaveTextContent('non-JSON');
  });
});
