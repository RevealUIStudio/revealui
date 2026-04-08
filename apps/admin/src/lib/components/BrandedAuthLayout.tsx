import { AuthLayout } from '@revealui/presentation/server';
import type React from 'react';

/**
 * CMS-specific auth layout wrapper.
 * Adds RevealUI branding (logo, tagline, learn-more link) around the auth form
 * via AuthLayout's header/footer slots.
 */
export function BrandedAuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthLayout
      header={
        <div className="flex flex-col items-center gap-2">
          {/* biome-ignore lint/performance/noImgElement: static branding image in auth layout — Next.js Image overkill for a single 48px logo */}
          <img src="/logo.webp" alt="RevealUI" width={48} height={48} className="h-12 w-12" />
          <p className="text-sm text-gray-600 dark:text-gray-400">Business OS</p>
        </div>
      }
      footer={
        <p className="text-center text-xs text-gray-600 dark:text-gray-400">
          Learn more at{' '}
          <a
            href="https://revealui.com"
            className="underline hover:text-gray-800 dark:hover:text-gray-300"
            target="_blank"
            rel="noopener noreferrer"
          >
            revealui.com
          </a>
        </p>
      }
    >
      {children}
    </AuthLayout>
  );
}
