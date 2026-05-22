/**
 * MCP server discovery manifest.
 *
 * Authoritative list of MCP servers exposed by this RevealUI deployment,
 * served at GET /.well-known/mcp.json so agents can enumerate available
 * tool surfaces without prior knowledge.
 *
 * Closes fleet-messaging audit N4 ("agent-native pitch ships zero agent
 * affordances") at the discovery layer; complement to the /llms.txt prose
 * layer (revealui#720) and the existing /.well-known/agent.json A2A layer.
 *
 * Source of truth: `packages/mcp/README.md` ("13 MCP Servers" — enforced
 * by `pnpm validate:claims`). This manifest mirrors that list 1:1 and
 * MUST be updated alongside any addition or removal in
 * `packages/mcp/src/servers/`.
 *
 * License model: every server is FSL-1.1-MIT (Fair Source — per @revealui/mcp's
 * package.json). The `proGated` field reflects whether the server's
 * runtime calls `checkMcpLicense()` at startup, not the source license
 * itself; the `contracts` server is the public exception
 * (see `packages/mcp/src/servers/factories/contracts.ts`).
 */

export type McpServerCategory =
  | 'introspection'
  | 'platform'
  | 'integration'
  | 'development'
  | 'helper';

export type McpServerTransport = 'stdio';

export interface McpServerEntry {
  /** Stable identifier; matches the file basename in packages/mcp/src/servers/ */
  id: string;
  /** Human-readable name as published in `packages/mcp/README.md` */
  name: string;
  /** One-line description of what this server exposes */
  description: string;
  /** Functional category for filtering / grouping */
  category: McpServerCategory;
  /** MCP transport mechanism (all first-party servers are stdio today) */
  transport: McpServerTransport;
  /** Module path for stdio invocation (matches the @revealui/mcp dist layout) */
  modulePath: string;
  /** License identifier of the server's source (matches @revealui/mcp's package.json) */
  license: 'FSL-1.1-MIT';
  /**
   * Whether the server's runtime gates on a Pro/Enterprise license check.
   * Source license is FSL-1.1-MIT (Fair Source); this reflects runtime
   * activation, not source visibility.
   */
  proGated: boolean;
  /** Whether the server requires external API credentials to function */
  requiresCredentials: boolean;
}

export interface McpDiscoveryManifest {
  /** Manifest schema version */
  version: '1.0';
  /** This deployment's platform identifier */
  platform: 'revealui';
  /** Catalog documentation URL (the @revealui/mcp README) */
  documentationUrl: string;
  /** List of MCP servers exposed by this deployment */
  servers: McpServerEntry[];
}

/**
 * Canonical list of MCP servers exposed by this RevealUI deployment.
 *
 * Order: introspection first (public + foundational), then platform
 * (first-party RevealUI integrations), then integration (third-party
 * adapters), then development tools, then helpers. Within each
 * category, alphabetical.
 */
