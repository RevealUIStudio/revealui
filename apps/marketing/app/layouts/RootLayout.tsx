import type { ReactNode } from 'react';

/**
 * Wraps every route. NavBar will be added in Chunk 2 once it's ported from
 * the archived Next.js tree. For now this is a passthrough so the scaffold
 * builds and renders the Home placeholder cleanly.
 */
export function RootLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
