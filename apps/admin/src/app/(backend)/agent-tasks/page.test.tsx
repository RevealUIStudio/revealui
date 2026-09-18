// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockUseLicense = vi.fn();
vi.mock('@/lib/providers/LicenseProvider', () => ({
  useLicense: () => mockUseLicense(),
}));

import AgentTasksPage from './page';

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ agents: [] }) })),
  );
});

describe('AgentTasksPage license honesty', () => {
  it('lets an Unlimited/enterprise session reach the receipt surface', () => {
    mockUseLicense.mockReturnValue({
      features: null,
      isLoading: false,
      tier: 'enterprise',
    });
    render(<AgentTasksPage />);
    expect(screen.queryByText(/requires a Pro license/)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Agent Tasks' })).toBeInTheDocument();
  });

  it('keeps Free honestly locked behind the Pro upgrade card', () => {
    mockUseLicense.mockReturnValue({
      features: { ai: false, aiLocal: true },
      isLoading: false,
      tier: 'free',
    });
    render(<AgentTasksPage />);
    expect(screen.getByText(/requires a Pro license/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Agent Tasks' })).not.toBeInTheDocument();
  });
});
