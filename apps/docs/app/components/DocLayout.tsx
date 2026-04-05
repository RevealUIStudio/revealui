import { Link, useLocation } from '@revealui/router';
import { lazy, Suspense, useEffect, useState } from 'react';

const SearchBar = lazy(async () =>
  import('./SearchBar').then((mod) => ({ default: mod.SearchBar })),
);

interface DocLayoutProps {
  children?: React.ReactNode;
}

interface NavItem {
  label: string;
  path: string;
  children?: NavItem[];
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    title: 'Getting Started',
    items: [
      { label: 'Quick Start', path: '/docs/QUICK_START' },
      { label: 'Build Your Business', path: '/docs/BUILD_YOUR_BUSINESS' },
      { label: 'Examples', path: '/docs/EXAMPLES' },
    ],
  },
  {
    title: 'Tutorials',
    items: [
      { label: 'Quick Start', path: '/guides/quick-start' },
      { label: 'Authentication', path: '/guides/authentication' },
      { label: 'Collections', path: '/guides/collections' },
      { label: 'Billing', path: '/guides/billing' },
      { label: 'Deployment', path: '/guides/deployment' },
    ],
  },
  {
    title: 'Core Guides',
    items: [
      { label: 'CMS Guide', path: '/docs/CMS_GUIDE' },
      { label: 'Authentication', path: '/docs/AUTH' },
      { label: 'Database', path: '/docs/DATABASE' },
      { label: 'CI/CD & Deployment', path: '/docs/CI_CD_GUIDE' },
      { label: 'Environment Variables', path: '/docs/ENVIRONMENT_VARIABLES_GUIDE' },
      { label: 'Testing', path: '/docs/TESTING' },
      { label: 'Troubleshooting', path: '/docs/TROUBLESHOOTING' },
    ],
  },
  {
    title: 'Architecture',
    items: [
      { label: 'System Architecture', path: '/docs/ARCHITECTURE' },
      { label: 'Performance', path: '/docs/PERFORMANCE' },
      { label: 'Standards', path: '/docs/STANDARDS' },
      { label: 'Core Stability', path: '/docs/CORE_STABILITY' },
    ],
  },
  {
    title: 'Reference',
    items: [
      { label: 'Package Reference', path: '/docs/REFERENCE' },
      { label: 'REST API', path: '/api/rest-api' },
      { label: 'Component Catalog', path: '/docs/COMPONENT_CATALOG' },
      { label: 'AI', path: '/docs/AI' },
      { label: 'Marketplace', path: '/docs/MARKETPLACE' },
    ],
  },
  {
    title: 'Showcase',
    items: [
      { label: 'Overview', path: '/showcase' },
      { label: 'Design Tokens', path: '/showcase/tokens' },
      { label: 'Accordion', path: '/showcase/accordion' },
      { label: 'Avatar', path: '/showcase/avatar' },
      { label: 'Badge', path: '/showcase/badge' },
      { label: 'Button', path: '/showcase/button' },
      { label: 'Callout', path: '/showcase/callout' },
      { label: 'Card', path: '/showcase/card' },
      { label: 'Dialog', path: '/showcase/dialog' },
      { label: 'Drawer', path: '/showcase/drawer' },
      { label: 'Input', path: '/showcase/input' },
      { label: 'Progress', path: '/showcase/progress' },
      { label: 'Stat', path: '/showcase/stat' },
      { label: 'Switch', path: '/showcase/switch' },
      { label: 'Table', path: '/showcase/table' },
      { label: 'Tabs', path: '/showcase/tabs' },
      { label: 'Toast', path: '/showcase/toast' },
      { label: 'Tooltip', path: '/showcase/tooltip' },
    ],
  },
  {
    title: 'Pro & Enterprise',
    items: [
      { label: 'Pro (AI, MCP, Inference)', path: '/docs/PRO' },
      { label: 'Forge (Enterprise)', path: '/docs/FORGE' },
      { label: 'Local-First Setup', path: '/docs/LOCAL_FIRST' },
    ],
  },
  {
    title: 'Blog',
    items: [
      { label: 'Why We Built RevealUI', path: '/docs/blog/01-why-we-built-revealui' },
      { label: 'HTTP 402 Payments', path: '/docs/blog/02-http-402-payments' },
      { label: 'Multi-Agent Coordination', path: '/docs/blog/03-multi-agent-coordination' },
      { label: 'The Air-Gap Capable Stack', path: '/docs/blog/04-local-first-ai-stack' },
      { label: 'The Five Primitives', path: '/docs/blog/05-five-primitives' },
      { label: 'Open Source & Pro', path: '/docs/blog/06-open-source-and-pro' },
      { label: 'Agent-First Future', path: '/docs/blog/07-agent-first-future' },
      { label: 'Getting Started in 10 Minutes', path: '/docs/blog/08-getting-started' },
    ],
  },
  {
    title: 'Legal',
    items: [{ label: 'Third-Party Licenses', path: '/docs/THIRD_PARTY_LICENSES' }],
  },
];

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
  const currentYear = new Date().getFullYear();
  return (
    <>
      {/* Logo */}
      <h2 className="mb-4 text-lg font-bold tracking-tight text-ink">
        <Link to="/" onClick={onNavigate} className="flex items-center gap-2 no-underline">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <title>RevealUI</title>
            <path d="M14.25 9.75 16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z" />
          </svg>
          RevealUI
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

      {/* Footer */}
      <div className="mt-auto border-t border-border pt-4">
        <a
          href="https://github.com/RevealUIStudio/revealui"
          className="flex items-center gap-2 rounded-md px-3 py-2 text-[0.8125rem] text-text-muted no-underline transition-colors hover:text-text-secondary md:py-1.5"
        >
          <svg height="16" width="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <title>GitHub</title>
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          GitHub
        </a>
        <a
          href="https://revealui.com"
          className="mt-1 flex items-center gap-2 rounded-md px-3 py-2 text-[0.8125rem] text-text-muted no-underline transition-colors hover:text-text-secondary md:py-1.5"
        >
          <svg
            height="16"
            width="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <title>Website</title>
            <circle cx="12" cy="12" r="10" />
            <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
          revealui.com
        </a>
        <div className="mt-3 border-t border-border pt-3 px-3">
          <div className="flex gap-3 text-[0.75rem] text-text-muted">
            <a
              href="https://revealui.com/privacy"
              className="no-underline transition-colors hover:text-text-secondary"
            >
              Privacy
            </a>
            <a
              href="https://revealui.com/terms"
              className="no-underline transition-colors hover:text-text-secondary"
            >
              Terms
            </a>
          </div>
          <p className="mt-1.5 text-[0.75rem] text-text-muted">
            &copy; {currentYear} RevealUI Studio
          </p>
        </div>
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

    // Format last segment as page title
    const lastSegment = segments[segments.length - 1] ?? '';
    const pageTitle = lastSegment.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
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
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 16 16"
                    fill="none"
                    className="size-3 text-text-muted"
                  >
                    <path
                      d="M6 4l4 4-4 4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
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

  // Close sidebar on route change — pathname is the intentional trigger
  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname change is what triggers this effect
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
          className="flex items-center gap-2 text-base font-bold tracking-tight text-ink no-underline"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M14.25 9.75 16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z" />
          </svg>
          RevealUI
        </Link>
        <button
          type="button"
          onClick={() => setSidebarOpen((v) => !v)}
          className="rounded-md p-2 text-text-secondary transition-colors hover:bg-accent-bg hover:text-accent"
          aria-label={sidebarOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={sidebarOpen}
        >
          {sidebarOpen ? (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          ) : (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar — desktop: sticky, mobile: off-canvas drawer */}
      <nav
        className={`fixed inset-y-0 left-0 z-40 flex w-72 shrink-0 flex-col overflow-y-auto border-r border-border bg-sidebar p-4 pb-6 transition-transform md:sticky md:top-0 md:h-screen md:w-[var(--width-sidebar)] md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarContent isHome={isHome} onNavigate={() => setSidebarOpen(false)} />
      </nav>

      {/* Main content */}
      <main className="min-w-0 flex-1 bg-surface pt-14 md:pt-0">
        <Breadcrumbs sections={sections} />
        {children}
      </main>
    </div>
  );
}
