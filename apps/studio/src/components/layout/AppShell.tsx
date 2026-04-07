import { type ReactNode, useState } from 'react';
import { StatusContext, useStatus } from '../../hooks/use-status';
import type { Page } from '../../types';
import Sidebar from './Sidebar';
import StatusBar from './StatusBar';

interface AppShellProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  children: ReactNode;
  /** Removes padding and switches to overflow-hidden for full-bleed panels */
  padless?: boolean;
}

export default function AppShell({ currentPage, onNavigate, children, padless }: AppShellProps) {
  const status = useStatus();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function handleNavigate(page: Page): void {
    onNavigate(page);
    setSidebarOpen(false);
  }

  return (
    <StatusContext.Provider value={status}>
      <div className="flex h-screen w-screen overflow-hidden">
        {/* Mobile overlay backdrop */}
        {sidebarOpen && (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-black/50 md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          />
        )}

        {/* Sidebar: hidden on mobile, slide-in when open */}
        <div
          className={`fixed inset-y-0 left-0 z-40 transform transition-transform duration-200 ease-in-out md:static md:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <Sidebar currentPage={currentPage} onNavigate={handleNavigate} />
        </div>

        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Mobile top bar with hamburger */}
          <div className="flex items-center gap-3 border-b border-neutral-800 bg-neutral-900 px-3 py-2 md:hidden">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
              aria-label="Open menu"
            >
              <svg
                className="size-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="text-sm font-semibold text-neutral-100">RevealUI Studio</span>
          </div>

          <main className={`flex-1 ${padless ? 'overflow-hidden' : 'overflow-y-auto p-3 md:p-6'}`}>
            {children}
          </main>
          <StatusBar />
        </div>
      </div>
    </StatusContext.Provider>
  );
}
