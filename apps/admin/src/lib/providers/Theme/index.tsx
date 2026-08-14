'use client';

import {
  type Theme as Preference,
  useTheme as usePresentationTheme,
} from '@revealui/presentation/hooks';
import type React from 'react';
import { createContext, use } from 'react';
import type { Theme, ThemeContextType } from './types';

const initialContext: ThemeContextType = {
  setTheme: () => null,
  theme: undefined,
};

const ThemeContext = createContext(initialContext);

export function ThemeProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const { resolvedTheme, setTheme: setPreference } = usePresentationTheme();

  const setTheme = (next: Theme | null): void => {
    const preference: Preference = next === null ? 'system' : next;
    setPreference(preference);
  };

  return (
    <ThemeContext.Provider value={{ setTheme, theme: resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = (): ThemeContextType => use(ThemeContext);
