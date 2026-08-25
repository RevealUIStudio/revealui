import {
  Button,
  GitHubIcon,
  IconChevronRight,
  IconClose,
  IconGlobe,
  IconMenu,
  RevealUIMark,
} from '@revealui/presentation';
import { Link, useLocation } from '@revealui/router';
import { lazy, Suspense, useEffect, useState } from 'react';
import { buildDocNavSections, type NavItem, type NavSection } from '../lib/nav';
import { showcaseEntries } from './showcase/registry.js';

const SearchBar = lazy(async () =>
  import('./SearchBar').then((mod) => ({ default: mod.SearchBar })),
);

/**
 * Per-component Showcase nav items, derived from the registry and sorted by
 * display name. Adding a showcase to `showcase/registry.ts` automatically
 * surfaces it here — no hand-maintained list to drift. The static doc sections
 * + the two stable Showcase anchors live in `../lib/nav` (React-free so the
 * link guard in `scripts/check-links.ts` can validate every doc link).
 */
const showcaseComponentItems: NavItem[] = [...showcaseEntries]
  .sort((a, b) => a.name.localeCompare(b.name))
  .map((entry) => ({ label: entry.name, path: `/showcase/${entry.slug}` }));

interface DocLayoutProps {
  children?: React.ReactNode;
}

const sections: NavSection[] = buildDocNavSections(showcaseComponentItems);

/** Untiled Circuit-R in docs chrome. Same band as marketing nav. */
const CIRCUIT_R_NAV_CLASS = 'h-[36px] w-auto text-ink';

function NavLink({
  item,
  depth = 0,
  onNavigate,
}: {
  item: NavItem;
  depth?: number;
  onNavigate?: () => void;
}) {
  const { pathname } = useLocation();
  const isActive = pathname === item.path;
  const isParentActive = item.children?.some((child) => pathname === child.path);

  return (
    <li>
      <Link
        to={item.path}
        onClick={onNavigate}
        className={`block rounded-md py-2 pr-3 text-sm transition-all md:py-1.5 ${
          isActive
            ? 'bg-accent-bg font-semibold text-accent'
            : 'font-normal text-text-secondary hover:bg-accent-bg hover:text-accent'
        }`}
        style={{ paddingLeft: `${depth * 12 + 12}px` }}
      >
        {item.label}
      </Link>
      {item.children && (isParentActive || isActive) && (
        <ul className="m-0 list-none p-0">
          {item.children.map((child) => (
            <NavLink key={child.path} item={child} depth={depth + 1} onNavigate={onNavigate} />
          ))}
        </ul>
      )}
    </li>
  );
}

function SidebarContent({ isHome, onNavigate }: { isHome: boolean; onNavigate?: () => void }) {
  return (
    <>
      {/* Logo */}
      <h2 className="mb-4 text-lg font-bold tracking-tight text-ink">
        <Link
          to="/"
          onClick={onNavigate}
          className="inline-flex items-center no-underline"
          aria-label="RevealUI"
        >
          <RevealUIMark className={CIRCUIT_R_NAV_CLASS} />
        </Link>
      </h2>

      {/* Search */}
      <div className="mb-4">
        <Suspense
          fallback={
            <div
              className="h-10 w-full rounded-lg border border-border bg-surface"
              aria-hidden="true"
            />
          }
        >
          <SearchBar />
        </Suspense>
      </div>

      {/* Home link */}
      <ul className="m-0 list-none p-0">
        <li>
          <Link
            to="/"
            onClick={onNavigate}
            className={`block rounded-md px-3 py-2 text-sm transition-all md:py-1.5 ${
              isHome
                ? 'bg-accent-bg font-semibold text-accent'
                : 'font-normal text-text-secondary hover:bg-accent-bg hover:text-accent'
            }`}
          >
            Home
          </Link>
        </li>
      </ul>

      {/* Nav sections */}
      {sections.map((section) => (
        <div key={section.title}>
          <div className="mt-4 px-3 pb-1 text-xs font-semibold uppercase tracking-widest text-text-muted">
            {section.title}
          </div>
          <ul className="m-0 list-none space-y-px p-0">
            {section.items.map((item) => (
              <NavLink key={item.path} item={item} onNavigate={onNavigate} />
            ))}
          </ul>
        </div>
      ))}

      <div className="mt-auto border-t border-border pt-4">
        <a
          href="https://github.com/RevealUIStudio/revealui"
          className="flex items-center gap-2 rounded-md px-3 py-2 text-[0.8125rem] text-text-muted no-underline transition-colors hover:text-text-secondary md:py-1.5"
        >
          <GitHubIcon className="size-4" />
          GitHub
        </a>
        <a
          href="https://revealui.com"
          className="mt-1 flex items-center gap-2 rounded-md px-3 py-2 text-[0.8125rem] text-text-muted no-underline transition-colors hover:text-text-secondary md:py-1.5"
        >
          <IconGlobe size="sm" />
          revealui.com
        </a>
      </div>
    </>
  );
}

