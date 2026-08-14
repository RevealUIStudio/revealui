import type { Theme } from './types';

export { THEME_STORAGE_KEY as themeLocalStorageKey } from '@revealui/presentation/hooks';

export const defaultTheme = 'light';

export const getImplicitPreference = (): Theme | null => {
  const mediaQuery = '(prefers-color-scheme: dark)';
  const mql = window.matchMedia(mediaQuery);
  const hasImplicitPreference = typeof mql.matches === 'boolean';

  if (hasImplicitPreference) {
    return mql.matches ? 'dark' : 'light';
  }

  return null;
};
