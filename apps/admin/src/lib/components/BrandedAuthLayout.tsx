import { AuthLayout } from '@revealui/presentation/server';
import type React from 'react';

export function BrandedAuthLayout({ children }: { children: React.ReactNode }) {
  const name = process.env.REVEALUI_BRAND_NAME ?? process.env.REVEALUI_TENANT_NAME ?? 'RevealUI';
  const logoUrl = process.env.REVEALUI_BRAND_LOGO_URL;
  const showPoweredBy = process.env.REVEALUI_SHOW_POWERED_BY !== 'false';

  return (
    <AuthLayout
      header={
        <div className="flex flex-col items-center gap-2">
          {/* biome-ignore lint/performance/noImgElement: static branding image in auth layout  -  Next.js Image overkill for a single 48px logo */}
          <img
            src={logoUrl ?? '/logo.webp'}
            alt={name}
            width={48}
            height={48}
            className="h-12 w-12"
          />
          <p className="text-sm text-gray-600 dark:text-gray-400">{name}</p>
        </div>
      }
      footer={
        showPoweredBy ? (
          <p className="text-center text-xs text-gray-600 dark:text-gray-400">
            Built with{' '}
            <a
              href="https://revealui.com"
              className="underline hover:text-gray-800 dark:hover:text-gray-300"
              target="_blank"
              rel="noopener noreferrer"
            >
              RevealUI
            </a>
          </p>
        ) : null
      }
    >
      {children}
    </AuthLayout>
  );
}
