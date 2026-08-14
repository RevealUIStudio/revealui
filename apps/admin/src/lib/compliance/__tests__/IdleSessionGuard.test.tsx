import { HIPAA_IDLE_TIMEOUT_SECONDS } from '@revealui/security';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IdleSessionGuard } from '../IdleSessionGuard';

const signOut = vi.fn();

vi.mock('@revealui/auth/react', () => ({
  useSignOut: () => ({ signOut, isLoading: false, error: null }),
}));

describe('IdleSessionGuard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    signOut.mockReset();
    process.env.REVEALUI_COMPLIANCE_PROFILE = 'hipaa';
    process.env.NEXT_PUBLIC_COMPLIANCE_PROFILE = 'hipaa';
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    delete process.env.REVEALUI_COMPLIANCE_PROFILE;
    delete process.env.NEXT_PUBLIC_COMPLIANCE_PROFILE;
  });

  it('does not sign out when the server passes a 0 timeout', async () => {
    render(<IdleSessionGuard sessionIdleTimeoutSeconds={0} />);
    await vi.advanceTimersByTimeAsync(20 * 60 * 1000);
    expect(signOut).not.toHaveBeenCalled();
  });

  it('signs out after the server-passed idle timeout', async () => {
    render(<IdleSessionGuard sessionIdleTimeoutSeconds={HIPAA_IDLE_TIMEOUT_SECONDS} />);
    await vi.advanceTimersByTimeAsync(HIPAA_IDLE_TIMEOUT_SECONDS * 1000 + 16_000);
    expect(signOut).toHaveBeenCalled();
  });

  it('does not take a timeout from process.env when the server passed 0', async () => {
    render(<IdleSessionGuard sessionIdleTimeoutSeconds={0} />);
    await vi.advanceTimersByTimeAsync(HIPAA_IDLE_TIMEOUT_SECONDS * 1000 + 16_000);
    expect(signOut).not.toHaveBeenCalled();
  });
});
