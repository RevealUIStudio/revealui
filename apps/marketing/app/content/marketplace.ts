// Sourced from: app/routes/MarketplacePage.tsx (Phase 1, no copy changes). Per docs/lanes/marketing-overhaul/plan.md §4.4.

import { SITE } from './site';
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
  subtitle:
    '12 first-party MCP servers, RBAC-scoped and audit-logged. Agents discover tools via MCP. RevealUI implements MCP natively.',
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
    title: 'Authenticate',
    description:
      'The agent authenticates using the same RBAC system that governs human users. Permissions are scoped per tenant and per role.',
  },
  {
    step: '3',
    title: 'Execute',
    description:
      'The agent calls the tool through a standardized JSON-RPC interface. Results are typed, validated, and logged for audit.',
  },
];

export const MARKETPLACE_SERVERS_SECTION = {
  eyebrow: 'Open Source',
  heading: '12 First-Party MCP Servers',
  body: 'MCP servers included with RevealUI. Each server is rate-limited, audited, and governed by RBAC.',
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
];

export const MARKETPLACE_COMING_SOON = {
  badge: 'Coming after marketplace v1',
  heading: 'Publishing and monetization',
  body: {
    prefix:
      'Third-party MCP server publishing, developer earnings, and marketplace discovery are planned for a future release. See the',
    linkLabel: 'public roadmap',
    linkHref: SITE.urls.repoRoadmap,
    suffix: 'for current status — listed under "Agent Marketplace" in the Mid-Term section.',
  },
} as const;

export const MARKETPLACE_CTA = {
  heading: 'Start with the MCP server catalog',
  body: '12 first-party servers ship with every RevealUI install. Read the MCP docs to wire your agents.',
  primary: {
    label: 'MCP Documentation',
    href: SITE.urls.docsMcp,
  } satisfies Cta,
  secondary: {
    label: 'View All Products',
    href: '/products',
  } satisfies Cta,
} as const;
