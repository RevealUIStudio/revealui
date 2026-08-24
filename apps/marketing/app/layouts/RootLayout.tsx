import type { ReactNode } from 'react';
import { EditModeBanner } from '../components/EditModeBanner';
import { NavBar } from '../components/NavBar';

export function RootLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <EditModeBanner />
      <NavBar />
      <main id="main-content">{children}</main>
    </>
  );
}
