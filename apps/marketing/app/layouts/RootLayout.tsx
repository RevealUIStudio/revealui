import { SkipLink } from '@revealui/presentation';
import type { ReactNode } from 'react';
import { EditModeBanner } from '../components/EditModeBanner';
import { NavBar } from '../components/NavBar';

export function RootLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SkipLink />
      <EditModeBanner />
      <NavBar />
      <main id="main-content">{children}</main>
    </>
  );
}
