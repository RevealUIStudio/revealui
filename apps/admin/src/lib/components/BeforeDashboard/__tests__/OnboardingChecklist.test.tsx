import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockUseLicense = vi.fn();
vi.mock('@/lib/providers/LicenseProvider', () => ({
  useLicense: () => mockUseLicense(),
}));

import OnboardingChecklist from '../OnboardingChecklist';
import { DISMISSED_KEY, ONBOARDING_WALK_KEY } from '../onboarding-walk';

function mockFetchImpl(handlers: {
  agents?: { ok: boolean; body?: unknown };
  agentTasks?: { ok: boolean; body?: unknown };
  pages?: { ok: boolean; body?: unknown };
  kgRepos?: { ok: boolean; body?: unknown };
}) {
  return vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/a2a/agents')) {
      const h = handlers.agents ?? { ok: true, body: { agents: [] } };
      return Promise.resolve({ ok: h.ok, json: () => Promise.resolve(h.body) } as Response);
    }
    if (url.includes('/a2a/agent-tasks/exists')) {
      const h = handlers.agentTasks ?? { ok: true, body: { exists: false } };
      return Promise.resolve({ ok: h.ok, json: () => Promise.resolve(h.body) } as Response);
    }
    if (url.includes('/api/collections/pages')) {
      const h = handlers.pages ?? { ok: true, body: { docs: [] } };
      return Promise.resolve({ ok: h.ok, json: () => Promise.resolve(h.body) } as Response);
    }
    if (url.includes('/api/kg/repos')) {
      const h = handlers.kgRepos ?? { ok: false, status: 403, body: { error: 'Forbidden' } };
      return Promise.resolve({
        ok: h.ok,
        status: h.status ?? (h.ok ? 200 : 403),
        json: () => Promise.resolve(h.body),
      } as Response);
    }
    return Promise.reject(new Error(`Unexpected fetch: ${url}`));
  });
}

