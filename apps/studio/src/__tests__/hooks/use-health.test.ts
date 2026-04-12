import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useHealth } from '../../hooks/use-health';
import type { SettingsContextValue } from '../../hooks/use-settings';
import { SettingsContext } from '../../hooks/use-settings';
import type { HealthResponse } from '../../lib/health-api';

vi.mock('../../lib/health-api', () => ({
  fetchHealth: vi.fn(),
}));

const { fetchHealth } = await import('../../lib/health-api');

// ── Mock data ────────────────────────────────────────────────────────────────

const MOCK_HEALTH: HealthResponse = {
  status: 'healthy',
  timestamp: '2026-03-26T12:00:00Z',
  uptime: 86400,
  checks: [
    { name: 'database', status: 'healthy', duration: 12 },
    { name: 'cache', status: 'healthy', duration: 2 },
  ],
};

const MOCK_DEGRADED: HealthResponse = {
  status: 'degraded',
  timestamp: '2026-03-26T12:00:00Z',
  uptime: 86400,
  checks: [
    { name: 'database', status: 'healthy', duration: 12 },
    { name: 'cache', status: 'degraded', duration: 500, message: 'Slow response' },
  ],
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

function createWrapper(settingsValue: SettingsContextValue = DEFAULT_SETTINGS) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(SettingsContext.Provider, { value: settingsValue }, children);
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useHealth', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.clearAllMocks();
    vi.mocked(fetchHealth).mockResolvedValue(MOCK_HEALTH);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns loading=true initially', () => {
    const { result } = renderHook(() => useHealth(), {
      wrapper: createWrapper(),
    });

    expect(result.current.loading).toBe(true);
    expect(result.current.health).toBeNull();
  });

  it('sets health data on successful fetch', async () => {
    const { result } = renderHook(() => useHealth(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(fetchHealth).toHaveBeenCalledWith('http://localhost:3004');
    expect(result.current.health).toEqual(MOCK_HEALTH);
    expect(result.current.reachable).toBe(true);
    expect(result.current.loading).toBe(false);
  });

  it('sets reachable=false when fetchHealth returns null', async () => {
    vi.mocked(fetchHealth).mockResolvedValueOnce(null);
    const { result } = renderHook(() => useHealth(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(result.current.reachable).toBe(false);
    expect(result.current.health).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('refresh() triggers a re-poll', async () => {
    const { result } = renderHook(() => useHealth(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(fetchHealth).toHaveBeenCalledTimes(1);
    expect(result.current.loading).toBe(false);

    await act(async () => {
      result.current.refresh();
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(fetchHealth).toHaveBeenCalledTimes(2);
  });

  it('refresh() re-fetches and resolves to loaded state', async () => {
    vi.mocked(fetchHealth)
      .mockResolvedValueOnce(MOCK_HEALTH) // initial poll
      .mockResolvedValueOnce({ ...MOCK_HEALTH, status: 'degraded' as const }); // refresh poll

    const { result } = renderHook(() => useHealth(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(result.current.health?.status).toBe('healthy');

    await act(async () => {
      result.current.refresh();
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(result.current.health?.status).toBe('degraded');
    expect(result.current.loading).toBe(false);
  });

  it('polls on the configured interval', async () => {
    const { result } = renderHook(() => useHealth(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(result.current.loading).toBe(false);
    expect(fetchHealth).toHaveBeenCalledTimes(1);

    // Advance past the 30s polling interval
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    expect(fetchHealth).toHaveBeenCalledTimes(2);
  });

  it('clears interval on unmount', async () => {
    const { result, unmount } = renderHook(() => useHealth(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(result.current.loading).toBe(false);
    unmount();

    const callCount = vi.mocked(fetchHealth).mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(vi.mocked(fetchHealth).mock.calls.length).toBe(callCount);
  });

  it('handles degraded health status', async () => {
    vi.mocked(fetchHealth).mockResolvedValueOnce(MOCK_DEGRADED);
    const { result } = renderHook(() => useHealth(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(result.current.health?.status).toBe('degraded');
    expect(result.current.reachable).toBe(true);
  });

  it('recovers reachable state after a failure', async () => {
    vi.mocked(fetchHealth)
      .mockResolvedValueOnce(null) // first poll  -  unreachable
      .mockResolvedValueOnce(MOCK_HEALTH); // second poll  -  recovers

    const { result } = renderHook(() => useHealth(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(result.current.reachable).toBe(false);

    // Advance past polling interval for recovery
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    expect(result.current.reachable).toBe(true);
    expect(result.current.health).toEqual(MOCK_HEALTH);
  });

  it('uses apiUrl from settings context', async () => {
    const customSettings: SettingsContextValue = {
      ...DEFAULT_SETTINGS,
      settings: {
        ...DEFAULT_SETTINGS.settings,
        apiUrl: 'https://api.revealui.com',
      },
    };

    renderHook(() => useHealth(), {
      wrapper: createWrapper(customSettings),
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(fetchHealth).toHaveBeenCalledWith('https://api.revealui.com');
  });
});
