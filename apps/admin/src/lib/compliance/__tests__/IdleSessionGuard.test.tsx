import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const signOut = vi.fn();

vi.mock('@revealui/auth/react', () => ({
  useSignOut: () => ({ signOut, isLoading: false, error: null }),
}));

describe('IdleSessionGuard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    signOut.mockReset();
    delete process.env.REVEALUI_COMPLIANCE_PROFILE;
    delete process.env.NEXT_PUBLIC_COMPLIANCE_PROFILE;
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('does not sign out on the standard profile', async () => {
    const { IdleSessionGuard } = await import('../IdleSessionGuard');
    render(<IdleSessionGuard />);
    await vi.advanceTimersByTimeAsync(20 * 60 * 1000);
    expect(signOut).not.toHaveBeenCalled();
  });

  it('signs out after 15 idle minutes in the HIPAA profile', async () => {
    process.env.REVEALUI_COMPLIANCE_PROFILE = 'hipaa';
    vi.resetModules();
    const { IdleSessionGuard } = await import('../IdleSessionGuard');
    render(<IdleSessionGuard />);
    await vi.advanceTimersByTimeAsync(15 * 60 * 1000 + 16_000);
    expect(signOut).toHaveBeenCalled();
  });
});
