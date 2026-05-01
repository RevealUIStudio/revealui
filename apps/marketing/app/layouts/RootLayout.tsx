import type { ReactNode } from 'react';
import { NavBar } from '../components/NavBar';

export function RootLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <NavBar />
      {children}
    </>
  );
}
