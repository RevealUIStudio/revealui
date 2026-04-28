import { Footer } from '../components/Footer';

interface Primitive {
  name: string;
  icon: string;
  color: string;
  bgColor: string;
  ringColor: string;
  forYou: {
    headline: string;
    description: string;
  };
  forAgents: {
    headline: string;
    description: string;
  };
  together: {
    headline: string;
    description: string;
  };
  features: string[];
}

const primitives: Primitive[] = [
  {
    name: 'Users',
    icon: 'M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z',
    color: 'text-blue-600',
    bgColor: 'bg-blue-500/10',
    ringColor: 'ring-blue-500/20',
    forYou: {
      headline: 'Auth, roles, and compliance, handled',
      description:
        'Session-based auth, RBAC with 58 enforcement tests, rate limiting, brute-force protection, and GDPR compliance. No auth library decisions. No JWT debates.',
    },
    forAgents: {
      headline: 'RBAC governs agent access per tenant',
      description:
        'Every agent action is scoped by the same role and permission system that governs human users. Audit logs track every agent operation with full attribution.',
    },
    together: {
      headline: 'Set permissions once. Agents respect them automatically.',
      description:
        'Define your access control rules for humans. Agents inherit the same boundaries. Every action, human or machine, is attributable and auditable.',
    },
    features: [
      'Session-based auth (httpOnly, secure, sameSite)',
      'RBAC + ABAC policy engine',
      'Rate limiting and brute-force protection',
      'GDPR compliance framework',
      'Audit logging with agent attribution',
      'Multi-tenant user isolation',
    ],
  },
  {
    name: 'Content',
    icon: 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-500/10',
    ringColor: 'ring-emerald-500/20',
    forYou: {
      headline: 'Define collections in TypeScript, get an API and admin UI',
      description:
        'Rich text editing with Lexical, media management, draft/live publishing, and a full REST API with OpenAPI spec. Define your data model once and the admin dashboard and API generate automatically.',
    },
    forAgents: {
      headline: 'Collections become discoverable tools via MCP',
      description:
        'Every collection you define is automatically exposed as an MCP tool. Agents create, query, and update content through the same API humans use. No separate integration layer.',
    },
    together: {
      headline: 'Define your data model. Agents immediately operate on it.',
      description:
        'Add a collection. The admin UI, REST API, and MCP tool all appear simultaneously. No integration step between what humans see and what agents can do.',
    },
    features: [
      'Schema-first collection definitions',
      'Rich text editor with custom blocks',
      'REST API with OpenAPI spec',
      'Draft/live publishing workflow',
      'Media management and CDN delivery',
      'Real-time sync across sessions',
    ],
  },
  {
    name: 'Products',
    icon: 'M20.25 7.5l-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z',
    color: 'text-purple-600',
    bgColor: 'bg-purple-500/10',
    ringColor: 'ring-purple-500/20',
    forYou: {
      headline: 'Product catalog, pricing tiers, and usage tracking',
      description:
        'Define products, pricing tiers, and feature gates in one place. License enforcement and upgrade prompts are built in. Subscription billing via Stripe with perpetual license support.',
    },
    forAgents: {
      headline: 'Feature gates control which agent capabilities unlock per tier',
      description:
        'Agent capabilities are gated by the same tier system that governs human features. When a customer upgrades, their agents automatically gain access to more tools and higher task limits.',
    },
    together: {
      headline: 'Revenue model governs both humans and agents.',
      description:
        'Upgrade a customer and their agents get smarter. One product catalog, one billing system, one set of feature gates, applied consistently to every user and every agent.',
    },
    features: [
      'Four pricing tracks (subscription, credits, perpetual, services)',
      'Feature gating with tier enforcement',
      'Usage tracking and limit enforcement',
      'License key management',
      'Upgrade prompts and billing portal',
      'Agent task allowances per tier',
    ],
  },
  {
    name: 'Payments',
    icon: 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z',
    color: 'text-amber-600',
    bgColor: 'bg-amber-500/10',
    ringColor: 'ring-amber-500/20',
    forYou: {
      headline: 'Stripe checkout, subscriptions, and billing, pre-configured',
      description:
        'Stripe checkout, subscription management, webhooks, and a customer billing portal. Products, prices, and webhooks are wired up. You configure your Stripe keys and start charging.',
    },
    forAgents: {
      headline: 'x402 protocol enables agent-to-agent micropayments',
      description:
        'Agents pay per task via the HTTP 402 payment protocol using RevealCoin on Solana. No accounts, no subscriptions, no human intervention required for agent transactions.',
    },
    together: {
      headline: 'Humans monetize. Agents transact. One billing infrastructure.',
      description:
        'Human customers pay through Stripe. Agents pay through x402. Both flows settle into the same revenue system. One business, two payment rails.',
    },
    features: [
      'Stripe checkout and subscriptions',
      'Webhook handling and event processing',
      'Customer billing portal',
      'x402 agent-to-agent micropayments',
      'RevealCoin integration (Solana)',
      'Credit bundle purchasing',
    ],
  },
  {
    name: 'Intelligence',
    icon: 'M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z',
    color: 'text-violet-600',
    bgColor: 'bg-violet-500/10',
    ringColor: 'ring-violet-500/20',
    forYou: {
      headline: 'AI agents that work on your business, no proprietary API keys',
      description:
        'AI agents manage content, process tasks, and coordinate workflows. Runs on open models only (Apache 2.0) via Ubuntu Inference Snaps or Ollama. No vendor lock-in, no API bills.',
    },
    forAgents: {
      headline: 'A2A protocol, CRDT memory, and MCP servers',
      description:
        'Agent-to-agent communication, persistent memory with working, episodic, and vector layers, and 11 production MCP servers. Agents discover capabilities, remember context, and coordinate autonomously.',
    },
    together: {
      headline: 'Build one business. Agents extend it. Neither locked to any vendor.',
      description:
        'You build on open standards. Your agents operate through the same open standards. Switch models, swap providers, self-host everything. The intelligence layer belongs to you.',
    },
    features: [
      'Open-model inference (Snaps, Ollama)',
      'CRDT-based agent memory (working + episodic + vector)',
      '11 production MCP servers',
      'A2A agent-to-agent protocol',
      'Studio desktop app (Tauri)',
      'Multi-agent coordination and orchestration',
    ],
  },
];

