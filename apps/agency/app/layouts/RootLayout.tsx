import type { ReactNode } from 'react';
import { Footer } from '../components/Footer';
import { NavBar } from '../components/NavBar';

export function RootLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <NavBar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
