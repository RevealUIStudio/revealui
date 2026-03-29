import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTheme } from '../../hooks/use-theme.js';

describe('useTheme', () => {
  let matchMediaListeners: Array<(e: { matches: boolean }) => void>;

  beforeEach(() => {
    matchMediaListeners = [];
    localStorage.clear();

    // Default: prefers dark
    vi.stubGlobal(
      'matchMedia',
      (query: string) =>
        ({
          matches: query === '(prefers-color-scheme: light)' ? false : true,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: (_event: string, cb: (e: { matches: boolean }) => void) => {
            matchMediaListeners.push(cb);
          },
          removeEventListener: (_event: string, cb: (e: { matches: boolean }) => void) => {
            matchMediaListeners = matchMediaListeners.filter((l) => l !== cb);
          },
          dispatchEvent: vi.fn(),
        }) as unknown as MediaQueryList,
    );
  });

  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
    vi.restoreAllMocks();
  });

  it('defaults to system theme', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('system');
  });

  it('resolves system to dark when OS prefers dark', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.resolvedTheme).toBe('dark');
  });

  it('resolves system to light when OS prefers light', () => {
    vi.stubGlobal(
      'matchMedia',
      (query: string) =>
        ({
          matches: query === '(prefers-color-scheme: light)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }) as unknown as MediaQueryList,
    );

    const { result } = renderHook(() => useTheme());
    expect(result.current.resolvedTheme).toBe('light');
  });

  it('sets data-theme attribute on document root', () => {
    renderHook(() => useTheme());
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('setTheme changes to light', () => {
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setTheme('light');
    });

    expect(result.current.theme).toBe('light');
    expect(result.current.resolvedTheme).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('setTheme changes to dark', () => {
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setTheme('dark');
    });

    expect(result.current.theme).toBe('dark');
    expect(result.current.resolvedTheme).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('persists theme to localStorage', () => {
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setTheme('light');
    });

    expect(localStorage.getItem('rvui-theme')).toBe('light');
  });

  it('reads persisted theme from localStorage', () => {
    localStorage.setItem('rvui-theme', 'light');

    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');
    expect(result.current.resolvedTheme).toBe('light');
  });

  it('ignores invalid localStorage values', () => {
    localStorage.setItem('rvui-theme', 'invalid');

    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('system');
  });

  it('setTheme back to system respects OS preference', () => {
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setTheme('light');
    });
    expect(result.current.resolvedTheme).toBe('light');

    act(() => {
      result.current.setTheme('system');
    });
    expect(result.current.theme).toBe('system');
    expect(result.current.resolvedTheme).toBe('dark'); // OS prefers dark in this setup
  });

  it('syncs across multiple hook instances', () => {
    const { result: hook1 } = renderHook(() => useTheme());
    const { result: hook2 } = renderHook(() => useTheme());

    act(() => {
      hook1.current.setTheme('light');
    });

    expect(hook2.current.theme).toBe('light');
  });

  it('setTheme is stable across renders', () => {
    const { result, rerender } = renderHook(() => useTheme());
    const setTheme1 = result.current.setTheme;

    rerender();
    expect(result.current.setTheme).toBe(setTheme1);
  });
});
