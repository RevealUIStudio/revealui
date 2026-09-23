import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TestModeBanner } from '../TestModeBanner';

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe('TestModeBanner', () => {
  it('shows the warning when NEXT_PUBLIC_IS_LIVE is false', () => {
    vi.stubEnv('NEXT_PUBLIC_IS_LIVE', 'false');
    vi.stubEnv('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'pk_live_example');
    render(<TestModeBanner />);
    expect(screen.getByRole('status')).toHaveTextContent('Stripe is in test mode');
  });

  it('stays hidden when NEXT_PUBLIC_IS_LIVE is true and the key is live', () => {
    vi.stubEnv('NEXT_PUBLIC_IS_LIVE', 'true');
    vi.stubEnv('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'pk_live_example');
    render(<TestModeBanner />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows the warning when a test key overrides a live flag', () => {
    vi.stubEnv('NEXT_PUBLIC_IS_LIVE', 'true');
    vi.stubEnv('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'pk_test_example');
    render(<TestModeBanner />);
    expect(screen.getByRole('status')).toHaveTextContent('Stripe is in test mode');
  });
});