function Breadcrumbs({ sections: navSections }: { sections: NavSection[] }) {
  const { pathname } = useLocation();
  if (pathname === '/') return null;

  const crumbs: { label: string; href?: string }[] = [{ label: 'Home', href: '/' }];

  // Find matching section and item from the nav
  for (const section of navSections) {
    for (const item of section.items) {
      if (pathname === item.path) {
        crumbs.push({ label: section.title });
        crumbs.push({ label: item.label });
        break;
      }
    }
    if (crumbs.length > 1) break;
  }

  // Fallback for sub-pages not directly in nav
  if (crumbs.length === 1) {
    const segments = pathname.split('/').filter(Boolean);
    const firstSegment = segments[0] ?? '';

    // Match section by first path segment
    for (const section of navSections) {
      const sectionMatch = section.items.some((item) => item.path.startsWith(`/${firstSegment}`));
      if (sectionMatch) {
        crumbs.push({ label: section.title, href: section.items[0]?.path });
        break;
      }
    }

    // Format last segment as page title: dashes/underscores become spaces and
    // the first character of each word is upper-cased (no authored regex).
    const lastSegment = segments[segments.length - 1] ?? '';
    const isWordChar = (c: string): boolean =>
      (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c === '_';
    let pageTitle = '';
    let atWordBoundary = true;
    for (const ch of lastSegment) {
      if (ch === '-' || ch === '_') {
        pageTitle += ' ';
        atWordBoundary = true;
      } else if (isWordChar(ch)) {
        pageTitle += atWordBoundary ? ch.toUpperCase() : ch;
        atWordBoundary = false;
      } else {
        pageTitle += ch;
        atWordBoundary = true;
      }
    }
    if (pageTitle) {
      crumbs.push({ label: pageTitle });
    }
  }

  if (crumbs.length <= 1) return null;

  return (
    <nav aria-label="Breadcrumb" className="border-b border-border px-8 py-2.5 max-md:px-4">
      <ol className="flex items-center gap-1.5 text-xs">
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: breadcrumb items are positionally ordered
            <li key={i} className="flex items-center gap-1.5">
              {isLast ? (
                <span className="font-medium text-text-secondary" aria-current="page">
                  {crumb.label}
                </span>
              ) : (
                <>
                  {crumb.href ? (
                    <Link
                      to={crumb.href}
                      className="text-text-muted no-underline transition-colors hover:text-accent"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-text-muted">{crumb.label}</span>
                  )}
                  <IconChevronRight size="xs" className="text-text-muted" />
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function DocLayout({ children }: DocLayoutProps) {
  const { pathname } = useLocation();
  const isHome = pathname === '/';
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change  -  pathname is the intentional trigger
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  return (
    <div className="flex min-h-screen font-sans">
      {/* Mobile top bar */}
      <div className="fixed top-0 right-0 left-0 z-40 flex items-center justify-between border-b border-border bg-sidebar px-4 py-3 md:hidden">
        <Link
          to="/"
          className="inline-flex items-center text-base font-bold tracking-tight text-ink no-underline"
          aria-label="RevealUI"
        >
          <RevealUIMark className={CIRCUIT_R_NAV_CLASS} />
        </Link>
        <Button
          type="button"
          appearance="ghost"
          variant="neutral"
          size="icon"
          onClick={() => setSidebarOpen((v) => !v)}
          className="text-text-secondary"
          aria-label={sidebarOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={sidebarOpen}
        >
          {sidebarOpen ? <IconClose size="md" /> : <IconMenu size="md" />}
        </Button>
      </div>

      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar  -  desktop: sticky, mobile: off-canvas drawer */}
      <nav
        className={`fixed inset-y-0 left-0 z-40 flex w-72 shrink-0 flex-col overflow-y-auto border-r border-border bg-sidebar p-4 pb-6 transition-transform md:sticky md:top-0 md:h-screen md:w-[var(--width-sidebar)] md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarContent isHome={isHome} onNavigate={() => setSidebarOpen(false)} />
      </nav>

      {/* Main content */}
      <main className="flex min-w-0 flex-1 flex-col bg-surface pt-14 md:pt-0">
        <Breadcrumbs sections={sections} />
        <div className="flex-1">{children}</div>
        <footer className="mt-auto border-t border-border px-8 py-3 text-[0.75rem] text-text-muted max-md:px-4">
          <p>
            <a
              href="https://revealui.com/privacy"
              className="no-underline transition-colors hover:text-text-secondary"
            >
              Privacy
            </a>
            {' · '}
            <a
              href="https://revealui.com/terms"
              className="no-underline transition-colors hover:text-text-secondary"
            >
              Terms
            </a>
            {' · '}
            <a
              href="https://revealui.com/cookies"
              className="no-underline transition-colors hover:text-text-secondary"
            >
              Cookies
            </a>
            {' · '}
            &copy; {new Date().getFullYear()} REVEALUI STUDIO L.L.C.
          </p>
        </footer>
      </main>
    </div>
  );
}
