import type { Metadata } from 'next';
import { Footer } from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Roadmap — RevealUI',
  description: 'What we have shipped and what is coming next. See the RevealUI product roadmap.',
  openGraph: {
    title: 'Roadmap — RevealUI',
    description: 'What we have shipped and what is coming next. See the RevealUI product roadmap.',
    type: 'website',
  },
};

interface Feature {
  name: string;
  description: string;
  status: string;
  category: string;
}

const shipped: Feature[] = [
  {
    name: 'Dashboard Agent Chat',
    description:
      'Interact with an AI agent directly from the admin dashboard. Create content, query data, manage collections, and automate workflows through natural language — with streaming responses, tool visibility, and conversation history.',
    status: 'Shipped',
    category: 'AI',
  },
  {
    name: 'Documentation Site',
    description:
      'Documentation site live at docs.revealui.com with quick-start guides, API reference, architecture docs, and package reference. Video walkthroughs and collection cookbook coming soon.',
    status: 'Shipped',
    category: 'Docs',
  },
  {
    name: 'Agent Credits (Track B)',
    description:
      'Pay-per-task billing for AI agent execution. Buy credit bundles that never expire and stack with your monthly subscription allowance. First 1,000 tasks/month free on every plan.',
    status: 'Available',
    category: 'Billing',
  },
];

const upcoming: Feature[] = [
  {
    name: 'RevealCoin + x402 Agent Payments',
    description:
      'Native cryptocurrency micropayments powered by RevealCoin on the Solana blockchain. Agents discover, authenticate, and pay per task via the HTTP 402 payment protocol — no accounts, no subscriptions.',
    status: 'In development',
    category: 'Payments',
  },
  {
    name: 'Perpetual Licenses (Track C)',
    description:
      'One-time purchase for lifetime access to Pro, Agency, or Forge tier features. No subscription required. Includes 1 year of priority support and updates.',
    status: 'Coming soon',
    category: 'Billing',
  },
  {
    name: 'MCP Marketplace',
    description:
      'A registry where developers publish and discover MCP servers and AI agent capabilities. 80% revenue share for developers. Discoverable via Smithery, mcpt, and the RevealUI marketplace.',
    status: 'Planned — Q3 2026',
    category: 'AI',
  },
  {
    name: 'Self-Hosted Docker Images (Forge)',
    description:
      'Official Docker images published to GitHub Container Registry for fully self-hosted deployment. Domain-locked licensing, air-gap capable.',
    status: 'Planned — Q3 2026',
    category: 'Infrastructure',
  },
  {
    name: 'Visual Builder (Foundry)',
    description:
      'A no-code visual builder for creating RevealUI sites. Drag-and-drop page building, component customization, and one-click deployment.',
    status: 'Planned — Q4 2026+',
    category: 'Product',
  },
  {
    name: 'Enterprise SSO / SAML',
    description:
      'Single sign-on via SAML for enterprise customers. Advanced audit logging, custom RBAC policy editor, and multi-region deployment support.',
    status: 'Planned — Q3 2026',
    category: 'Enterprise',
  },
];

const categoryColors: Record<string, string> = {
  payments: 'bg-amber-100 text-amber-700',
  billing: 'bg-purple-100 text-purple-700',
  ai: 'bg-violet-100 text-violet-700',
  infrastructure: 'bg-blue-100 text-blue-700',
  docs: 'bg-emerald-100 text-emerald-700',
  product: 'bg-pink-100 text-pink-700',
  enterprise: 'bg-gray-100 text-gray-700',
};

function statusBadgeClass(status: string): string {
  if (status === 'Shipped' || status === 'Available') {
    return 'text-emerald-700 bg-emerald-50 ring-emerald-200';
  }
  return 'text-amber-700 bg-amber-50 ring-amber-200';
}

function FeatureCard({ feature }: { feature: Feature }) {
  return (
    <div className="rounded-2xl bg-white p-8 shadow-lg ring-1 ring-gray-200">
      <div className="flex items-center gap-3 mb-4">
        <span
          className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${categoryColors[feature.category.toLowerCase()] ?? 'bg-gray-100 text-gray-700'}`}
        >
          {feature.category}
        </span>
        <span
          className={`text-xs font-medium px-2.5 py-0.5 rounded-full ring-1 ${statusBadgeClass(feature.status)}`}
        >
          {feature.status}
        </span>
      </div>
      <h3 className="text-lg font-bold tracking-tight text-gray-900">{feature.name}</h3>
      <p className="mt-3 text-sm leading-6 text-gray-600">{feature.description}</p>
    </div>
  );
}

export default function RoadmapPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <section className="relative overflow-hidden bg-gradient-to-br from-amber-50 via-white to-orange-50 px-6 py-24 sm:px-6 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
            Product
            <span className="block bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
              Roadmap
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-gray-600 sm:text-xl">
            What we have shipped and what we are building next. See our{' '}
            <a
              href="https://github.com/RevealUIStudio/revealui/blob/main/docs/ROADMAP.md"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-700 underline hover:text-amber-600"
            >
              public roadmap
            </a>{' '}
            for the full timeline.
          </p>
        </div>
      </section>

      {/* Recently Shipped */}
      <section className="py-16 sm:py-20 bg-gray-50">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl mb-8">
            Recently shipped
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {shipped.map((feature) => (
              <FeatureCard key={feature.name} feature={feature} />
            ))}
          </div>
        </div>
      </section>

      {/* Coming Next */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl mb-8">
            Coming next
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((feature) => (
              <FeatureCard key={feature.name} feature={feature} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gray-50 py-16">
        <div className="mx-auto max-w-4xl px-6 text-center lg:px-8">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            Want to influence what ships next?
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            We prioritize based on customer impact, product readiness, and community demand.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="https://github.com/RevealUIStudio/revealui/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md bg-gray-900 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 transition-colors"
            >
              Request a feature
            </a>
            <a
              href="https://github.com/RevealUIStudio/revealui/discussions"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md bg-white px-6 py-3 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-gray-300 hover:bg-gray-50 transition-colors"
            >
              Join the discussion
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
