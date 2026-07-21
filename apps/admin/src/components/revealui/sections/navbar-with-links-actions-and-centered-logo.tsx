'use client';

import {
  Button,
  cn,
  IconChevronRight,
  IconClose,
  IconMenu,
  useEscapeKey,
  useFocusTrap,
  useScrollLock,
} from '@revealui/presentation';
import Link from 'next/link';
import { type ComponentProps, type ReactNode, useCallback, useRef, useState } from 'react';

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
        <IconChevronRight className="size-6" aria-hidden="true" />
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

  const closeMenu = useCallback(() => setMenuOpen(false), []);

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

            <Button
              type="button"
              appearance="ghost"
              variant="neutral"
              size="icon"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              className="size-auto rounded-full p-1.5 text-mist-950 hover:bg-mist-950/10 lg:hidden dark:text-white dark:hover:bg-white/10"
            >
              <IconMenu className="size-6" aria-hidden="true" />
            </Button>
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
              <Button
                type="button"
                appearance="ghost"
                variant="neutral"
                size="icon"
                onClick={closeMenu}
                aria-label="Close menu"
                className="size-auto rounded-full p-1.5 text-mist-950 hover:bg-mist-950/10 dark:text-white dark:hover:bg-white/10"
              >
                <IconClose className="size-6" aria-hidden="true" />
              </Button>
            </div>
            <div className="mt-6 flex flex-col gap-6">{links}</div>
            <div className="mt-8 flex flex-col gap-4">{actions}</div>
          </div>
        )}
      </nav>
    </header>
  );
}
