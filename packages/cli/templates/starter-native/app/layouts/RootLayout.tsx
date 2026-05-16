import type { ReactNode } from 'react';

export function RootLayout({ children }: { children: ReactNode }): React.ReactNode {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 antialiased">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <a href="/" className="text-sm font-semibold tracking-tight text-gray-900">
            RevealUI
          </a>
          <nav className="text-sm text-gray-600">
            <span className="text-xs uppercase tracking-wide text-gray-400">Starter (native)</span>
          </nav>
        </div>
      </header>
      <div>{children}</div>
      <footer className="mt-16 border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-4 text-xs text-gray-500">
          Built with RevealUI + Vite + @revealui/router.
        </div>
      </footer>
    </div>
  );
}
