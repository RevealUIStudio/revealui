import { Footer } from '../components/Footer';

interface McpServer {
  name: string;
  description: string;
  category: string;
  status: 'live' | 'planned';
}

const mcpServers: McpServer[] = [
  {
    name: 'Stripe',
    description: 'Manage products, prices, subscriptions, and payment intents through MCP.',
    category: 'Payments',
    status: 'live',
  },
  {
    name: 'RevealUI Stripe',
    description:
      'RevealUI-specific Stripe operations: billing portal, webhook management, tier enforcement.',
    category: 'Payments',
    status: 'live',
  },
  {
    name: 'Neon',
    description: 'Query and manage Neon PostgreSQL databases: branches, roles, and SQL execution.',
    category: 'Database',
    status: 'live',
  },
  {
    name: 'Supabase',
    description: 'Interact with Supabase for vector storage, auth, and real-time subscriptions.',
    category: 'Database',
    status: 'live',
  },
  {
    name: 'Vercel',
    description: 'Deploy, manage environment variables, inspect deployments, and view logs.',
    category: 'Infrastructure',
    status: 'live',
  },
  {
    name: 'Playwright',
    description: 'Run browser automation, take screenshots, and execute end-to-end test flows.',
    category: 'Testing',
    status: 'live',
  },
  {
    name: 'Next.js DevTools',
    description: 'Inspect routes, middleware, server components, and build output in development.',
    category: 'Development',
    status: 'live',
  },
  {
    name: 'RevealUI Content',
    description: 'Create, query, and manage collections and documents through the content API.',
    category: 'Content',
    status: 'live',
  },
  {
    name: 'RevealUI Email',
    description: 'Send transactional emails, manage templates, and track delivery status.',
    category: 'Communication',
    status: 'live',
  },
  {
    name: 'Code Validator',
    description: 'Validate TypeScript, lint with Biome, and run type checks on code snippets.',
    category: 'Development',
    status: 'live',
  },
  {
    name: 'RevealUI Memory',
    description:
      'Read and write the agent memory store (episodic, semantic, and procedural layers).',
    category: 'Content',
    status: 'live',
  },
  {
    name: 'Contracts',
    description: 'Validate pricing contracts, check OpenAPI mirror drift, and inspect schema.',
    category: 'Development',
    status: 'live',
  },
];

const categoryColors: Record<string, string> = {
  Payments: 'bg-amber-100 text-amber-700',
  Database: 'bg-blue-100 text-blue-700',
  Infrastructure: 'bg-purple-100 text-purple-700',
  Testing: 'bg-emerald-100 text-emerald-700',
  Development: 'bg-indigo-100 text-indigo-700',
  Content: 'bg-pink-100 text-pink-700',
  Communication: 'bg-orange-100 text-orange-700',
  AI: 'bg-violet-100 text-violet-700',
};

export function MarketplacePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-violet-50 via-white to-purple-50 px-6 py-24 sm:px-6 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
            MCP server
            <span className="block bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
              catalog
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-gray-600 sm:text-xl">
            12 first-party MCP servers, RBAC-scoped and audit-logged. Agents discover tools via MCP.
            RevealUI implements MCP natively.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a
              href="#mcp-servers"
              className="rounded-full bg-violet-100 px-4 py-1.5 text-sm font-medium text-violet-700 hover:bg-violet-200 transition-colors"
            >
              MCP Servers
            </a>
            <a
              href="#discovery"
              className="rounded-full bg-purple-100 px-4 py-1.5 text-sm font-medium text-purple-700 hover:bg-purple-200 transition-colors"
            >
              How agents discover tools
            </a>
          </div>
        </div>
      </section>

      {/* How agents discover tools */}
      <section id="discovery" className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              How agents discover and use tools
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              MCP (Model Context Protocol) is the open standard for connecting AI agents to tools
              and data sources. RevealUI implements MCP natively.
            </p>
          </div>
          <div className="mx-auto max-w-4xl grid grid-cols-1 gap-8 sm:grid-cols-3">
            {[
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
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-violet-100 text-lg font-bold text-violet-700">
                  {item.step}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MCP Servers */}
      <section id="mcp-servers" className="bg-gray-50 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-sm font-semibold tracking-wide text-violet-600 uppercase">
              Open Source
            </span>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              12 MCP Servers
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              MCP servers included with RevealUI. Each server is rate-limited, audited, and governed
              by RBAC.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mcpServers.map((server) => (
              <div
                key={server.name}
                className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-semibold text-gray-900">{server.name}</h3>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${categoryColors[server.category] ?? 'bg-gray-100 text-gray-700'}`}
                    >
                      {server.category}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                        server.status === 'live'
                          ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                          : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                      }`}
                    >
                      {server.status === 'live' && (
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      )}
                      {server.status === 'live' ? 'Live' : 'Planned'}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-gray-600">{server.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Publishing & monetization — coming soon callout */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-3xl px-6 lg:px-8">
          <div className="rounded-2xl bg-violet-50 ring-1 ring-violet-200 p-10 text-center">
            <span className="inline-block text-xs font-semibold text-violet-700 bg-violet-100 px-3 py-1 rounded-full ring-1 ring-violet-200 mb-4">
              Coming after marketplace v1
            </span>
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              Publishing and monetization
            </h2>
            <p className="mt-4 text-base text-gray-600">
              Third-party MCP server publishing, developer earnings, and marketplace discovery are
              planned for a future release. See the{' '}
              <a
                href="https://github.com/RevealUIStudio/revealui/blob/main/docs/ROADMAP.md"
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet-700 underline hover:text-violet-600"
              >
                public roadmap
              </a>{' '}
              for current status — listed under "Agent Marketplace" in the Mid-Term section.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gray-50 py-24 sm:py-32">
        <div className="mx-auto max-w-2xl px-6 text-center lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Start with the MCP server catalog
          </h2>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            12 first-party servers ship with every RevealUI install. Read the MCP docs to wire your
            agents.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="https://docs.revealui.com/mcp"
              className="rounded-md bg-violet-600 px-8 py-4 text-base font-semibold text-white shadow-sm hover:bg-violet-500 transition-colors"
            >
              MCP Documentation
            </a>
            <a
              href="/products"
              className="rounded-md bg-gray-100 px-8 py-4 text-base font-semibold text-gray-900 hover:bg-gray-200 transition-colors"
            >
              View All Products
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
