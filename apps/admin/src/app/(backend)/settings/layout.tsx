'use client';

import { IconChevronLeft } from '@revealui/presentation/server';
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
      <nav className="border-b border-border bg-muted sm:hidden" aria-label="Settings">
        <div className="flex items-center gap-1 overflow-x-auto px-4">
          <Link
            href="/"
            className="shrink-0 py-3 pr-3 text-xs text-muted-foreground transition-colors hover:text-foreground"
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
                aria-current={isActive ? 'page' : undefined}
                className={`shrink-0 border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Desktop: sidebar */}
      <aside className="hidden w-56 shrink-0 border-r border-border bg-muted sm:block">
        <div className="sticky top-0 flex flex-col gap-1 p-4">
          <Link
            href="/"
            className="mb-4 flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <IconChevronLeft size="xs" aria-hidden="true" />
            Back to Admin
          </Link>

          <h2 className="mb-2 px-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Settings
          </h2>

          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
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
