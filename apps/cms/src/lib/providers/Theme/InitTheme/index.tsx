import Script from 'next/script';

export const InitTheme = () => {
  return (
    <Script
      // biome-ignore lint/security/noDangerouslySetInnerHtml: inline theme init required before render
      dangerouslySetInnerHTML={{
        __html: `
  (function () {
    var dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  })();
  `,
      }}
      id="theme-script"
      strategy="beforeInteractive"
    />
  );
};
