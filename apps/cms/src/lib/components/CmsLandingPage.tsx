import { SUBSCRIPTION_TIERS } from '@revealui/contracts/pricing'
import { PricingTable } from '@revealui/presentation/server'

const features = [
  {
    title: 'Collections',
    description: 'Define any content type with typed fields, validation, and access control.',
    icon: CollectionIcon,
  },
  {
    title: 'Rich Text Editor',
    description: 'Lexical-powered editor with blocks, embeds, and real-time collaboration.',
    icon: EditorIcon,
  },
  {
    title: 'Media Management',
    description: 'Upload, organize, and serve images, documents, and files with CDN delivery.',
    icon: MediaIcon,
  },
  {
    title: 'REST API',
    description: 'Auto-generated OpenAPI endpoints for every collection. Query, filter, paginate.',
    icon: ApiIcon,
  },
  {
    title: 'Authentication',
    description: 'Session-based auth with RBAC, rate limiting, and brute force protection.',
    icon: AuthIcon,
  },
  {
    title: 'Real-time Sync',
    description: 'ElectricSQL-powered sync with offline support and conflict resolution.',
    icon: SyncIcon,
  },
]

const proFeatures = [
  { name: 'AI Agents', tier: 'Pro' },
  { name: 'Built-in Payments', tier: 'Pro' },
  { name: 'MCP Servers', tier: 'Pro' },
  { name: 'AI Memory', tier: 'Max' },
  { name: 'Multi-provider AI', tier: 'Max' },
  { name: 'SSO/SAML', tier: 'Forge' },
]

// Show only free and pro for the compact CTA
const compactTiers = SUBSCRIPTION_TIERS.filter((t) => t.id === 'free' || t.id === 'pro')

export function CmsLandingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      {/* Hero */}
      <section className="relative overflow-hidden px-6 py-24 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-5xl lg:text-6xl">
            Your business CMS is ready
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Users, content, payments, and AI — pre-wired and ready to deploy. Start building your
            business on day one, not a blank slate.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-4">
            <a
              href="/signup"
              className="rounded-md bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors"
            >
              Start Free
            </a>
            <a
              href="/login"
              className="rounded-md bg-zinc-100 px-6 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-200 transition-colors dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
            >
              Sign In
            </a>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="py-20 bg-zinc-50 dark:bg-zinc-900/50">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
              Everything you need, built in
            </h2>
            <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
              No plugins to install. No integrations to configure. Just deploy.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800"
              >
                <feature.icon />
                <h3 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-white">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pro Feature Callouts */}
      <section className="py-20">
        <div className="mx-auto max-w-4xl px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
              Unlock more with Pro
            </h2>
            <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
              AI agents, payments, MCP servers, and more — available on paid tiers.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {proFeatures.map((f) => (
              <div
                key={f.name}
                className="flex items-center gap-3 rounded-lg bg-zinc-50 p-4 dark:bg-zinc-900"
              >
                <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                  {f.tier}
                </span>
                <span className="text-sm font-medium text-zinc-900 dark:text-white">{f.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Compact Pricing */}
      <section className="py-20 bg-zinc-50 dark:bg-zinc-900/50">
        <div className="mx-auto max-w-3xl px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
              Start free, upgrade anytime
            </h2>
          </div>
          <PricingTable tiers={compactTiers} compact />
          <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
            <a
              href="https://revealui.com/pricing"
              className="font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              View all plans and pricing
            </a>
          </p>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-16 text-center">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Open-source business infrastructure for software companies.
        </p>
      </section>
    </div>
  )
}

// =============================================================================
// Inline Icons (simple SVGs — no external icon library)
// =============================================================================

function CollectionIcon() {
  return (
    <svg
      className="h-8 w-8 text-blue-600"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 7.125C2.25 6.504 2.754 6 3.375 6h6c.621 0 1.125.504 1.125 1.125v3.75c0 .621-.504 1.125-1.125 1.125h-6A1.125 1.125 0 012.25 10.875v-3.75zM14.25 8.625c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v8.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-8.25zM3.75 16.125c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-2.25z"
      />
    </svg>
  )
}

function EditorIcon() {
  return (
    <svg
      className="h-8 w-8 text-blue-600"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
      />
    </svg>
  )
}

function MediaIcon() {
  return (
    <svg
      className="h-8 w-8 text-blue-600"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
      />
    </svg>
  )
}

function ApiIcon() {
  return (
    <svg
      className="h-8 w-8 text-blue-600"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"
      />
    </svg>
  )
}

function AuthIcon() {
  return (
    <svg
      className="h-8 w-8 text-blue-600"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
      />
    </svg>
  )
}

function SyncIcon() {
  return (
    <svg
      className="h-8 w-8 text-blue-600"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
      />
    </svg>
  )
}
