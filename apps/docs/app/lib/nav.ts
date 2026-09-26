/**
 * Static documentation navigation — plain data, no React imports.
 *
 * Kept React-free on purpose so it can be consumed by BOTH the rendered
 * sidebar (`components/DocLayout.tsx`) and the build-time link guard
 * (`scripts/check-links.ts`). The guard resolves every doc link here against
 * the served set, so a nav entry pointing at an internal-excluded or missing
 * doc fails CI instead of silently 404ing in production.
 *
 * Per-component Showcase links are derived from the showcase registry at
 * render time and injected via `buildDocNavSections`; only the two stable
 * Showcase anchors live here.
 */

export interface NavItem {
  label: string;
  path: string;
  children?: NavItem[];
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

/** Sidebar section opened when the current path matches no section. */
export const DEFAULT_OPEN_NAV_SECTION = 'Getting Started';

function itemContainsPath(item: NavItem, pathname: string): boolean {
  if (item.path === pathname) return true;
  const children = item.children;
  if (!children) return false;
  for (const child of children) {
    if (itemContainsPath(child, pathname)) return true;
  }
  return false;
}

export function sectionContainsPath(section: NavSection, pathname: string): boolean {
  for (const item of section.items) {
    if (itemContainsPath(item, pathname)) return true;
  }
  return false;
}

/**
 * Titles that should start expanded. The section that owns `pathname` wins.
 * Home and other unmatched routes open Getting Started so the sidebar is not
 * a stack of closed labels.
 */
export function initialOpenSectionTitles(navSections: NavSection[], pathname: string): string[] {
  const matched: string[] = [];
  for (const section of navSections) {
    if (sectionContainsPath(section, pathname)) matched.push(section.title);
  }
  if (matched.length > 0) return matched;
  for (const section of navSections) {
    if (section.title === DEFAULT_OPEN_NAV_SECTION) return [section.title];
  }
  return [];
}

/**
 * Build the full sidebar navigation. `showcaseItems` are the registry-derived
 * per-component entries appended after the two stable Showcase anchors;
 * callers that only need the static doc links (e.g. the link guard) pass an
 * empty array.
 */
export function buildDocNavSections(showcaseItems: NavItem[]): NavSection[] {
  return [
    {
      title: 'Getting Started',
      items: [
        { label: 'Quick Start', path: '/quick-start' },
        { label: 'Build Your Business', path: '/build-your-business' },
        { label: 'Examples', path: '/examples' },
      ],
    },
    {
      title: 'Tutorials',
      items: [
        { label: 'Authentication', path: '/guides/authentication' },
        { label: 'Collections', path: '/guides/collections' },
        { label: 'Billing', path: '/guides/billing' },
        { label: 'Deployment', path: '/guides/deployment' },
      ],
    },
    {
      title: 'Core Guides',
      items: [
        { label: 'Admin Guide', path: '/admin-guide' },
        { label: 'Authentication', path: '/auth' },
        { label: 'Database', path: '/database' },
        { label: 'Environment Variables', path: '/environment-variables-guide' },
        { label: 'Testing', path: '/testing' },
        { label: 'Troubleshooting', path: '/troubleshooting' },
      ],
    },
    {
      title: 'Architecture',
      items: [
        { label: 'System Architecture', path: '/architecture' },
        { label: 'Core Stability', path: '/core-stability' },
      ],
    },
    {
      title: 'Reference',
      items: [
        { label: 'Package Reference', path: '/reference' },
        { label: 'REST API', path: '/api/rest-api' },
        { label: 'Component Catalog', path: '/component-catalog' },
        { label: 'AI', path: '/ai' },
        { label: 'Marketplace', path: '/marketplace' },
      ],
    },
    {
      title: 'Showcase',
      items: [
        { label: 'Overview', path: '/showcase' },
        { label: 'Design Tokens', path: '/showcase/tokens' },
        ...showcaseItems,
      ],
    },
    {
      title: 'Pro & Enterprise',
      items: [
        { label: 'Pro (AI, MCP, Inference)', path: '/pro' },
        { label: 'Enterprise', path: '/enterprise' },
        { label: 'Local-First Setup', path: '/local-first' },
      ],
    },
    // nav-docs-product-2026-09-26: docs nav is product reference.
    // refuse-blog-in-docs: Blog is not a top-level docs category.
    // boundary-blog-studio-docs-ref-2026-09-26: Blog is on Studio. Docs are product reference.
    // /blog/* pages stay served until a later drop.
    {
      title: 'Legal',
      items: [{ label: 'Third-Party Licenses', path: '/third-party-licenses' }],
    },
  ];
}
