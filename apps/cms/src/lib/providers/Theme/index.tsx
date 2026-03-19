'use client';

import type React from 'react';
import { createContext, use, useEffect, useState } from 'react';
import { canUseDOM } from '@/lib/utilities/canUseDOM';
import type { Theme, ThemeContextType } from './types';

const initialContext: ThemeContextType = {
  setTheme: () => null,
  theme: undefined,
};

const ThemeContext = createContext(initialContext);

export function ThemeProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [theme, setThemeState] = useState<Theme | undefined>(
    canUseDOM ? (document.documentElement.getAttribute('data-theme') as Theme) : undefined,
  );

  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');

    const apply = (dark: boolean) => {
      const next: Theme = dark ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      setThemeState(next);
    };

    apply(mql.matches);

    const handler = (e: MediaQueryListEvent) => apply(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return (
    <ThemeContext.Provider value={{ setTheme: () => null, theme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = (): ThemeContextType => use(ThemeContext);