export function ProductsPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-blue-50 px-6 py-24 sm:px-6 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
            Five primitives.
            <span className="block bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Built for you. Accessible to your agents.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-gray-600 sm:text-xl">
            Users, content, products, payments, and intelligence, pre-wired, open source, and ready
            to deploy. Every primitive works for human builders and AI agents alike.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3 text-sm font-medium">
            {primitives.map((p) => (
              <a
                key={p.name}
                href={`#${p.name.toLowerCase()}`}
                className={`rounded-full px-4 py-1.5 transition-colors ${p.bgColor} ${p.color} hover:opacity-80`}
              >
                {p.name}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Primitives */}
      {primitives.map((primitive, i) => (
        <section
          key={primitive.name}
          id={primitive.name.toLowerCase()}
          className={`py-24 sm:py-32 ${i % 2 === 1 ? 'bg-gray-50' : ''}`}
        >
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            {/* Section header */}
            <div className="flex items-center gap-4 mb-12">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-xl ${primitive.bgColor} ring-1 ${primitive.ringColor}`}
              >
                <svg
                  className={`h-6 w-6 ${primitive.color}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <title>{primitive.name}</title>
                  <path strokeLinecap="round" strokeLinejoin="round" d={primitive.icon} />
                </svg>
              </div>
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                {primitive.name}
              </h2>
            </div>

            {/* Three-layer cards */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* For You */}
              <div className="rounded-2xl bg-white p-8 shadow-lg ring-1 ring-gray-200">
                <div className="mb-4">
                  <span className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                    For You
                  </span>
                </div>
                <h3 className="text-lg font-bold tracking-tight text-gray-900">
                  {primitive.forYou.headline}
                </h3>
                <p className="mt-3 text-sm leading-6 text-gray-600">
                  {primitive.forYou.description}
                </p>
              </div>

              {/* For Your Agents */}
              <div className="rounded-2xl bg-white p-8 shadow-lg ring-1 ring-gray-200">
                <div className="mb-4">
                  <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                    For Your Agents
                  </span>
                </div>
                <h3 className="text-lg font-bold tracking-tight text-gray-900">
                  {primitive.forAgents.headline}
                </h3>
                <p className="mt-3 text-sm leading-6 text-gray-600">
                  {primitive.forAgents.description}
                </p>
              </div>

              {/* Together */}
              <div className="rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800 p-8 shadow-lg">
                <div className="mb-4">
                  <span className="text-xs font-semibold uppercase tracking-wide text-indigo-400">
                    Together
                  </span>
                </div>
                <h3 className="text-lg font-bold tracking-tight text-white">
                  {primitive.together.headline}
                </h3>
                <p className="mt-3 text-sm leading-6 text-gray-400">
                  {primitive.together.description}
                </p>
              </div>
            </div>

            {/* Feature list */}
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {primitive.features.map((feature) => (
                <div
                  key={feature}
                  className="flex items-start gap-2 rounded-lg bg-white px-3 py-2 text-sm text-gray-700 ring-1 ring-gray-100"
                >
                  <svg
                    className={`mt-0.5 h-4 w-4 shrink-0 ${primitive.color}`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <title>Included</title>
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}

      {/* Stats */}
      <section className="bg-gray-950 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Built to production standards
            </h2>
            <p className="mt-4 text-lg text-gray-400">
              Not a starter template. A complete runtime with tested, documented, and audited code.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {[
              { stat: '57', label: 'UI components' },
              { stat: '81', label: 'Database tables' },
              { stat: '20,000+', label: 'Tests' },
              { stat: '11', label: 'MCP servers' },
            ].map((item) => (
              <div key={item.label} className="text-center">
                <p className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
                  {item.stat}
                </p>
                <p className="mt-2 text-sm text-gray-400">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-2xl px-6 text-center lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Start building with all five primitives
          </h2>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            One command. Full source code. Users, content, products, payments, and intelligence -
            pre-wired and ready for your first deploy.
          </p>
          <div className="mt-8 rounded-lg bg-gray-950 px-6 py-4 text-left font-mono text-sm text-gray-300">
            <span className="text-gray-500">$</span> npx create-revealui my-app
          </div>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="https://docs.revealui.com"
              className="rounded-md bg-blue-600 px-8 py-4 text-base font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors"
            >
              Read the Docs
            </a>
            <a
              href="/pricing"
              className="rounded-md bg-gray-100 px-8 py-4 text-base font-semibold text-gray-900 hover:bg-gray-200 transition-colors"
            >
              View Pricing
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
