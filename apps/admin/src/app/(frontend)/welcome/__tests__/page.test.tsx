import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockUseLicense = vi.fn();
vi.mock('@/lib/providers/LicenseProvider', () => ({
  useLicense: () => mockUseLicense(),
}));

import WelcomePage from '../page';

function setSearch(search: string) {
  window.history.pushState({}, '', `/welcome${search}`);
}

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
  setSearch('');
});

describe('WelcomePage', () => {
  it('leads with license key + agent CTAs in the paid-success state', () => {
    mockUseLicense.mockReturnValue({ tier: 'pro' });
    setSearch('?success=true');
    render(<WelcomePage />);

    const links = screen.getAllByRole('link');
    const hrefs = links.map((l) => l.getAttribute('href'));
    expect(hrefs[0]).toBe('/account/license');
    expect(hrefs[1]).toBe('/agents');

    expect(screen.getByText('Your license key')).toBeInTheDocument();
    expect(screen.getByText('Run your first agent')).toBeInTheDocument();
    // Only one "Run your first agent" CTA in the paid-success state.
    expect(screen.getAllByText('Run your first agent')).toHaveLength(1);
  });

  it('keeps the original CTA order and appends the agent CTA for non-paid success', () => {
    mockUseLicense.mockReturnValue({ tier: 'free' });
    setSearch('?success=true');
    render(<WelcomePage />);

    const links = screen.getAllByRole('link');
    const hrefs = links.map((l) => l.getAttribute('href'));
    const sourceIdx = hrefs.indexOf('https://github.com/RevealUIStudio/revealui');
    const agentIdx = hrefs.indexOf('/agents');
    expect(sourceIdx).toBe(0);
    expect(agentIdx).toBeGreaterThan(sourceIdx);
    expect(hrefs).not.toContain('/account/license');
    expect(screen.queryByText('Your license key')).not.toBeInTheDocument();
  });

  it('appends the agent CTA on a first-time (no success param) visit', () => {
    mockUseLicense.mockReturnValue({ tier: 'free' });
    render(<WelcomePage />);

    expect(screen.getByText('Run your first agent')).toBeInTheDocument();
    expect(screen.queryByText('Your license key')).not.toBeInTheDocument();
  });
});
