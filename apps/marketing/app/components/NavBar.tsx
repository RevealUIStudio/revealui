import { LinkButton, useEscapeKey, useFocusTrap, useScrollLock } from '@revealui/presentation';
import { Link, useLocation } from '@revealui/router';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { NAV_AUTH, NAV_LINKS } from '../content/nav';

const MOBILE_MENU_ID = 'marketing-mobile-menu';

/**
 * Internal (relative) paths navigate client-side through @revealui/router so
 * the marketing site dogfoods its own router; absolute URLs (docs, GitHub, the
 * admin app) stay full-page anchors.
 */
function NavLink({
  href,
  className,
  onClick,
  children,
}: {
  href: string;
  className?: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  if (href.startsWith('/')) {
    return (
      <Link to={href} className={className} onClick={onClick}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  );
}

export function NavBar() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);
  const { pathname } = useLocation();

  // Use the modal primitives @revealui/presentation already ships: lock body
  // scroll, trap focus inside the open menu, and close on Escape.
  useScrollLock(open);
  useFocusTrap(menuRef, open);
  useEscapeKey(close, open);

  // Close the mobile menu after a client-side navigation (covers browser
  // back/forward, where a link's own onClick never fires).
  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is the intended re-run trigger, not read in the body
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
        <NavLink href="/" className="text-xl font-bold tracking-tight text-foreground">
          RevealUI
        </NavLink>

        {/* Desktop links */}
        <div className="hidden items-center gap-8 text-sm font-medium text-muted-foreground lg:flex">
          {NAV_LINKS.map(({ label, href }) => (
            <NavLink key={label} href={href} className="transition-colors hover:text-foreground">
              {label}
            </NavLink>
          ))}
          <a
            href="https://github.com/RevealUIStudio/revealui"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-foreground"
            aria-label="GitHub"
          >
            <span className="sr-only">GitHub</span>
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z"
                clipRule="evenodd"
              />
            </svg>
          </a>
        </div>

        <div className="flex items-center gap-3">
          <NavLink
            href={NAV_AUTH.login.href}
            className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground lg:inline-flex"
          >
            {NAV_AUTH.login.label}
          </NavLink>
          <LinkButton href={NAV_AUTH.signup.href}>{NAV_AUTH.signup.label}</LinkButton>

          {/* Hamburger - mobile only. 44x44 tap target per WCAG 2.5.5 / Apple HIG. */}
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted lg:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls={MOBILE_MENU_ID}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? (
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                />
              </svg>
            )}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {open && (
        <>
          {/* Backdrop: tap outside to close. Sits below the nav row (top-16) so
              the trigger stays interactive; kept out of the tab order. */}
          <button
            type="button"
            aria-label="Close menu"
            tabIndex={-1}
            onClick={close}
            className="fixed inset-x-0 bottom-0 top-16 z-40 bg-foreground/10 lg:hidden"
          />
          <div
            id={MOBILE_MENU_ID}
            ref={menuRef}
            className="relative z-50 border-t border-border bg-background px-6 py-4 lg:hidden"
          >
            <div className="flex flex-col gap-1">
              {NAV_LINKS.map(({ label, href }) => (
                <NavLink
                  key={label}
                  href={href}
                  className="rounded-md px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  onClick={close}
                >
                  {label}
                </NavLink>
              ))}
              <a
                href="https://github.com/RevealUIStudio/revealui"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                onClick={close}
              >
                GitHub
              </a>
            </div>
            <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
              <NavLink
                href={NAV_AUTH.login.href}
                className="rounded-md px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                onClick={close}
              >
                {NAV_AUTH.login.label}
              </NavLink>
              <LinkButton href={NAV_AUTH.signup.href} onClick={close} className="w-full">
                {NAV_AUTH.signup.label}
              </LinkButton>
            </div>
          </div>
        </>
      )}
    </header>
  );
}
