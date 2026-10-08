import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import LogsPage from './page';

vi.mock('@/lib/components/LicenseGate', () => ({
  LicenseGate: ({ children }: { children: React.ReactNode }) => children,
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

describe('Log empty scopes', () => {
  it.each([
    ['/logs?app=api&level=error', 'No log entries match these filters.', true],
    ['/logs', 'No log entries are available.', false],
  ] as const)(
    'describes the queried scope at %s and preserves filter recovery',
    async (url, message, filtered) => {
      window.history.replaceState(null, '', url);
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: [], total: 0, limit: 200, offset: 0 }),
      });
      vi.stubGlobal('fetch', fetchMock);
      render(<LogsPage />);
      expect(await screen.findByText(message, { exact: false })).toBeInTheDocument();
      const call = fetchMock.mock.calls[0];
      if (!call) throw new Error('Expected a scoped request');
      const request = new URL(call[0]);
      expect(request.searchParams.get('app')).toBe(filtered ? 'api' : null);
      expect(request.searchParams.get('level')).toBe(filtered ? 'error' : null);
      if (filtered) {
        expect(screen.getByRole('link', { name: 'Clear filters' })).toHaveAttribute(
          'href',
          '/logs',
        );
      } else {
        expect(screen.queryByRole('link', { name: 'Clear filters' })).not.toBeInTheDocument();
      }
    },
  );
});
