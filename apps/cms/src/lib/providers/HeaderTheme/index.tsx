'use client';

import type React from 'react';
import { createContext, use, useState } from 'react';
import type { Theme } from '@/lib/providers/Theme/types';

import { canUseDOM } from '@/lib/utilities/canUseDOM';

export interface ContextType {
  headerTheme?: Theme | null;
  setHeaderTheme: (theme: Theme | null) => void;
}

const initialContext: ContextType = {
  headerTheme: undefined,
  setHeaderTheme: () => null,
};

const HeaderThemeContext = createContext(initialContext);

export function HeaderThemeProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [headerTheme, setThemeState] = useState<Theme | undefined | null>(
    canUseDOM ? (document.documentElement.getAttribute('data-theme') as Theme) : undefined,
  );

  const setHeaderTheme = (themeToSet: Theme | null) => {
    setThemeState(themeToSet);
  };

  return (
    <HeaderThemeContext.Provider value={{ headerTheme, setHeaderTheme }}>
      {children}
    </HeaderThemeContext.Provider>
  );
}

export const useHeaderTheme = (): ContextType => use(HeaderThemeContext);