export const MCP_SERVERS: readonly McpServerEntry[] = [
  {
    id: 'contracts',
    name: 'Contracts Introspection',
    description:
      'Read-only resources and validators for every @revealui/contracts category (entities, agents, A2A, admin, billing, pricing, RevealCoin, security, content, etc.). Public — not Pro-gated. Phase 1 of the protocol-pyramid ADR.',
    category: 'introspection',
    transport: 'stdio',
    modulePath: '@revealui/mcp/dist/servers/contracts.js',
    license: 'FSL-1.1-MIT',
    proGated: false,
    requiresCredentials: false,
  },
  {
    id: 'revealui-content',
    name: 'RevealUI Content',
    description:
      'Manage RevealUI content collections (sites, pages, posts) via MCP. Backed by Drizzle on Neon.',
    category: 'platform',
    transport: 'stdio',
    modulePath: '@revealui/mcp/dist/servers/revealui-content.js',
    license: 'FSL-1.1-MIT',
    proGated: true,
    requiresCredentials: false,
  },
  {
    id: 'revealui-email',
    name: 'RevealUI Email',
    description: 'Send transactional and marketing emails through the RevealUI mailer pipeline.',
    category: 'platform',
    transport: 'stdio',
    modulePath: '@revealui/mcp/dist/servers/revealui-email.js',
    license: 'FSL-1.1-MIT',
    proGated: true,
    requiresCredentials: true,
  },
  {
    id: 'revealui-memory',
    name: 'RevealUI Memory',
    description:
      'CRDT-backed semantic memory for agents — write, read, and search long-term context across sessions.',
    category: 'platform',
    transport: 'stdio',
    modulePath: '@revealui/mcp/dist/servers/revealui-memory.js',
    license: 'FSL-1.1-MIT',
    proGated: true,
    requiresCredentials: false,
  },
  {
    id: 'revealui-stripe',
    name: 'RevealUI Stripe',
    description:
      'RevealUI-native billing operations layered on Stripe (subscriptions, customers, invoices, dunning).',
    category: 'platform',
    transport: 'stdio',
    modulePath: '@revealui/mcp/dist/servers/revealui-stripe.js',
    license: 'FSL-1.1-MIT',
    proGated: true,
    requiresCredentials: true,
  },
  {
    id: 'neon',
    name: 'Neon',
    description: 'Neon (Postgres) database operations and SQL queries.',
    category: 'integration',
    transport: 'stdio',
    modulePath: '@revealui/mcp/dist/servers/neon.js',
    license: 'FSL-1.1-MIT',
    proGated: true,
    requiresCredentials: true,
  },
  {
    id: 'stripe',
    name: 'Stripe',
    description:
      'Direct Stripe API operations — payments, subscriptions, products, prices, webhooks.',
    category: 'integration',
    transport: 'stdio',
    modulePath: '@revealui/mcp/dist/servers/stripe.js',
    license: 'FSL-1.1-MIT',
    proGated: true,
    requiresCredentials: true,
  },
  {
    id: 'supabase',
    name: 'Supabase',
    description:
      'Supabase project management and CRUD operations. Legacy adapter retained for migrating customers; new RevealUI deployments default to Neon.',
    category: 'integration',
    transport: 'stdio',
    modulePath: '@revealui/mcp/dist/servers/supabase.js',
    license: 'FSL-1.1-MIT',
    proGated: true,
    requiresCredentials: true,
  },
  {
    id: 'vercel',
    name: 'Vercel',
    description: 'Deploy and manage Vercel projects, domains, and environment variables.',
    category: 'integration',
    transport: 'stdio',
    modulePath: '@revealui/mcp/dist/servers/vercel.js',
    license: 'FSL-1.1-MIT',
    proGated: true,
    requiresCredentials: true,
  },
  {
    id: 'code-validator',
    name: 'Code Validator',
    description:
      'Validates code patterns and prevents AI-generated technical debt before code is written.',
    category: 'development',
    transport: 'stdio',
    modulePath: '@revealui/mcp/dist/servers/code-validator.js',
    license: 'FSL-1.1-MIT',
    proGated: true,
    requiresCredentials: false,
  },
  {
    id: 'next-devtools',
    name: 'Next.js DevTools',
    description: 'Next.js 16+ runtime diagnostics and automation.',
    category: 'development',
    transport: 'stdio',
    modulePath: '@revealui/mcp/dist/servers/next-devtools.js',
    license: 'FSL-1.1-MIT',
    proGated: true,
    requiresCredentials: false,
  },
  {
    id: 'playwright',
    name: 'Playwright',
    description: 'Browser automation, end-to-end testing, and web scraping.',
    category: 'development',
    transport: 'stdio',
    modulePath: '@revealui/mcp/dist/servers/playwright.js',
    license: 'FSL-1.1-MIT',
    proGated: true,
    requiresCredentials: false,
  },
  {
    id: 'email-provider',
    name: 'Email Provider',
    description:
      'Internal helper for resolving email provider credentials and routing decisions across RevFleet.',
    category: 'helper',
    transport: 'stdio',
    modulePath: '@revealui/mcp/dist/servers/_email-provider.js',
    license: 'FSL-1.1-MIT',
    proGated: true,
    requiresCredentials: true,
  },
];

const DOC_URL = 'https://github.com/RevealUIStudio/revealui/blob/main/packages/mcp/README.md';

/**
 * Build the MCP discovery manifest for `/.well-known/mcp.json`.
 *
 * Pure function — no I/O, no side effects. Safe to call per-request;
 * callers can memoize for hot paths.
 */
export function buildMcpManifest(): McpDiscoveryManifest {
  return {
    version: '1.0',
    platform: 'revealui',
    documentationUrl: DOC_URL,
    servers: [...MCP_SERVERS],
  };
}
