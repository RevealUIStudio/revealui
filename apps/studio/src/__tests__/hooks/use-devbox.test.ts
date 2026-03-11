import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDevBox } from '../../hooks/use-devbox';

vi.mock('../../lib/invoke', () => ({
  mountDevbox: vi.fn(),
  unmountDevbox: vi.fn(),
}));

// Import after mocking
const { mountDevbox, unmountDevbox } = await import('../../lib/invoke');

describe('useDevBox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default state', () => {
    const { result } = renderHook(() => useDevBox());

    expect(result.current.operating).toBe(false);
    expect(result.current.log).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('mounts devbox successfully', async () => {
    vi.mocked(mountDevbox).mockResolvedValueOnce('Mounted at /mnt/wsl-dev');

    const { result } = renderHook(() => useDevBox());

    await act(async () => {
      await result.current.mount();
    });

    expect(mountDevbox).toHaveBeenCalledOnce();
    expect(result.current.operating).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.log).toContain('Mounting Studio drive...');
    expect(result.current.log).toContain('Mounted at /mnt/wsl-dev');
  });

  it('handles mount error', async () => {
    vi.mocked(mountDevbox).mockRejectedValueOnce(new Error('Device not found'));

    const { result } = renderHook(() => useDevBox());

    await act(async () => {
      await result.current.mount();
    });

    expect(result.current.operating).toBe(false);
    expect(result.current.error).toBe('Device not found');
    expect(result.current.log).toContain('Error: Device not found');
  });

  it('handles mount error with non-Error thrown value', async () => {
    vi.mocked(mountDevbox).mockRejectedValueOnce('raw string error');

    const { result } = renderHook(() => useDevBox());

    await act(async () => {
      await result.current.mount();
    });

    expect(result.current.error).toBe('raw string error');
  });

  it('unmounts devbox successfully', async () => {
    vi.mocked(unmountDevbox).mockResolvedValueOnce('Unmounted');

    const { result } = renderHook(() => useDevBox());

    await act(async () => {
      await result.current.unmount();
    });

    expect(unmountDevbox).toHaveBeenCalledOnce();
    expect(result.current.operating).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.log).toContain('Unmounting Studio drive...');
    expect(result.current.log).toContain('Unmounted');
  });

  it('handles unmount error', async () => {
    vi.mocked(unmountDevbox).mockRejectedValueOnce(new Error('Busy'));

    const { result } = renderHook(() => useDevBox());

    await act(async () => {
      await result.current.unmount();
    });

    expect(result.current.operating).toBe(false);
    expect(result.current.error).toBe('Busy');
    expect(result.current.log).toContain('Error: Busy');
  });

  it('sets operating to true while mount is in progress', async () => {
    let resolveMount: (value: string) => void = () => {};
    vi.mocked(mountDevbox).mockImplementationOnce(
      () =>
        new Promise<string>((r) => {
          resolveMount = r;
        }),
    );

    const { result } = renderHook(() => useDevBox());

    let mountPromise: Promise<void>;
    act(() => {
      mountPromise = result.current.mount();
    });

    // operating should be true while pending
    expect(result.current.operating).toBe(true);

    await act(async () => {
      resolveMount('Done');
      await mountPromise!;
    });

    expect(result.current.operating).toBe(false);
  });

  it('resets log and error on each new mount', async () => {
    vi.mocked(mountDevbox).mockRejectedValueOnce(new Error('First fail'));

    const { result } = renderHook(() => useDevBox());

    await act(async () => {
      await result.current.mount();
    });

    expect(result.current.error).toBe('First fail');

    vi.mocked(mountDevbox).mockResolvedValueOnce('Success');

    await act(async () => {
      await result.current.mount();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.log).not.toContain('Error: First fail');
  });
});
