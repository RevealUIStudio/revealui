import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UsageDashboard } from '../usage-dashboard';

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

afterEach(() => {
  cleanup();
});

function jsonResponse<T>(body: T, init: { status?: number } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('UsageDashboard', () => {
  it('shows the loading state until fetch resolves', async () => {
    let resolveFetch!: (r: Response) => void;
    const fetchPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    mockFetch.mockReturnValueOnce(fetchPromise);

    render(<UsageDashboard />);
    expect(screen.getByText(/loading usage/i)).toBeInTheDocument();

    resolveFetch(
      jsonResponse({
        range: '24h',
        since: new Date('2026-04-01T00:00:00Z').toISOString(),
        accountId: 'acct-1',
        meters: [],
      }),
    );
    await waitFor(() => {
      expect(screen.queryByText(/loading usage/i)).not.toBeInTheDocument();
    });
  });

  it('renders the empty state when no meters exist for the range', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        range: '24h',
        since: new Date().toISOString(),
        accountId: 'acct-1',
        meters: [],
      }),
    );
    render(<UsageDashboard />);
    expect(await screen.findByText(/No MCP usage in the last 24 hours/i)).toBeInTheDocument();
  });

  it('renders meter rows with totals, durations, and outcome counts', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        range: '24h',
        since: new Date().toISOString(),
        accountId: 'acct-1',
        meters: [
          {
            meterName: 'mcp.tool.call',
            total: 1234,
            successCount: 1000,
            errorCount: 200,
            unknownCount: 34,
            durationCount: 1234,
            p50Ms: 120,
            p95Ms: 1500,
          },
        ],
      }),
    );
    render(<UsageDashboard />);
    expect(await screen.findByText('mcp.tool.call')).toBeInTheDocument();
    expect(screen.getByText('1,234')).toBeInTheDocument();
    expect(screen.getByText('120 ms')).toBeInTheDocument();
    expect(screen.getByText('1.50 s')).toBeInTheDocument();
    expect(screen.getByText(/1000 ok/)).toBeInTheDocument();
    expect(screen.getByText(/200 err/)).toBeInTheDocument();
    expect(screen.getByText(/34 unknown/)).toBeInTheDocument();
    // Stacked bar renders as an inline SVG with a screen-reader label.
    expect(
      screen.getByRole('img', { name: /1000 success, 200 error, 34 unknown/i }),
    ).toBeInTheDocument();
  });

  it('renders an em-dash for null p50/p95 when no durations were recorded', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        range: '24h',
        since: new Date().toISOString(),
        accountId: 'acct-1',
        meters: [
          {
            meterName: 'mcp.tool.call',
            total: 5,
            successCount: 5,
            errorCount: 0,
            unknownCount: 0,
            durationCount: 0,
            p50Ms: null,
            p95Ms: null,
          },
        ],
      }),
    );
    render(<UsageDashboard />);
    await screen.findByText('mcp.tool.call');
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });

  it('surfaces the server error message on a non-ok response', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(
        { success: false, error: 'Caller has no active account membership' },
        { status: 409 },
      ),
    );
    render(<UsageDashboard />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/no active account membership/i);
  });

  it('refetches with the new range when a different range button is pressed', async () => {
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse({
          range: '24h',
          since: new Date().toISOString(),
          accountId: 'acct-1',
          meters: [],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          range: '7d',
          since: new Date().toISOString(),
          accountId: 'acct-1',
          meters: [],
        }),
      );
    render(<UsageDashboard />);
    await screen.findByText(/No MCP usage in the last 24 hours/i);
    fireEvent.click(screen.getByRole('button', { name: '7d' }));
    await screen.findByText(/No MCP usage in the last 7 days/i);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[0]?.[0]).toBe('/api/mcp/usage?range=24h');
    expect(mockFetch.mock.calls[1]?.[0]).toBe('/api/mcp/usage?range=7d');
  });
});
