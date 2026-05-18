import { Footer } from '../components/Footer';
import {
  MARKETPLACE_COMING_SOON,
  MARKETPLACE_CTA,
  MARKETPLACE_DISCOVERY_SECTION,
  MARKETPLACE_DISCOVERY_STEPS,
  MARKETPLACE_HERO,
  MARKETPLACE_HERO_NAV_ANCHORS,
  MARKETPLACE_MCP_SERVERS,
  MARKETPLACE_SERVERS_SECTION,
} from '../content/marketplace';

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
            {MARKETPLACE_HERO.subtitle}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a
              href={MARKETPLACE_HERO_NAV_ANCHORS[0].href}
              className="rounded-full bg-violet-100 px-4 py-1.5 text-sm font-medium text-violet-700 hover:bg-violet-200 transition-colors"
            >
              {MARKETPLACE_HERO_NAV_ANCHORS[0].label}
            </a>
            <a
              href={MARKETPLACE_HERO_NAV_ANCHORS[1].href}
              className="rounded-full bg-purple-100 px-4 py-1.5 text-sm font-medium text-purple-700 hover:bg-purple-200 transition-colors"
            >
              {MARKETPLACE_HERO_NAV_ANCHORS[1].label}
            </a>
          </div>
        </div>
      </section>

      {/* How agents discover tools */}
      <section id="discovery" className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              {MARKETPLACE_DISCOVERY_SECTION.title}
            </h2>
            <p className="mt-4 text-lg text-gray-600">{MARKETPLACE_DISCOVERY_SECTION.subtitle}</p>
          </div>
          <div className="mx-auto max-w-4xl grid grid-cols-1 gap-8 sm:grid-cols-3">
            {MARKETPLACE_DISCOVERY_STEPS.map((item) => (
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
              {MARKETPLACE_SERVERS_SECTION.eyebrow}
            </span>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              {MARKETPLACE_SERVERS_SECTION.heading}
            </h2>
            <p className="mt-4 text-lg text-gray-600">{MARKETPLACE_SERVERS_SECTION.body}</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MARKETPLACE_MCP_SERVERS.map((server) => (
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
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Live
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
              {MARKETPLACE_COMING_SOON.badge}
            </span>
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              {MARKETPLACE_COMING_SOON.heading}
            </h2>
            <p className="mt-4 text-base text-gray-600">
              {MARKETPLACE_COMING_SOON.body.prefix}{' '}
              <a
                href={MARKETPLACE_COMING_SOON.body.linkHref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet-700 underline hover:text-violet-600"
              >
                {MARKETPLACE_COMING_SOON.body.linkLabel}
              </a>{' '}
              {MARKETPLACE_COMING_SOON.body.suffix}
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gray-50 py-24 sm:py-32">
        <div className="mx-auto max-w-2xl px-6 text-center lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            {MARKETPLACE_CTA.heading}
          </h2>
          <p className="mt-6 text-lg leading-8 text-gray-600">{MARKETPLACE_CTA.body}</p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href={MARKETPLACE_CTA.primary.href}
              className="rounded-md bg-violet-600 px-8 py-4 text-base font-semibold text-white shadow-sm hover:bg-violet-500 transition-colors"
            >
              {MARKETPLACE_CTA.primary.label}
            </a>
            <a
              href={MARKETPLACE_CTA.secondary.href}
              className="rounded-md bg-gray-100 px-8 py-4 text-base font-semibold text-gray-900 hover:bg-gray-200 transition-colors"
            >
              {MARKETPLACE_CTA.secondary.label}
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
