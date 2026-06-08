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
        { label: 'Enterprise', path: '/forge' },
        { label: 'Local-First Setup', path: '/local-first' },
      ],
    },
    {
      title: 'RevFleet (companion products)',
      items: [{ label: 'Other RevealUI Studio products →', path: '/revfleet' }],
    },
    {
      title: 'Blog',
      items: [
        { label: 'Why We Built RevealUI', path: '/blog/01-why-we-built-revealui' },
        { label: 'HTTP 402 Payments', path: '/blog/02-http-402-payments' },
        { label: 'Multi-Agent Coordination', path: '/blog/03-multi-agent-coordination' },
        { label: 'The Air-Gap Capable Stack', path: '/blog/04-local-first-ai-stack' },
        { label: 'The Five Primitives', path: '/blog/05-five-primitives' },
        { label: 'Open Source & Pro', path: '/blog/06-open-source-and-pro' },
        { label: 'Agent-First Future', path: '/blog/07-agent-first-future' },
        { label: 'Getting Started in About 30 Minutes', path: '/blog/08-getting-started' },
        { label: '59 Components, One Dependency', path: '/blog/09-component-library' },
        { label: 'Your Database, Your Storage, Your Sync', path: '/blog/10-own-your-data' },
      ],
    },
    {
      title: 'Legal',
      items: [{ label: 'Third-Party Licenses', path: '/third-party-licenses' }],
    },
  ];
}
