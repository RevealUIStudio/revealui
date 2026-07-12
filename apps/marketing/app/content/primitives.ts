// Sourced from: app/components/landing/Primitives.tsx, app/routes/ProductsPage.tsx
//   (Phase 1c, no copy changes). The two sources have different data shapes:
//   - HomePrimitive: label + body only (used by landing Primitives.tsx)
//   - ProductsPrimitive: full forYou/forAgents/together/features deep-dive (used by ProductsPage.tsx)
//   Both are canonical here. Phase 4 reconciles any copy redundancy.
// Per the internal marketing-overhaul plan §4.4.
// Agents primitive MCP count is sourced from METRICS.mcpServers
// (currently 14, per docs/MARKETING_METRICS.md §1); never hardcoded here.

import { METRICS, SITE } from './site';

// ---------------------------------------------------------------------------
// Landing (Home) primitives: compact card data
// ---------------------------------------------------------------------------

export interface HomePrimitive {
  readonly label: string;
  readonly body: string;
  readonly color: string;
  readonly iconPath: string;
}

export const HOME_PRIMITIVES_SECTION = {
  eyebrow: 'Five primitives. One login.',
  heading: "Everything a business needs. Nothing you don't.",
  body: 'People, content, offers, payments, and agents: the five things every product needs.',
  docsLink: { label: 'See the primitive reference →', href: SITE.urls.docs },
} as const;

export const HOME_PRIMITIVES: readonly HomePrimitive[] = [
  {
    label: 'People',
    body: 'Auth, sessions, RBAC + ABAC for your team.',
    color: 'emerald',
    iconPath:
      'M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z',
  },
  {
    label: 'Content',
    body: 'Headless CMS, rich text, media. Auto-exposed as MCP tools.',
    color: 'blue',
    iconPath:
      'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z',
  },
  {
    label: 'Offers',
    body: 'Catalogs, entitlements, feature flags. Gates govern agent capabilities.',
    color: 'amber',
    iconPath:
      'M20.25 7.5l-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z',
  },
  {
    label: 'Payments',
    body: 'Stripe billing, subscriptions, webhook reconciliation. x402-native agent payments.',
    color: 'cyan',
    iconPath:
      'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z',
  },
  {
    label: 'Agents',
    body: 'Agents, MCP servers, persistent memory. Bring-your-own-model with an open-weight default.',
    color: 'violet',
    iconPath:
      'M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z',
  },
] as const;

// ---------------------------------------------------------------------------
// Products page primitives: full deep-dive
// ---------------------------------------------------------------------------

export interface PrimitiveTriplet {
  readonly headline: string;
  readonly description: string;
}

export interface ProductsPrimitive {
  readonly name: string;
  readonly icon: string;
  readonly color: string;
  readonly bgColor: string;
  readonly ringColor: string;
  readonly forYou: PrimitiveTriplet;
  readonly forAgents: PrimitiveTriplet;
  readonly together: PrimitiveTriplet;
  readonly features: readonly string[];
}

export const PRODUCTS_PRIMITIVES: readonly ProductsPrimitive[] = [
  {
    name: 'People',
    icon: 'M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z',
    color: 'text-blue-600',
    bgColor: 'bg-blue-500/10',
    ringColor: 'ring-blue-500/20',
    forYou: {
      headline: 'Auth, roles, and compliance, handled',
      description:
        'Session-based auth, RBAC with 60 enforcement tests, rate limiting, brute-force protection, and GDPR compliance. No auth library decisions. No JWT debates.',
    },
    forAgents: {
      headline: 'Agents call the same identity-aware API',
      description:
        'Agents reach the runtime through the identical REST and MCP surface your app uses. Scoping what an individual agent can do through the RBAC + ABAC engine is not shipped yet.',
    },
    together: {
      headline: 'One access control engine for your team, today.',
      description:
        'RBAC + ABAC governs your human users, proven by 60 enforcement tests. Extending that same engine to scope agents individually is on our list, not yet shipped.',
    },
    features: [
      'Session-based auth (httpOnly, secure, sameSite)',
      'RBAC + ABAC policy engine',
      'Rate limiting and brute-force protection',
      'GDPR compliance framework',
      'Multi-tenant user isolation',
    ],
  },
  {
    name: 'Content',
    icon: 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z',
    color: 'text-emerald-600', // adherence-ignore: emerald-utility - apps/marketing/app/index.css:80-92 remaps emerald-* to cobalt oklch values (Cobalt v5 palette remap); renders cobalt today, zero visual change
    bgColor: 'bg-emerald-500/10', // adherence-ignore: emerald-utility - see index.css:80-92 emerald->cobalt remap; renders cobalt today, zero visual change
    ringColor: 'ring-emerald-500/20', // adherence-ignore: emerald-utility - see index.css:80-92 emerald->cobalt remap; renders cobalt today, zero visual change
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
    name: 'Offers',
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
      headline: 'Feature gates control which agent capabilities are enabled per tier',
      description:
        'Agent capabilities are gated by the same tier system that governs human features. When a customer upgrades, their agents automatically gain access to more tools and higher task limits.',
    },
    together: {
      headline: 'Revenue model governs both humans and agents.',
      description:
        'Upgrade a customer and their agents get smarter. One product catalog, one billing system, one set of feature gates, applied consistently to every user and every agent.',
    },
    features: [
      'Two pricing tracks (subscription, services). Perpetual licenses coming soon.',
      'Feature gating with tier enforcement',
      'Usage tracking and limit enforcement',
      'License key management',
      'Upgrade prompts and billing portal',
      'Agent task billing in development: unlimited during early access',
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
      headline: 'x402 protocol design: agent-native HTTP payments',
      description:
        'The x402 design routes agent payments over HTTP 402, aligned with the Coinbase / Cloudflare x402 Foundation. This is in development. See the roadmap for current status.',
    },
    together: {
      headline: 'Humans monetize. Agents transact. One billing infrastructure.',
      description:
        'Your customers pay through Stripe. Agent payments via x402 are in development. Both flows are designed to settle into the same revenue system.',
    },
    features: [
      'Stripe checkout and subscriptions',
      'Webhook handling and event processing',
      'Customer billing portal',
      'x402 agent payments (in development)',
    ],
  },
  {
    name: 'Agents',
    icon: 'M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z',
    color: 'text-violet-600',
    bgColor: 'bg-violet-500/10',
    ringColor: 'ring-violet-500/20',
    forYou: {
      headline: 'Agents on open-weight models you run yourself',
      description:
        'Agents manage content, process tasks, and coordinate workflows on open-weight models running on infrastructure you own, via Ubuntu Inference Snaps or Ollama. Add a frontier provider in one config line: opt-in, never assumed. Your own inference cost, not a per-token API tax.',
    },
    forAgents: {
      headline: 'A2A protocol, CRDT memory, and MCP servers',
      description: `Agent-to-agent communication, persistent memory with working, episodic, and vector layers, and ${METRICS.mcpServers} production MCP servers. Agents discover capabilities, remember context, and coordinate autonomously.`,
    },
    together: {
      headline: 'Build one business. Agents extend it. Neither locked to any vendor.',
      description:
        'You build on open standards. Your agents operate through the same open standards. Switch models, swap providers, self-host everything. The intelligence layer belongs to you.',
    },
    features: [
      'Open-model inference (Snaps, Ollama)',
      'CRDT-based agent memory (working + episodic + vector)',
      `${METRICS.mcpServers} production MCP servers`,
      'A2A agent-to-agent protocol',
      'Multi-agent coordination and orchestration',
    ],
  },
] as const;
