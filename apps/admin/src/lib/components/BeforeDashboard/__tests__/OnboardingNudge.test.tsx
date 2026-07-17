import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import OnboardingNudge from '../OnboardingNudge';

const SAMPLE_NUDGE = {
  id: 'free-first-reply',
  headline: 'Your admin is running.',
  body: 'Ask the agent to do something and watch it answer. That first reply is the whole point of this screen.',
  ctaLabel: 'Talk to your agent',
  ctaHref: '/chat',
};

function mockFetchImpl(nudge: typeof SAMPLE_NUDGE | null) {
  return vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/nudges/current')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, nudge }),
      } as Response);
    }
    if (url.includes('/dismiss')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, dismissCount: 1 }),
      } as Response);
    }
    return Promise.reject(new Error(`Unexpected fetch: ${url}`));
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('OnboardingNudge', () => {
  it('renders nothing while there is no current nudge', async () => {
    global.fetch = mockFetchImpl(null);
    render(<OnboardingNudge />);
    await waitFor(() => {
      expect(screen.queryByText('Your admin is running.')).not.toBeInTheDocument();
    });
  });

  it('renders the headline, body, and single CTA for the current nudge', async () => {
    global.fetch = mockFetchImpl(SAMPLE_NUDGE);
    render(<OnboardingNudge />);

    await waitFor(() => {
      expect(screen.getByText('Your admin is running.')).toBeInTheDocument();
    });
    expect(screen.getByText(SAMPLE_NUDGE.body)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Talk to your agent' });
    expect(link).toHaveAttribute('href', '/chat');
  });

  it('renders nothing when the fetch fails entirely', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('network down')));
    render(<OnboardingNudge />);
    await waitFor(() => {
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });
  });

  it('hides the nudge immediately on dismiss and posts the dismissal', async () => {
    global.fetch = mockFetchImpl(SAMPLE_NUDGE);
    render(<OnboardingNudge />);

    await waitFor(() => {
      expect(screen.getByText('Your admin is running.')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(screen.queryByText('Your admin is running.')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/nudges/free-first-reply/dismiss'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });
});
