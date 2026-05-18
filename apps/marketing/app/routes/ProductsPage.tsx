import { Footer } from '../components/Footer';
import { PRODUCTS_PRIMITIVES } from '../content/primitives';
import {
  PRODUCTS_CTA_SECTION,
  PRODUCTS_PAGE_HERO,
  PRODUCTS_STATS_SECTION,
} from '../content/products';

export function ProductsPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-blue-50 px-6 py-24 sm:px-6 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
            {PRODUCTS_PAGE_HERO.h1}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-gray-600 sm:text-xl">
            {PRODUCTS_PAGE_HERO.subtitle}
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3 text-sm font-medium">
            {PRODUCTS_PRIMITIVES.map((p) => (
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
      {PRODUCTS_PRIMITIVES.map((primitive, i) => (
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
              {PRODUCTS_STATS_SECTION.heading}
            </h2>
            <p className="mt-4 text-lg text-gray-400">{PRODUCTS_STATS_SECTION.body}</p>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {PRODUCTS_STATS_SECTION.items.map((item) => (
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
            {PRODUCTS_CTA_SECTION.heading}
          </h2>
          <p className="mt-6 text-lg leading-8 text-gray-600">{PRODUCTS_CTA_SECTION.body}</p>
          <div className="mt-8 rounded-lg bg-gray-950 px-6 py-4 text-left font-mono text-sm text-gray-300">
            <span className="text-gray-500">$</span> {PRODUCTS_CTA_SECTION.cliSnippet}
          </div>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href={PRODUCTS_CTA_SECTION.cta.docs.href}
              className="rounded-md bg-blue-600 px-8 py-4 text-base font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors"
            >
              {PRODUCTS_CTA_SECTION.cta.docs.label}
            </a>
            <a
              href={PRODUCTS_CTA_SECTION.cta.pricing.href}
              className="rounded-md bg-gray-100 px-8 py-4 text-base font-semibold text-gray-900 hover:bg-gray-200 transition-colors"
            >
              {PRODUCTS_CTA_SECTION.cta.pricing.label}
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
