import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useConfig } from '../../hooks/use-config';
import type { StudioConfig } from '../../types';

vi.mock('../../lib/config', () => ({
  getConfig: vi.fn(),
  setConfig: vi.fn(),
}));

const { getConfig, setConfig } = await import('../../lib/config');

const MOCK_CONFIG: StudioConfig = {
  intent: null,
  setupComplete: false,
  completedSteps: [],
};

function flushPromises(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

describe('useConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getConfig).mockResolvedValue(MOCK_CONFIG);
    vi.mocked(setConfig).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads config on mount', async () => {
    const { result } = renderHook(() => useConfig());

    expect(result.current.loading).toBe(true);
    expect(result.current.config).toBeNull();

    await act(async () => {
      await flushPromises();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.config).toEqual(MOCK_CONFIG);
    expect(result.current.error).toBeNull();
  });

  it('handles getConfig error', async () => {
    vi.mocked(getConfig).mockRejectedValueOnce(new Error('Config read failed'));

    const { result } = renderHook(() => useConfig());

    await act(async () => {
      await flushPromises();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.config).toBeNull();
    expect(result.current.error).toContain('Config read failed');
  });

  it('updateConfig merges and persists changes', async () => {
    const { result } = renderHook(() => useConfig());

    await act(async () => {
      await flushPromises();
    });

    await act(async () => {
      await result.current.updateConfig({ setupComplete: true });
    });

    expect(setConfig).toHaveBeenCalledWith({
      ...MOCK_CONFIG,
      setupComplete: true,
    });
    expect(result.current.config?.setupComplete).toBe(true);
  });

  it('handles updateConfig error', async () => {
    vi.mocked(setConfig).mockRejectedValueOnce(new Error('Write failed'));

    const { result } = renderHook(() => useConfig());

    await act(async () => {
      await flushPromises();
    });

    await act(async () => {
      await result.current.updateConfig({ setupComplete: true });
    });

    expect(result.current.error).toContain('Write failed');
  });

  it('setIntent sets intent field', async () => {
    const { result } = renderHook(() => useConfig());

    await act(async () => {
      await flushPromises();
    });

    await act(async () => {
      await result.current.setIntent('deploy');
    });

    expect(setConfig).toHaveBeenCalledWith({
      ...MOCK_CONFIG,
      intent: 'deploy',
    });
    expect(result.current.config?.intent).toBe('deploy');
  });

  it('updateConfig does nothing when config is null', async () => {
    vi.mocked(getConfig).mockRejectedValueOnce(new Error('fail'));

    const { result } = renderHook(() => useConfig());

    await act(async () => {
      await flushPromises();
    });

    await act(async () => {
      await result.current.updateConfig({ setupComplete: true });
    });

    // setConfig should not have been called since config is null
    expect(setConfig).not.toHaveBeenCalled();
  });
});
