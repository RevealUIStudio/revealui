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
import type React from 'react';
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react';
import { NAV_AUTH, NAV_LINKS } from '../content/nav';

const MOBILE_MENU_ID = 'marketing-mobile-menu';

/** Untiled circuit master in public chrome. Never render this file below 96px. */
const CIRCUIT_R_NAV_LIGHT_SRC = '/revealui-logo.svg';
const CIRCUIT_R_NAV_DARK_SRC = '/revealui-logo-dark.svg';
const CIRCUIT_R_NAV_PX = 96;

interface CircuitRChromeStyle extends CSSProperties {
  '--circuit-r-chrome-px': string;
}

function CircuitRNavMark(): React.JSX.Element {
  const box: CircuitRChromeStyle = {
    width: CIRCUIT_R_NAV_PX,
    height: CIRCUIT_R_NAV_PX,
    '--circuit-r-chrome-px': `${CIRCUIT_R_NAV_PX}px`,
  };
  return (
    <span data-circuit-r-chrome className="relative block shrink-0 overflow-hidden" style={box}>
      {/* biome-ignore lint/performance/noImgElement: Vite marketing chrome has no next/image; this is the Circuit-R master, not a raster. */}
      <img
        src={CIRCUIT_R_NAV_LIGHT_SRC}
        alt=""
        width={CIRCUIT_R_NAV_PX}
        height={CIRCUIT_R_NAV_PX}
        data-circuit-r-plate="light"
        className="block size-full max-w-none"
      />
      {/* biome-ignore lint/performance/noImgElement: Vite marketing chrome has no next/image; dark plate is the same letter on #060d1a. */}
      <img
        src={CIRCUIT_R_NAV_DARK_SRC}
        alt=""
        width={CIRCUIT_R_NAV_PX}
        height={CIRCUIT_R_NAV_PX}
        data-circuit-r-plate="dark"
        className="absolute inset-0 hidden size-full max-w-none"
      />
    </span>
  );
}

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
  'aria-current': ariaCurrent,
  'aria-label': ariaLabel,
}: {
  href: string;
  className?: string;
  onClick?: () => void;
  children: ReactNode;
  'aria-current'?: 'page' | undefined;
  'aria-label'?: string;
}) {
  if (href.startsWith('/')) {
    return (
      <Link
        to={href}
        className={className}
        onClick={onClick}
        aria-current={ariaCurrent}
        aria-label={ariaLabel}
      >
        {children}
      </Link>
    );
  }
  return (
    <a
      href={href}
      className={className}
      onClick={onClick}
      aria-current={ariaCurrent}
      aria-label={ariaLabel}
    >
      {children}
    </a>
  );
}

/** True when this chrome link is the current marketing route (internal paths only). */
function isNavActive(pathname: string, href: string): boolean {
  if (!href.startsWith('/')) {
    return false;
  }
  if (href === '/') {
    return pathname === '/';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

const desktopLinkClass = (active: boolean): string =>
  [
    'text-sm font-medium transition-colors',
    active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
  ].join(' ');

const mobileLinkClass = (active: boolean): string =>
  [
    'rounded-md px-3 py-3 text-sm font-medium transition-colors',
    active
      ? 'bg-muted text-foreground'
      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
  ].join(' ');

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
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
      <nav
        className="mx-auto flex h-28 max-w-7xl items-center justify-between gap-4 px-6 lg:px-8"
        aria-label="Primary"
      >
        <NavLink
          href="/"
          className="flex shrink-0 items-center"
          aria-current={pathname === '/' ? 'page' : undefined}
          aria-label="RevealUI"
        >
          <CircuitRNavMark />
        </NavLink>

        {/* Desktop links */}
        <div className="hidden items-center gap-7 lg:flex">
          {NAV_LINKS.map(({ label, href }) => {
            const active = isNavActive(pathname, href);
            return (
              <NavLink
                key={label}
                href={href}
                className={desktopLinkClass(active)}
                aria-current={active ? 'page' : undefined}
              >
                {label}
              </NavLink>
            );
          })}
          <a
            href="https://github.com/RevealUIStudio/revealui"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground transition-colors hover:text-foreground"
            aria-label="GitHub"
          >
            <span className="sr-only">GitHub</span>
            <GitHubIcon className="size-5" />
          </a>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
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
          className="relative z-50 border-t border-border bg-background px-6 py-5 lg:hidden"
        >
          <div className="flex flex-col gap-0.5">
            {NAV_LINKS.map(({ label, href }) => {
              const active = isNavActive(pathname, href);
              return (
                <NavLink
                  key={label}
                  href={href}
                  className={mobileLinkClass(active)}
                  aria-current={active ? 'page' : undefined}
                  onClick={close}
                >
                  {label}
                </NavLink>
              );
            })}
            <a
              href="https://github.com/RevealUIStudio/revealui"
              target="_blank"
              rel="noopener noreferrer"
              className={mobileLinkClass(false)}
              onClick={close}
            >
              GitHub
            </a>
          </div>
          <div className="mt-5 flex flex-col gap-2 border-t border-border pt-5">
            <NavLink href={NAV_AUTH.login.href} className={mobileLinkClass(false)} onClick={close}>
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
