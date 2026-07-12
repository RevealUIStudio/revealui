// PRESERVED SEED DATA — revmarket extraction
// This MCP-server catalog is preserved as the seed for the future `revmarket`
// repo's public discovery UI (per the marketplace-extraction ADR). The
// standalone marketing /marketplace page has been removed; /marketplace now
// 308-redirects to /roadmap, where RevMarket is listed as planned.
//
// Sourced from: app/routes/MarketplacePage.tsx (Phase 1 extraction).
// Phase 3 (2026-05-18) updates: bumped MCP server count to canonical 13 per
// docs/MARKETING_METRICS.md §1 (was 12 — pre-merge audit miscount; validator
// + packages/mcp/README.md + CHANGELOG 12→13 bump confirm 13). Added the
// 13th catalog entry (MCP Adapter base class + Vercel/Stripe/Neon concrete
// adapter subclasses). All numeric references now import from SITE.METRICS.

import { METRICS, SITE } from './site';
import type { Cta, SectionHeading } from './types';

export interface McpServer {
  readonly name: string;
  readonly description: string;
  readonly category: string;
}

export interface DiscoveryStep {
  readonly step: string;
  readonly title: string;
  readonly description: string;
}

export const MARKETPLACE_HERO: SectionHeading = {
  title: 'MCP server catalog',
  subtitle: `${METRICS.mcpServers} first-party MCP servers. Agents discover tools via MCP. RevealUI implements MCP natively.`,
};

export const MARKETPLACE_HERO_NAV_ANCHORS = [
  { label: 'MCP Servers', href: '#mcp-servers' },
  { label: 'How agents discover tools', href: '#discovery' },
] as const;

export const MARKETPLACE_DISCOVERY_SECTION: SectionHeading = {
  title: 'How agents discover and use tools',
  subtitle:
    'MCP (Model Context Protocol) is the open standard for connecting AI agents to tools and data sources. RevealUI implements MCP natively.',
};

export const MARKETPLACE_DISCOVERY_STEPS: readonly DiscoveryStep[] = [
  {
    step: '1',
    title: 'Discover',
    description:
      'Agents find available tools through the MCP hypervisor. Each server advertises its capabilities and required permissions.',
  },
  {
    step: '2',
    title: 'Route',
    description: 'The MCP hypervisor routes the call to the right server.',
  },
  {
    step: '3',
    title: 'Execute',
    description: 'The agent calls the tool through a standardized, typed JSON-RPC interface.',
  },
];

export const MARKETPLACE_SERVERS_SECTION = {
  eyebrow: 'Open Source',
  heading: `${METRICS.mcpServers} First-Party MCP Servers`,
  body: 'MCP servers included with RevealUI.',
} as const;

export const MARKETPLACE_MCP_SERVERS: readonly McpServer[] = [
  {
    name: 'Stripe',
    description: 'Manage products, prices, subscriptions, and payment intents through MCP.',
    category: 'Payments',
  },
  {
    name: 'RevealUI Stripe',
    description:
      'RevealUI-specific Stripe operations: billing portal, webhook management, tier enforcement.',
    category: 'Payments',
  },
  {
    name: 'Neon',
    description: 'Query and manage Neon PostgreSQL databases: branches, roles, and SQL execution.',
    category: 'Database',
  },
  {
    name: 'Supabase',
    description: 'Interact with Supabase for vector storage, auth, and real-time subscriptions.',
    category: 'Database',
  },
  {
    name: 'Vercel',
    description: 'Deploy, manage environment variables, inspect deployments, and view logs.',
    category: 'Infrastructure',
  },
  {
    name: 'Playwright',
    description: 'Run browser automation, take screenshots, and execute end-to-end test flows.',
    category: 'Testing',
  },
  {
    name: 'Next.js DevTools',
    description: 'Inspect routes, middleware, server components, and build output in development.',
    category: 'Development',
  },
  {
    name: 'RevealUI Content',
    description: 'Create, query, and manage collections and documents through the content API.',
    category: 'Content',
  },
  {
    name: 'RevealUI Email',
    description: 'Send transactional emails, manage templates, and track delivery status.',
    category: 'Communication',
  },
  {
    name: 'Code Validator',
    description: 'Validate TypeScript, lint with Biome, and run type checks on code snippets.',
    category: 'Development',
  },
  {
    name: 'RevealUI Memory',
    description:
      'Read and write the agent memory store (episodic, semantic, and procedural layers).',
    category: 'Content',
  },
  {
    name: 'Contracts',
    description: 'Validate pricing contracts, check OpenAPI mirror drift, and inspect schema.',
    category: 'Development',
  },
  {
    name: 'MCP Adapter',
    description:
      'Base class plus concrete Vercel/Stripe/Neon adapters. Standardizes the MCP server contract (error handling, idempotency, observability) across every first-party server above. Source: packages/mcp/src/servers/adapter.ts.',
    category: 'Framework',
  },
];

export const MARKETPLACE_COMING_SOON = {
  badge: 'Coming after marketplace v1',
  heading: 'Publishing and monetization',
  body: {
    prefix:
      'Third-party MCP server publishing, developer earnings, and marketplace discovery are planned for a future release. See the',
    linkLabel: 'public roadmap',
    linkHref: SITE.urls.repoRoadmap,
    suffix: 'for current status, listed under "Agent Marketplace" in the Mid-Term section.',
  },
} as const;

export const MARKETPLACE_CTA = {
  heading: 'Start with the MCP server catalog',
  body: `${METRICS.mcpServers} first-party servers ship with every RevealUI install. Read the MCP docs to wire your agents.`,
  primary: {
    label: 'MCP Documentation',
    href: SITE.urls.docsMcp,
  } satisfies Cta,
  secondary: {
    label: 'View All Products',
    href: '/products',
  } satisfies Cta,
} as const;
