import Script from 'next/script';

import { defaultTheme, themeLocalStorageKey } from '../ThemeSelector/types';

export const InitTheme = () => {
  return (
    <Script
      // biome-ignore lint/security/noDangerouslySetInnerHtml: inline theme init required before render
      dangerouslySetInnerHTML={{
        // biome-ignore lint/style/useNamingConvention: __html is the required React dangerouslySetInnerHTML property name
        __html: `
  (function () {
    function getImplicitPreference() {
      var mediaQuery = '(prefers-color-scheme: dark)'
      var mql = window.matchMedia(mediaQuery)
      var hasImplicitPreference = typeof mql.matches === 'boolean'

      if (hasImplicitPreference) {
        return mql.matches ? 'dark' : 'light'
      }

      return null
    }

    function themeIsValid(theme) {
      return theme === 'light' || theme === 'dark'
    }

    var themeToSet = '${defaultTheme}'
    var preference = window.localStorage.getItem('${themeLocalStorageKey}')

    if (themeIsValid(preference)) {
      themeToSet = preference
    } else {
      var implicitPreference = getImplicitPreference()

      if (implicitPreference) {
        themeToSet = implicitPreference
      }
    }

    document.documentElement.setAttribute('data-theme', themeToSet)
  })();
  `,
      }}
      id="theme-script"
      strategy="beforeInteractive"
    />
  );
};
