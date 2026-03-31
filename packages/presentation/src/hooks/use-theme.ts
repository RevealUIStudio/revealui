'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'rvui-theme';
const DATA_ATTR = 'data-theme';

/** Listeners for theme changes across components */
const listeners = new Set<() => void>();

function notifyListeners(): void {
  for (const listener of listeners) {
    listener();
  }
}

/** Resolve 'system' to 'light' or 'dark' based on media query */
function resolveSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

/** Read stored preference or default to 'system' */
function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system';
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    // localStorage may be unavailable (SSR, privacy mode)
  }
  return 'system';
}

/** Apply theme to the document element */
function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  const resolved = theme === 'system' ? resolveSystemTheme() : theme;
  document.documentElement.setAttribute(DATA_ATTR, resolved);
}

/** Store and apply theme, notify all subscribers */
function setTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Ignore storage errors
  }
  applyTheme(theme);
  notifyListeners();
}

/** Get the current snapshot for useSyncExternalStore */
function getSnapshot(): Theme {
  return getStoredTheme();
}

function getServerSnapshot(): Theme {
  return 'system';
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Hook to read and set the current theme.
 *
 * Persists preference to localStorage under `rvui-theme`.
 * Applies `data-theme` attribute to the document element.
 * Supports 'light', 'dark', and 'system' (auto-detect).
 *
 * @example
 * ```tsx
 * const { theme, resolvedTheme, setTheme } = useTheme();
 * <button onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}>
 *   Toggle theme
 * </button>
 * ```
 */
export function useTheme(): {
  /** Current theme preference ('light' | 'dark' | 'system') */
  theme: Theme;
  /** Resolved theme after applying system preference ('light' | 'dark') */
  resolvedTheme: ResolvedTheme;
  /** Set theme preference */
  setTheme: (theme: Theme) => void;
} {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const resolved = theme === 'system' ? resolveSystemTheme() : theme;

  // Apply theme on mount and listen for system preference changes
  useEffect(() => {
    applyTheme(theme);

    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const handleChange = () => {
      if (getStoredTheme() === 'system') {
        applyTheme('system');
        notifyListeners();
      }
    };
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, [theme]);

  const setThemeStable = useCallback((t: Theme) => setTheme(t), []);

  return { theme, resolvedTheme: resolved, setTheme: setThemeStable };
}
