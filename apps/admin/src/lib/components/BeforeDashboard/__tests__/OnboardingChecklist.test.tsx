import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import OnboardingChecklist from '../OnboardingChecklist';

const DISMISSED_KEY = 'revealui-onboarding-dismissed';

function mockFetchImpl(handlers: {
  agents?: { ok: boolean; body?: unknown };
  agentTasks?: { ok: boolean; body?: unknown };
  pages?: { ok: boolean; body?: unknown };
  products?: { ok: boolean; body?: unknown };
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
    if (url.includes('/api/collections/products')) {
      const h = handlers.products ?? { ok: true, body: { docs: [] } };
      return Promise.resolve({ ok: h.ok, json: () => Promise.resolve(h.body) } as Response);
    }
    return Promise.reject(new Error(`Unexpected fetch: ${url}`));
  });
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

beforeEach(() => {
  localStorage.clear();
});

describe('OnboardingChecklist', () => {
  it('renders nothing when previously dismissed', () => {
    localStorage.setItem(DISMISSED_KEY, '1');
    global.fetch = mockFetchImpl({});
    render(<OnboardingChecklist />);
    expect(screen.queryByText('Getting Started')).not.toBeInTheDocument();
  });

  it('renders the four data-derived items in order', async () => {
    global.fetch = mockFetchImpl({});
    render(<OnboardingChecklist />);
    expect(screen.getByText('Run your first agent')).toBeInTheDocument();
    expect(screen.getByText('See the receipt')).toBeInTheDocument();
    expect(screen.getByText('Create your first page')).toBeInTheDocument();
    expect(screen.getByText('Add a product')).toBeInTheDocument();

    const links = screen.getAllByRole('link');
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      '/agents',
      '/agent-tasks',
      '/pages',
      '/products',
    ]);
  });

  it('shows a checkmark for items with existing data', async () => {
    global.fetch = mockFetchImpl({
      agents: { ok: true, body: { agents: [{ name: 'demo' }] } },
      agentTasks: { ok: true, body: { exists: true } },
      pages: { ok: true, body: { docs: [{ id: '1' }] } },
      products: { ok: true, body: { docs: [] } },
    });
    render(<OnboardingChecklist />);

    await waitFor(() => {
      expect(screen.getAllByText('✓')).toHaveLength(3); // adherence-ignore: checkmark-glyph - asserts against OnboardingChecklist.tsx's existing &#10003; entity output, not UI copy authored here
    });
    // "Add a product" stays unchecked (no docs)
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('renders every item unchecked when a source 403s (ungated tier)', async () => {
    global.fetch = mockFetchImpl({
      agents: { ok: true, body: { agents: [] } },
      agentTasks: { ok: false, body: { error: 'AI feature requires Pro' } },
      pages: { ok: true, body: { docs: [] } },
      products: { ok: true, body: { docs: [] } },
    });
    render(<OnboardingChecklist />);

    await waitFor(() => {
      expect(screen.queryAllByText('✓')).toHaveLength(0); // adherence-ignore: checkmark-glyph - asserts against OnboardingChecklist.tsx's existing &#10003; entity output, not UI copy authored here
    });
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('falls back to the unchecked static list when fetch throws entirely', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('network down')));
    render(<OnboardingChecklist />);

    // Never breaks the dashboard: items still render, none crash-derived.
    expect(screen.getByText('Run your first agent')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryAllByText('✓')).toHaveLength(0); // adherence-ignore: checkmark-glyph - asserts against OnboardingChecklist.tsx's existing &#10003; entity output, not UI copy authored here
    });
  });

  it('dismisses and persists to localStorage', async () => {
    global.fetch = mockFetchImpl({});
    render(<OnboardingChecklist />);

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(screen.queryByText('Getting Started')).not.toBeInTheDocument();
    expect(localStorage.getItem(DISMISSED_KEY)).toBe('1');
  });
});
