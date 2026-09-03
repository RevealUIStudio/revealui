// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WeeklyUsageChrome } from '../WeeklyUsageChrome';

function jsonResponse(body: unknown, ok = true): Promise<Response> {
  return Promise.resolve({
    ok,
    json: () => Promise.resolve(body),
  } as Response);
}

describe('WeeklyUsageChrome', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        jsonResponse({
          used: 150,
          quota: 10_000,
          overage: 0,
          cycleStart: '2026-09-01T00:00:00.000Z',
          resetAt: '2026-10-01T00:00:00.000Z',
          weekUsed: 400,
          weekStart: '2026-08-31T00:00:00.000Z',
          weekResetAt: '2026-09-07T00:00:00.000Z',
          percent: 4,
        }),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows this week percent and links to billing', async () => {
    render(<WeeklyUsageChrome />);
    const link = await screen.findByRole('link', {
      name: /this week's agent-task usage: 4%/i,
    });
    expect(link.getAttribute('href')).toBe('/account/billing');
    expect(screen.getByText('4%')).toBeDefined();
  });

  it('labels unlimited instead of 0%', async () => {
    vi.mocked(fetch).mockImplementation(() =>
      jsonResponse({
        used: 12,
        quota: -1,
        overage: 0,
        cycleStart: '2026-09-01T00:00:00.000Z',
        resetAt: '2026-10-01T00:00:00.000Z',
        weekUsed: 12,
        weekStart: '2026-08-31T00:00:00.000Z',
        weekResetAt: '2026-09-07T00:00:00.000Z',
        percent: null,
      }),
    );
    render(<WeeklyUsageChrome />);
    expect(await screen.findByText('Unlimited')).toBeDefined();
    expect(screen.queryByText('0%')).toBeNull();
  });

  it('does not render a fake 0% when the meter is unavailable', async () => {
    vi.mocked(fetch).mockImplementation(() => jsonResponse({}, false));
    render(<WeeklyUsageChrome />);
    expect(await screen.findByText('Usage unavailable')).toBeDefined();
    expect(screen.queryByText('0%')).toBeNull();
  });
});
