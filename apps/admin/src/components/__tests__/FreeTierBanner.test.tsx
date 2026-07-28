import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockUseLicense = vi.fn();
vi.mock('@/lib/providers/LicenseProvider', () => ({
  useLicense: () => mockUseLicense(),
}));

vi.mock('@revealui/presentation/server', () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    appearance?: string;
    variant?: string;
    size?: string;
  }) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  IconClose: () => <span data-testid="icon-close" />,
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { FreeTierBanner } from '../FreeTierBanner';

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

beforeEach(() => {
  vi.clearAllMocks();
  mockUseLicense.mockReturnValue({ tier: 'free', isLoading: false, resolveError: null });
});

describe('FreeTierBanner', () => {
  it('renders nothing while loading', () => {
    mockUseLicense.mockReturnValue({ tier: 'free', isLoading: true, resolveError: null });
    render(<FreeTierBanner isHosted={false} />);
    expect(screen.queryByText(/Free plan/)).not.toBeInTheDocument();
  });

  it('renders nothing above the free tier', () => {
    mockUseLicense.mockReturnValue({ tier: 'pro', isLoading: false, resolveError: null });
    render(<FreeTierBanner isHosted={false} />);
    expect(screen.queryByText(/Free plan/)).not.toBeInTheDocument();
  });

  it('hosted deploy: links the Stripe trial CTA at /account/billing', () => {
    render(<FreeTierBanner isHosted={true} />);
    const link = screen.getByText(/Start your 7-day Pro trial/);
    expect(link).toHaveAttribute('href', '/account/billing?upgrade=pro');
    expect(screen.queryByText(/Unlock Pro with a license/)).not.toBeInTheDocument();
  });

  it('self-host deploy: links the license CTA at the vendor pricing page, opened safely', () => {
    render(<FreeTierBanner isHosted={false} />);
    const link = screen.getByText(/Unlock Pro with a license/);
    expect(link).toHaveAttribute('href', 'https://revealui.com/pricing');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.queryByText(/Start your 7-day Pro trial/)).not.toBeInTheDocument();
    expect(screen.queryByText(/7-day trial/)).not.toBeInTheDocument();
  });
});

it('renders nothing when tier resolution failed with auth-required (GAP-454)', () => {
  mockUseLicense.mockReturnValue({
    tier: 'free',
    isLoading: false,
    resolveError: 'auth-required',
  });
  render(<FreeTierBanner isHosted={true} />);
  expect(screen.queryByText(/Free plan/)).not.toBeInTheDocument();
});

it('renders nothing when tier resolution failed as unavailable (GAP-454)', () => {
  mockUseLicense.mockReturnValue({
    tier: 'free',
    isLoading: false,
    resolveError: 'unavailable',
  });
  render(<FreeTierBanner isHosted={true} />);
  expect(screen.queryByText(/Free plan/)).not.toBeInTheDocument();
});
