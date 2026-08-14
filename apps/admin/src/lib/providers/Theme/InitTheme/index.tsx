import { THEME_BOOTSTRAP_SCRIPT } from '@revealui/presentation/server';
import Script from 'next/script';

export const InitTheme = ({ nonce }: { nonce?: string }) => {
  return (
    <Script
      nonce={nonce}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: inline theme init required before paint
      dangerouslySetInnerHTML={{
        __html: THEME_BOOTSTRAP_SCRIPT,
      }}
      id="theme-script"
      strategy="beforeInteractive"
    />
  );
};
