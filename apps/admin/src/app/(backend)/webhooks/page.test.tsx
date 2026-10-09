import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import WebhooksPage from './page';

vi.mock('@/lib/components/LicenseGate', () => ({
  LicenseGate: ({ children }: { children: React.ReactNode }) => children,
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

describe('Webhook empty scopes', () => {
  it.each([
    ['/webhooks?type=checkout.session.completed', 'No webhook events match this filter.', true],
    ['/webhooks', 'No processed webhook events are available.', false],
  ] as const)(
    'describes the queried scope at %s and preserves filter recovery',
    async (url, message, filtered) => {
      window.history.replaceState(null, '', url);
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: [], total: 0, limit: 200, offset: 0 }),
      });
      vi.stubGlobal('fetch', fetchMock);
      render(<WebhooksPage />);
      expect(await screen.findByText(message, { exact: false })).toBeInTheDocument();
      const call = fetchMock.mock.calls[0];
      if (!call) throw new Error('Expected a scoped request');
      const request = new URL(call[0]);
      expect(request.searchParams.get('eventType')).toBe(
        filtered ? 'checkout.session.completed' : null,
      );
      if (filtered) {
        expect(screen.getByRole('link', { name: 'Clear filter' })).toHaveAttribute(
          'href',
          '/webhooks',
        );
      } else {
        expect(screen.queryByRole('link', { name: 'Clear filter' })).not.toBeInTheDocument();
      }
    },
  );
});
