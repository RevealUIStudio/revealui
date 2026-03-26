import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContextValue } from '../../hooks/use-auth';
import { AuthContext } from '../../hooks/use-auth';
import type { SettingsContextValue } from '../../hooks/use-settings';
import { SettingsContext } from '../../hooks/use-settings';
import { useSubscription } from '../../hooks/use-subscription';
import type { SubscriptionResponse, UsageResponse } from '../../lib/billing-api';

vi.mock('../../lib/billing-api', () => ({
  fetchSubscription: vi.fn(),
  fetchUsage: vi.fn(),
}));

const { fetchSubscription, fetchUsage } = await import('../../lib/billing-api');

// ── Mock data ────────────────────────────────────────────────────────────────

const MOCK_SUBSCRIPTION: SubscriptionResponse = {
  tier: 'pro',
  status: 'active',
  expiresAt: '2027-01-01T00:00:00Z',
  licenseKey: 'LK-abc-123',
};

const MOCK_USAGE: UsageResponse = {
  used: 42,
  quota: 100,
  overage: 0,
  cycleStart: '2026-03-01T00:00:00Z',
  resetAt: '2026-04-01T00:00:00Z',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: SettingsContextValue = {
  settings: {
    theme: 'dark',
    apiUrl: 'http://localhost:3004',
    pollingIntervalMs: 30_000,
    solanaWalletAddress: '',
    solanaNetwork: 'devnet',
  },
  updateSettings: vi.fn(),
  resetSettings: vi.fn(),
};

function createAuthValue(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    step: 'authenticated',
    user: { id: '1', email: 'test@example.com', name: 'Test', role: 'admin' },
    tokenExpiresAt: '2027-01-01T00:00:00Z',
    loading: false,
    error: null,
    sendOtp: vi.fn(),
    submitOtp: vi.fn(),
    signOut: vi.fn(),
    recheck: vi.fn(),
    getToken: vi.fn().mockReturnValue('test-token'),
    ...overrides,
  };
}

function createWrapper(
  authValue: AuthContextValue,
  settingsValue: SettingsContextValue = DEFAULT_SETTINGS,
) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      SettingsContext.Provider,
      { value: settingsValue },
      createElement(AuthContext.Provider, { value: authValue }, children),
    );
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useSubscription', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.clearAllMocks();
    vi.mocked(fetchSubscription).mockResolvedValue(MOCK_SUBSCRIPTION);
    vi.mocked(fetchUsage).mockResolvedValue(MOCK_USAGE);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns null subscription and usage initially', () => {
    const auth = createAuthValue();
    const { result } = renderHook(() => useSubscription(), {
      wrapper: createWrapper(auth),
    });

    expect(result.current.subscription).toBeNull();
    expect(result.current.usage).toBeNull();
  });

  it('fetches subscription and usage when authenticated', async () => {
    const auth = createAuthValue();
    const { result } = renderHook(() => useSubscription(), {
      wrapper: createWrapper(auth),
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(fetchSubscription).toHaveBeenCalledWith('http://localhost:3004', 'test-token');
    expect(fetchUsage).toHaveBeenCalledWith('http://localhost:3004', 'test-token');
    expect(result.current.subscription).toEqual(MOCK_SUBSCRIPTION);
    expect(result.current.usage).toEqual(MOCK_USAGE);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('does not fetch when step is not authenticated', async () => {
    const auth = createAuthValue({ step: 'email' });
    const { result } = renderHook(() => useSubscription(), {
      wrapper: createWrapper(auth),
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(fetchSubscription).not.toHaveBeenCalled();
    expect(fetchUsage).not.toHaveBeenCalled();
    expect(result.current.subscription).toBeNull();
    expect(result.current.usage).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('does not fetch when step is idle', async () => {
    const auth = createAuthValue({ step: 'idle' });
    const { result } = renderHook(() => useSubscription(), {
      wrapper: createWrapper(auth),
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(fetchSubscription).not.toHaveBeenCalled();
    expect(result.current.subscription).toBeNull();
  });

  it('sets error on fetch failure', async () => {
    vi.mocked(fetchSubscription).mockRejectedValueOnce(new Error('Network timeout'));
    const auth = createAuthValue();
    const { result } = renderHook(() => useSubscription(), {
      wrapper: createWrapper(auth),
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe('Network timeout');
    expect(result.current.subscription).toBeNull();
    expect(result.current.usage).toBeNull();
  });

  it('sets generic error message for non-Error exceptions', async () => {
    vi.mocked(fetchUsage).mockRejectedValueOnce('string error');
    const auth = createAuthValue();
    const { result } = renderHook(() => useSubscription(), {
      wrapper: createWrapper(auth),
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(result.current.error).toBe('Failed to fetch billing data');
  });

  it('sets loading to true while fetching', async () => {
    const auth = createAuthValue();
    const { result } = renderHook(() => useSubscription(), {
      wrapper: createWrapper(auth),
    });

    // Loading should be true immediately after the effect fires
    expect(result.current.loading).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(result.current.loading).toBe(false);
  });

  it('refresh() triggers a re-fetch', async () => {
    const auth = createAuthValue();
    const { result } = renderHook(() => useSubscription(), {
      wrapper: createWrapper(auth),
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(fetchSubscription).toHaveBeenCalledTimes(1);
    expect(fetchUsage).toHaveBeenCalledTimes(1);

    await act(async () => {
      result.current.refresh();
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(fetchSubscription).toHaveBeenCalledTimes(2);
    expect(fetchUsage).toHaveBeenCalledTimes(2);
  });

  it('polls on the configured interval', async () => {
    const auth = createAuthValue();
    const { result } = renderHook(() => useSubscription(), {
      wrapper: createWrapper(auth),
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(result.current.loading).toBe(false);
    expect(fetchSubscription).toHaveBeenCalledTimes(1);

    // Advance past the 30s polling interval
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    expect(fetchSubscription).toHaveBeenCalledTimes(2);
    expect(fetchUsage).toHaveBeenCalledTimes(2);
  });

  it('clears interval on unmount', async () => {
    const auth = createAuthValue();
    const { result, unmount } = renderHook(() => useSubscription(), {
      wrapper: createWrapper(auth),
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(result.current.loading).toBe(false);
    unmount();

    const callCount = vi.mocked(fetchSubscription).mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(vi.mocked(fetchSubscription).mock.calls.length).toBe(callCount);
  });

  it('does not fetch when getToken returns null', async () => {
    const auth = createAuthValue({ getToken: vi.fn().mockReturnValue(null) });
    const { result } = renderHook(() => useSubscription(), {
      wrapper: createWrapper(auth),
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(fetchSubscription).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it('clears previous error on successful re-fetch', async () => {
    vi.mocked(fetchSubscription).mockRejectedValueOnce(new Error('Temporary failure'));
    const auth = createAuthValue();
    const { result } = renderHook(() => useSubscription(), {
      wrapper: createWrapper(auth),
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(result.current.error).toBe('Temporary failure');

    // Next fetch succeeds
    vi.mocked(fetchSubscription).mockResolvedValueOnce(MOCK_SUBSCRIPTION);

    await act(async () => {
      result.current.refresh();
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.subscription).toEqual(MOCK_SUBSCRIPTION);
  });
});
