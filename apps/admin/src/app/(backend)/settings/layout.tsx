'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const NAV_ITEMS = [
  { href: '/settings/account', label: 'Account' },
  { href: '/settings/security', label: 'Security' },
  { href: '/settings/api-keys', label: 'API Keys' },
] as const;

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col sm:flex-row">
      {/* Mobile: horizontal tab bar */}
      <nav className="border-b border-zinc-800 bg-zinc-950 sm:hidden" aria-label="Settings">
        <div className="flex items-center gap-1 overflow-x-auto px-4">
          <Link
            href="/"
            className="shrink-0 py-3 pr-3 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
            aria-label="Back to Admin"
          >
            ←
          </Link>
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`shrink-0 border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-white text-white'
                    : 'border-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Desktop: sidebar */}
      <aside className="hidden w-56 shrink-0 border-r border-zinc-800 bg-zinc-950 sm:block">
        <div className="sticky top-0 flex flex-col gap-1 p-4">
          <Link
            href="/"
            className="mb-4 flex items-center gap-2 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
          >
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Admin
          </Link>

          <h2 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Settings
          </h2>

          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </aside>

      {/* Content */}
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
