import type { Metadata } from 'next';
import { Footer } from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Marketplace | RevealUI',
  description:
    'Agent-commerce ecosystem. Discover MCP servers, publish capabilities, and enable agent-to-agent payments with RevealCoin and the x402 protocol.',
  openGraph: {
    title: 'Marketplace | RevealUI',
    description:
      'Agent-commerce ecosystem. Discover MCP servers, publish capabilities, and enable agent-to-agent payments with RevealCoin and the x402 protocol.',
    type: 'website',
  },
};

// ---------------------------------------------------------------------------
// MCP server data
// ---------------------------------------------------------------------------

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
    name: 'Email Provider',
    description: 'Shared helper surface powering the other email-capable MCP servers.',
    category: 'Communication',
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

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function MarketplacePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-violet-50 via-white to-purple-50 px-6 py-24 sm:px-6 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
            Agent-commerce
            <span className="block bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
              ecosystem
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-gray-600 sm:text-xl">
            Agents discover tools via MCP. Developers publish capabilities. Revenue flows
            automatically through x402 micropayments and RevealCoin.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a
              href="#mcp-servers"
              className="rounded-full bg-violet-100 px-4 py-1.5 text-sm font-medium text-violet-700 hover:bg-violet-200 transition-colors"
            >
              MCP Servers
            </a>
            <a
              href="#publish"
              className="rounded-full bg-purple-100 px-4 py-1.5 text-sm font-medium text-purple-700 hover:bg-purple-200 transition-colors"
            >
              Publish
            </a>
            <a
              href="#payments"
              className="rounded-full bg-amber-100 px-4 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-200 transition-colors"
            >
              Agent Payments
            </a>
          </div>
        </div>
      </section>

      {/* How agents discover tools */}
      <section className="py-24 sm:py-32">
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
                  'Agents find available tools through the MCP hypervisor. Each server advertises its capabilities, required permissions, and pricing.',
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
              13 MCP Servers
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

      {/* Publish capabilities */}
      <section id="publish" className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                Publish your capabilities
              </h2>
              <p className="mt-4 text-lg text-gray-600">
                Build an MCP server. Publish it to the marketplace. Earn revenue every time an agent
                uses it.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="rounded-2xl bg-white p-8 shadow-lg ring-1 ring-gray-200">
                <h3 className="text-lg font-bold text-gray-900">For developers</h3>
                <ul className="mt-4 space-y-3">
                  {[
                    'Build MCP servers with the RevealUI adapter framework',
                    'Publish to the marketplace with a single command',
                    'Set your own pricing per tool call',
                    'Discoverable via Smithery, mcpt, and the RevealUI registry',
                    'Analytics dashboard for usage and revenue',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-gray-600">
                      <svg
                        className="mt-0.5 h-4 w-4 shrink-0 text-violet-500"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                        role="img"
                        aria-label="Included"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800 p-8 shadow-lg">
                <h3 className="text-lg font-bold text-white">Revenue share</h3>
                <p className="mt-4 text-5xl font-bold text-white">80/20</p>
                <p className="mt-2 text-sm text-gray-400">
                  You keep 80% of every transaction. RevealUI takes 20% for infrastructure,
                  discovery, and payment processing.
                </p>
                <div className="mt-6 rounded-lg bg-white/5 px-4 py-3 ring-1 ring-white/10">
                  <p className="text-xs text-gray-400">
                    Revenue settles daily via Stripe Connect or RevealCoin. No minimum payout
                    threshold.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Agent payments */}
      <section id="payments" className="bg-gray-950 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center mb-16">
            <span className="text-sm font-semibold tracking-wide text-amber-400 uppercase">
              Agent-Native Payments
            </span>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              x402 protocol + RevealCoin
            </h2>
            <p className="mt-4 text-lg text-gray-400">
              Agents pay per task via the HTTP 402 payment protocol. No accounts, no subscriptions -
              micropayments that settle on Solana.
            </p>
            <span className="mt-3 inline-block text-xs font-semibold text-amber-300 bg-amber-400/10 px-3 py-1 rounded-full ring-1 ring-amber-400/20">
              Coming soon
            </span>
          </div>
          <div className="mx-auto max-w-4xl grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div className="rounded-2xl bg-gray-900 ring-1 ring-white/10 p-6">
              <h3 className="text-base font-semibold text-white">HTTP 402</h3>
              <p className="mt-2 text-sm text-gray-400">
                Standard HTTP status code for payment required. Agents receive a 402 response with
                payment instructions, pay, and retry, all programmatically.
              </p>
            </div>
            <div className="rounded-2xl bg-gray-900 ring-1 ring-white/10 p-6">
              <h3 className="text-base font-semibold text-white">RevealCoin (RVUI)</h3>
              <p className="mt-2 text-sm text-gray-400">
                SPL token on Solana optimized for agent-to-agent micropayments. Sub-cent
                transactions with near-instant settlement. Subscribers get a 15% discount when
                paying with RVUI.
              </p>
            </div>
            <div className="rounded-2xl bg-gray-900 ring-1 ring-white/10 p-6">
              <h3 className="text-base font-semibold text-white">Agent Card</h3>
              <p className="mt-2 text-sm text-gray-400">
                Agents discover RevealUI via a standard Agent Card at /.well-known/agent.json.
                Capabilities, skills, and pricing are all machine-readable.
              </p>
            </div>
          </div>
          <div className="mt-10 text-center">
            <p className="text-sm text-gray-400">
              $0.001 per agent task. First 1,000 tasks/month free on every plan.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-2xl px-6 text-center lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Build for the marketplace
          </h2>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            Start with the MCP adapter framework. Publish your first server. Earn revenue from every
            agent that uses it.
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
