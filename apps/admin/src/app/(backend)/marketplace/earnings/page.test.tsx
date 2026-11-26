import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AnalyticsPage from '../analytics/page';
import EarningsDashboardPage from './page';

vi.mock('@/lib/components/LicenseGate', () => ({
  LicenseGate: ({ children }: { children: React.ReactNode }) => children,
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe.each([
  ['activity', EarningsDashboardPage],
  ['analytics', AnalyticsPage],
] as const)('Marketplace %s evidence', (_name, Page) => {
  it('shows current-price estimates for draft and published listings with their actual listing status', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        agents: [
          {
            id: 'draft-agent',
            name: 'Draft helper',
            taskCount: 2,
            rating: 0,
            reviewCount: 0,
            basePriceUsdc: '3.50',
            status: 'draft',
            version: '1.0',
            category: 'Tools',
            createdAt: '2026-10-01T12:00:00Z',
          },
          {
            id: 'published-agent',
            name: 'Published helper',
            taskCount: 3,
            rating: 4,
            reviewCount: 1,
            basePriceUsdc: '2.00',
            status: 'published',
            version: '1.0',
            category: 'Tools',
            createdAt: '2026-10-01T12:00:00Z',
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<Page />);

    expect(await screen.findByText('$13.00')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/revmarket/agents?mine=true'),
      { credentials: 'include' },
    );
    expect(screen.getAllByText('Estimated task value').length).toBeGreaterThan(0);
    expect(screen.getByText('Recorded tasks')).toBeInTheDocument();
    expect(screen.getByText(/including draft listings|1 draft/)).toBeInTheDocument();
    expect(
      screen.getByText(/Estimates use each agent's task count and current listed price/),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Draft helper' })).toHaveAttribute(
      'href',
      '/marketplace/draft-agent',
    );
    expect(screen.getByText('draft')).toBeInTheDocument();
    expect(screen.getByText('published')).toBeInTheDocument();
  });

  it('does not turn a failed request into a zero-value activity summary', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    render(<Page />);

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText(/HTTP 503/)).toBeInTheDocument();
    expect(screen.queryByText('Estimated task value')).not.toBeInTheDocument();
    expect(screen.queryByText('No agents yet')).not.toBeInTheDocument();
  });
});
