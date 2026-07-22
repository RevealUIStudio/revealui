import {
  Button,
  GitHubIcon,
  IconClose,
  IconMenu,
  LinkButton,
  useClickOutside,
  useEscapeKey,
  useFocusTrap,
  useScrollLock,
} from '@revealui/presentation';
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
  const toggleRef = useRef<HTMLButtonElement>(null);
  const close = () => setOpen(false);
  const { pathname } = useLocation();

  // Use the modal primitives @revealui/presentation already ships: lock body
  // scroll, trap focus inside the open menu, and close on Escape.
  useScrollLock(open);
  useFocusTrap(menuRef, open);
  useEscapeKey(close, open);

  // Close on a tap anywhere outside the menu panel. We list both the panel and
  // the hamburger toggle so tapping the toggle to close doesn't double-fire
  // (its own onClick handles that). useClickOutside is used instead of a
  // visual `fixed` backdrop because the sticky header's `backdrop-blur` creates
  // a containing block that clips any `position: fixed` descendant to the
  // header box (which includes the in-flow menu) — so a fixed backdrop never
  // actually covers the area outside the menu.
  useClickOutside([menuRef, toggleRef], close, open);

  // Close the mobile menu after a client-side navigation (covers browser
  // back/forward, where a link's own onClick never fires).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
        <NavLink
          href="/"
          className="flex items-center gap-2 font-display text-xl font-bold tracking-tight text-foreground"
        >
          <img src="/icon-mark.svg" alt="" aria-hidden="true" className="h-[22px] w-[22px]" />
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
            <GitHubIcon className="size-5" />
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
          <Button
            ref={toggleRef}
            type="button"
            appearance="ghost"
            variant="neutral"
            size="icon"
            className="text-muted-foreground lg:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls={MOBILE_MENU_ID}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? (
              <IconClose size="md" strokeWidth={2} />
            ) : (
              <IconMenu size="md" strokeWidth={2} />
            )}
          </Button>
        </div>
      </nav>

      {/* Mobile menu. Tap-outside-to-close is handled by useClickOutside (see
          the hook call above) rather than a visual backdrop, which the sticky
          header's backdrop-blur containing block would clip. */}
      {open && (
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
      )}
    </header>
  );
}