function license(tier: 'free' | 'pro' | 'max', resolveError: string | null = null) {
  mockUseLicense.mockReturnValue({
    tier,
    isLoading: false,
    resolveError,
    features: null,
    refetch: async () => undefined,
  });
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

beforeEach(() => {
  localStorage.clear();
  license('pro');
});

describe('OnboardingChecklist', () => {
  it('renders nothing when previously dismissed', () => {
    localStorage.setItem(DISMISSED_KEY, '1');
    global.fetch = mockFetchImpl({});
    render(<OnboardingChecklist />);
    expect(screen.queryByText('First-day walk')).not.toBeInTheDocument();
  });

  it('shows plan-gated Pro steps and honest Max prices', async () => {
    global.fetch = mockFetchImpl({});
    render(<OnboardingChecklist />);
    expect(screen.getByText('First-day walk')).toBeInTheDocument();
    expect(screen.getByText('Land on the dashboard')).toBeInTheDocument();
    expect(screen.getByText('Confirm your plan')).toBeInTheDocument();
    expect(screen.getByText('Run an allowed agent')).toBeInTheDocument();
    expect(screen.getByText('See the receipt')).toBeInTheDocument();
    expect(screen.getByText('Review account and billing')).toBeInTheDocument();

    const honesty = screen.getByTestId('onboarding-plan-honesty');
    expect(honesty.textContent ?? '').toContain('$99/mo');
    expect(honesty.textContent ?? '').toContain('$799/yr');
    expect(honesty.textContent ?? '').not.toContain('$299');

    const links = screen.getAllByRole('link');
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      '/dashboard',
      '/account/billing',
      '/agents',
      '/agent-tasks',
      '/account/billing',
    ]);
  });

  it('does not unlock Pro agent surfaces for Free', async () => {
    license('free');
    global.fetch = mockFetchImpl({});
    render(<OnboardingChecklist />);

    expect(screen.getByText('Create your first page')).toBeInTheDocument();
    expect(screen.getByText('Receipted agent action')).toBeInTheDocument();
    expect(screen.getByText('Pro+')).toBeInTheDocument();
    expect(screen.queryByText('Run an allowed agent')).not.toBeInTheDocument();

    const hrefs = screen.getAllByRole('link').map((l) => l.getAttribute('href'));
    expect(hrefs).toContain('/pages');
    expect(hrefs).toContain('/upgrade');
    expect(hrefs).not.toContain('/agents');
    expect(hrefs).not.toContain('/agent-tasks');
  });

  it('does not invent Free when license resolve failed', () => {
    license('free', 'unavailable');
    global.fetch = mockFetchImpl({});
    render(<OnboardingChecklist />);
    expect(screen.getByTestId('onboarding-plan-honesty')).toHaveTextContent('Plan not loaded');
    expect(screen.getByTestId('onboarding-plan-honesty')).toHaveTextContent('will not guess Free');
    expect(screen.getByText('Create your first page')).toBeInTheDocument();
    expect(screen.queryByText('Run an allowed agent')).not.toBeInTheDocument();
  });

  it('shows a checkmark for live Pro signals and persists a billing visit', async () => {
    global.fetch = mockFetchImpl({
      agents: { ok: true, body: { agents: [{ name: 'demo' }] } },
      agentTasks: { ok: true, body: { exists: true } },
      pages: { ok: true, body: { docs: [] } },
    });
    render(<OnboardingChecklist />);

    await waitFor(() => {
      expect(screen.getAllByText('✓')).toHaveLength(3);
    });

    fireEvent.click(screen.getByText('Review account and billing'));
    expect(localStorage.getItem(ONBOARDING_WALK_KEY)).toContain('billing');
    expect(localStorage.getItem(ONBOARDING_WALK_KEY)).toContain('dashboard');
  });

  it('leaves receipt unchecked when a Pro source 403s (ungated miss)', async () => {
    global.fetch = mockFetchImpl({
      agents: { ok: true, body: { agents: [] } },
      agentTasks: { ok: false, body: { error: 'AI feature requires Pro' } },
      pages: { ok: true, body: { docs: [] } },
    });
    render(<OnboardingChecklist />);

    await waitFor(() => {
      expect(screen.getByText('Land on the dashboard')).toBeInTheDocument();
    });
    expect(screen.getByText('See the receipt')).toBeInTheDocument();
    expect(screen.queryByText('✓')).not.toBeNull();
    const numbers = screen.getAllByText(/^[2-5]$/);
    expect(numbers.length).toBeGreaterThan(0);
  });

  it('falls back to the static walk when fetch throws entirely', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('network down')));
    render(<OnboardingChecklist />);

    expect(screen.getByText('Run an allowed agent')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('First-day walk')).toBeInTheDocument();
    });
  });

  it('dismisses and persists to localStorage', async () => {
    global.fetch = mockFetchImpl({});
    render(<OnboardingChecklist />);

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(screen.queryByText('First-day walk')).not.toBeInTheDocument();
    expect(localStorage.getItem(DISMISSED_KEY)).toBe('1');
  });

  it('hides Knowledge Graph for Pro when /api/kg/repos is forbidden', async () => {
    global.fetch = mockFetchImpl({ kgRepos: { ok: false, body: { error: 'Forbidden' } } });
    render(<OnboardingChecklist />);
    await waitFor(() => {
      expect(screen.getByText('First-day walk')).toBeInTheDocument();
    });
    expect(screen.queryByText('Open the Knowledge Graph')).not.toBeInTheDocument();
    expect(screen.queryByText(/Architecture diagrams/i)).not.toBeInTheDocument();
    expect(screen.getAllByRole('link').map((l) => l.getAttribute('href'))).not.toContain(
      '/knowledge-graph',
    );
  });

  it('links Knowledge Graph when the dual-gate API allows, without fake live counts', async () => {
    global.fetch = mockFetchImpl({
      kgRepos: { ok: true, body: { repos: ['revealui'] } },
    });
    render(<OnboardingChecklist />);
    await waitFor(() => {
      expect(screen.getByText('Open the Knowledge Graph')).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: /Open the Knowledge Graph/ })).toHaveAttribute(
      'href',
      '/knowledge-graph',
    );
    expect(
      screen.getByText(/Architecture diagrams come from your Knowledge Graph/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/live nodes/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\/tmp\//)).not.toBeInTheDocument();
    expect(screen.queryByText(/Mermaid/i)).not.toBeInTheDocument();
  });
});
