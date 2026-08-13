import { LinkButton, Text } from '@revealui/presentation';
import type { ReactNode } from 'react';

export function RootLayout({ children }: { children: ReactNode }): React.ReactNode {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 antialiased">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <LinkButton href="/" appearance="link" className="text-sm font-semibold tracking-tight">
            RevealUI
          </LinkButton>
          <nav className="text-sm text-gray-600">
            <Text className="text-xs uppercase tracking-wide text-gray-400">Starter (native)</Text>
          </nav>
        </div>
      </header>
      <div>{children}</div>
      <footer className="mt-16 border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <Text className="text-xs text-gray-500">
            Built with RevealUI + Vite + @revealui/router.
          </Text>
        </div>
      </footer>
    </div>
  );
}
