'use client';

import { useEscapeKey, useFocusTrap, useScrollLock } from '@revealui/presentation';
import Link from 'next/link';
import { type ComponentProps, type ReactNode, useRef, useState } from 'react';
import { cn } from '@/lib/utils/cn';

export function NavbarLink({
  children,
  href,
  className,
  ...props
}: { href: string } & Omit<ComponentProps<typeof Link>, 'href'>) {
  return (
    <Link
      href={href}
      className={cn(
        'group inline-flex items-center justify-between gap-2 text-3xl/10 font-medium text-mist-950 lg:text-sm/7 dark:text-white',
        className,
      )}
      {...props}
    >
      {children}
      <span
        className="inline-flex p-1.5 opacity-0 group-hover:opacity-100 lg:hidden"
        aria-hidden="true"
      >
        <svg
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="size-6"
        >
          <title>Navigate</title>
          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
      </span>
    </Link>
  );
}

export function NavbarLogo({
  className,
  href,
  ...props
}: { href: string } & Omit<ComponentProps<typeof Link>, 'href'>) {
  return <Link href={href} {...props} className={cn('inline-flex items-stretch', className)} />;
}

export function NavbarWithLinksActionsAndCenteredLogo({
  links,
  logo,
  actions,
  className,
  ...props
}: {
  links: ReactNode;
  logo: ReactNode;
  actions: ReactNode;
} & ComponentProps<'header'>) {
  const [menuOpen, setMenuOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const closeMenu = () => setMenuOpen(false);

  useEscapeKey(closeMenu, menuOpen);
  useScrollLock(menuOpen);
  useFocusTrap(panelRef, menuOpen);

  return (
    <header className={cn('sticky top-0 z-10 bg-mist-100 dark:bg-mist-950', className)} {...props}>
      <style>{`:root { --scroll-padding-top: 5.25rem }`}</style>
      <nav>
        <div className="mx-auto flex h-(--scroll-padding-top) max-w-7xl items-center gap-4 px-6 lg:px-10">
          <div className="flex flex-1 gap-8 max-lg:hidden">{links}</div>
          <div className="flex items-center">{logo}</div>
          <div className="flex flex-1 items-center justify-end gap-4">
            <div className="flex shrink-0 items-center gap-5 max-lg:hidden">{actions}</div>

            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              className="inline-flex rounded-full p-1.5 text-mist-950 hover:bg-mist-950/10 lg:hidden dark:text-white dark:hover:bg-white/10"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="size-6">
                <title>Open menu</title>
                <path
                  fillRule="evenodd"
                  d="M3.748 8.248a.75.75 0 0 1 .75-.75h15a.75.75 0 0 1 0 1.5h-15a.75.75 0 0 1-.75-.75ZM3.748 15.75a.75.75 0 0 1 .75-.751h15a.75.75 0 0 1 0 1.5h-15a.75.75 0 0 1-.75-.75Z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>

        {menuOpen && (
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Mobile menu"
            className="fixed inset-0 z-50 bg-mist-100 px-6 py-6 lg:px-10 dark:bg-mist-950"
          >
            <div className="flex justify-end">
              <button
                type="button"
                onClick={closeMenu}
                aria-label="Close menu"
                className="inline-flex rounded-full p-1.5 text-mist-950 hover:bg-mist-950/10 dark:text-white dark:hover:bg-white/10"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="size-6"
                >
                  <title>Close menu</title>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="mt-6 flex flex-col gap-6">{links}</div>
            <div className="mt-8 flex flex-col gap-4">{actions}</div>
          </div>
        )}
      </nav>
    </header>
  );
}
