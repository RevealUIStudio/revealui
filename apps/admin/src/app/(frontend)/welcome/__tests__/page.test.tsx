import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatTrialEndDate } from '../../account/billing/trial-copy';

const mockUseLicense = vi.fn();
vi.mock('@/lib/providers/LicenseProvider', () => ({
  useLicense: () => mockUseLicense(),
}));

import WelcomePage from '../page';

const TRIAL_END = '2026-08-27T00:00:00.000Z';
const originalFetch = globalThis.fetch;

function setSearch(search: string) {
  window.history.pushState({}, '', `/welcome${search}`);
}

function mockSubscription(payload: {
  tier: string;
  status: string;
  expiresAt: string | null;
  perpetual?: boolean;
}): void {
  globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/api/billing/subscription')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(payload),
      } as Response);
    }
    return Promise.resolve({ ok: false, json: () => Promise.resolve({}) } as Response);
  });
}

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
});

beforeEach(() => {
  vi.clearAllMocks();
  setSearch('');
  mockUseLicense.mockReturnValue({ tier: 'free' });
  mockSubscription({ tier: 'free', status: 'active', expiresAt: null });
});

describe('WelcomePage', () => {
  it('leads with license key + agent CTAs in the paid-success state', async () => {
    mockUseLicense.mockReturnValue({ tier: 'pro' });
    mockSubscription({ tier: 'pro', status: 'active', expiresAt: null });
    setSearch('?success=true');
    render(<WelcomePage />);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
    });

    const links = screen.getAllByRole('link');
    const hrefs = links.map((l) => l.getAttribute('href'));
    expect(hrefs[0]).toBe('/account/license');
    expect(hrefs[1]).toBe('/agents');

    expect(screen.getByText('Your license key')).toBeInTheDocument();
    expect(screen.getByText('First governed agent action')).toBeInTheDocument();
    // Only one first-agent CTA in the paid-success state.
    expect(screen.getAllByText('First governed agent action')).toHaveLength(1);
  });

  it('keeps the original CTA order and appends the agent CTA for non-paid success', async () => {
    mockUseLicense.mockReturnValue({ tier: 'free' });
    setSearch('?success=true');
    render(<WelcomePage />);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
    });

    const links = screen.getAllByRole('link');
    const hrefs = links.map((l) => l.getAttribute('href'));
    const sourceIdx = hrefs.indexOf('https://github.com/RevealUIStudio/revealui');
    const agentIdx = hrefs.indexOf('/agents');
    expect(sourceIdx).toBe(0);
    expect(agentIdx).toBeGreaterThan(sourceIdx);
    expect(hrefs).not.toContain('/account/license');
    expect(screen.queryByText('Your license key')).not.toBeInTheDocument();
  });

  it('labels a Max paid-success visit as Max, not Pro', async () => {
    mockUseLicense.mockReturnValue({ tier: 'max' });
    mockSubscription({ tier: 'max', status: 'active', expiresAt: null });
    setSearch('?success=true');
    render(<WelcomePage />);

    expect(await screen.findByText(/Your Max subscription is active/)).toBeInTheDocument();
    expect(screen.queryByText(/Your Pro subscription is active/)).not.toBeInTheDocument();
  });

  it('appends the agent CTA on a first-time (no success param) visit', async () => {
    mockUseLicense.mockReturnValue({ tier: 'free' });
    render(<WelcomePage />);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
    });

    // Free / non-paid-success still uses the original heading; paid-success
    // uses "First governed agent action" (GAP-302 residual).
    expect(screen.getByText('Run your first agent')).toBeInTheDocument();
    expect(screen.queryByText('Your license key')).not.toBeInTheDocument();
  });

  it('shows the stored trial end date when a Pro trial payload includes expiresAt', async () => {
    mockUseLicense.mockReturnValue({ tier: 'pro' });
    mockSubscription({
      tier: 'pro',
      status: 'trialing',
      expiresAt: TRIAL_END,
    });
    render(<WelcomePage />);

    expect(
      await screen.findByText(`Your Pro trial ends on ${formatTrialEndDate(TRIAL_END)}`),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Billing portal' })).toHaveAttribute(
      'href',
      '/account/billing',
    );
  });

  it('shows the stored Max trial end date and does not call it Pro', async () => {
    mockUseLicense.mockReturnValue({ tier: 'max' });
    mockSubscription({
      tier: 'max',
      status: 'trialing',
      expiresAt: TRIAL_END,
    });
    setSearch('?success=true');
    render(<WelcomePage />);

    expect(
      await screen.findByText(`Your Max trial ends on ${formatTrialEndDate(TRIAL_END)}`),
    ).toBeInTheDocument();
    expect(screen.getByText(/Your Max subscription is active/)).toBeInTheDocument();
    expect(screen.queryByText(/Your Pro trial ends/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Billing portal' })).toBeInTheDocument();
  });

  it('does not invent a trial end date when expiresAt is missing', async () => {
    mockUseLicense.mockReturnValue({ tier: 'pro' });
    mockSubscription({
      tier: 'pro',
      status: 'trialing',
      expiresAt: null,
    });
    render(<WelcomePage />);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
    });

    expect(screen.queryByText(/trial ends on/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/subscription ends on/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Billing portal' })).toBeInTheDocument();
  });

  it('does not show a trial countdown for free or perpetual accounts', async () => {
    mockUseLicense.mockReturnValue({ tier: 'free' });
    mockSubscription({ tier: 'free', status: 'active', expiresAt: null });
    render(<WelcomePage />);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
    });

    expect(screen.queryByText(/trial ends on/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/subscription ends on/i)).not.toBeInTheDocument();

    cleanup();

    mockUseLicense.mockReturnValue({ tier: 'pro' });
    mockSubscription({
      tier: 'pro',
      status: 'active',
      expiresAt: TRIAL_END,
      perpetual: true,
    });
    render(<WelcomePage />);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
    });

    expect(screen.queryByText(/trial ends on/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/subscription ends on/i)).not.toBeInTheDocument();
  });
});
