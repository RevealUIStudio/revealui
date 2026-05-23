import { Footer } from '../components/Footer';
import {
  PRODUCT_STATUS_STYLES,
  PRODUCTS_CTA_SECTION,
  PRODUCTS_FLAGSHIP,
  PRODUCTS_PAGE_HERO,
  PRODUCTS_SISTERS,
  PRODUCTS_STATS_SECTION,
} from '../content/products';

const ALL_PRODUCT_ANCHORS = [
  { slug: PRODUCTS_FLAGSHIP.slug, name: PRODUCTS_FLAGSHIP.name },
  ...PRODUCTS_SISTERS.map((p) => ({ slug: p.slug, name: p.name })),
] as const;

export function ProductsPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-blue-50 px-6 py-24 sm:px-6 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
            {PRODUCTS_PAGE_HERO.h1}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-gray-600 sm:text-xl">
            {PRODUCTS_PAGE_HERO.subtitle}
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-2 text-sm font-medium">
            {ALL_PRODUCT_ANCHORS.map((anchor) => (
              <a
                key={anchor.slug}
                href={`#${anchor.slug}`}
                className="rounded-full bg-white px-4 py-1.5 text-gray-700 ring-1 ring-gray-200 transition-colors hover:bg-emerald-50 hover:text-emerald-700 hover:ring-emerald-300"
              >
                {anchor.name}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Flagship — RevealUI featured card */}
      <section id={PRODUCTS_FLAGSHIP.slug} className="py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-900 p-10 shadow-2xl ring-1 ring-emerald-900/20 sm:p-14">
            <div className="absolute -right-16 -top-16 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl" />
            <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-blue-500/15 blur-3xl" />
            <div className="relative">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/30 backdrop-blur">
                    <svg
                      className="h-7 w-7 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.75}
                      stroke="currentColor"
                    >
                      <title>{PRODUCTS_FLAGSHIP.name}</title>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d={PRODUCTS_FLAGSHIP.iconPath}
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-100/90">
                      {PRODUCTS_FLAGSHIP.eyebrow}
                    </p>
                    <h2 className="mt-1 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                      {PRODUCTS_FLAGSHIP.name}
                    </h2>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <span className="rounded-full bg-white/15 px-3 py-1 text-white ring-1 ring-white/30 backdrop-blur">
                    {PRODUCTS_FLAGSHIP.status}
                  </span>
                  <span className="rounded-full bg-white/10 px-3 py-1 font-mono text-white/90 ring-1 ring-white/20">
                    {PRODUCTS_FLAGSHIP.version}
                  </span>
                </div>
              </div>

              <p className="mt-6 max-w-3xl text-xl font-medium leading-8 text-emerald-50">
                {PRODUCTS_FLAGSHIP.tagline}
              </p>
              <p className="mt-3 max-w-3xl text-base leading-7 text-emerald-100/90">
                {PRODUCTS_FLAGSHIP.body}
              </p>

              <dl className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {PRODUCTS_FLAGSHIP.facts.map((fact) => (
                  <div
                    key={fact.label}
                    className="rounded-xl bg-white/10 px-4 py-3 ring-1 ring-white/20 backdrop-blur"
                  >
                    <dt className="text-xs uppercase tracking-wide text-emerald-100/80">
                      {fact.label}
                    </dt>
                    <dd className="mt-1 text-2xl font-bold tracking-tight text-white">
                      {fact.stat}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <a
                  href={PRODUCTS_FLAGSHIP.ctas.docs.href}
                  className="rounded-md bg-white px-6 py-3 text-sm font-semibold text-emerald-800 shadow-sm transition-colors hover:bg-emerald-50"
                >
                  {PRODUCTS_FLAGSHIP.ctas.docs.label}
                </a>
                <a
                  href={PRODUCTS_FLAGSHIP.ctas.pricing.href}
                  className="rounded-md bg-emerald-900/40 px-6 py-3 text-sm font-semibold text-white ring-1 ring-white/30 transition-colors hover:bg-emerald-900/60"
                >
                  {PRODUCTS_FLAGSHIP.ctas.pricing.label}
                </a>
                <a
                  href={PRODUCTS_FLAGSHIP.ctas.repo.href}
                  className="rounded-md px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                  {...(PRODUCTS_FLAGSHIP.ctas.repo.external
                    ? { target: '_blank', rel: 'noreferrer' }
                    : {})}
                >
                  {PRODUCTS_FLAGSHIP.ctas.repo.label}
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sister products — uniform card grid */}
      <section className="bg-gray-50 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              And the rest of the fleet
            </h2>
            <p className="mt-4 text-lg leading-7 text-gray-600">
              Sister products that extend the runtime — secrets, dev tooling, white-labeling,
              skills, and the agent tool catalog.
            </p>
          </div>

          <ul className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2">
            {PRODUCTS_SISTERS.map((product) => {
              const status = PRODUCT_STATUS_STYLES[product.status];
              return (
                <li
                  key={product.slug}
                  id={product.slug}
                  className="group relative flex flex-col rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-200 transition-shadow hover:shadow-lg"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-50 ring-1 ring-gray-200">
                        <svg
                          className="h-6 w-6 text-gray-700"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                        >
                          <title>{product.name}</title>
                          <path strokeLinecap="round" strokeLinejoin="round" d={product.iconPath} />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold tracking-tight text-gray-900">
                          {product.name}
                        </h3>
                        <p className="mt-0.5 text-sm font-medium text-gray-600">
                          {product.tagline}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 text-xs font-semibold">
                      <span
                        className={`rounded-full px-2.5 py-1 ring-1 ${status.bg} ${status.text} ${status.ring}`}
                      >
                        {product.status}
                      </span>
                      {product.version ? (
                        <span className="font-mono text-[0.7rem] text-muted-foreground">
                          {product.version}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <p className="mt-5 grow text-sm leading-6 text-gray-600">{product.body}</p>

                  <div className="mt-6">
                    <a
                      href={product.primaryCta.href}
                      className="inline-flex min-h-11 items-center text-sm font-semibold text-emerald-700 transition-colors hover:text-emerald-800"
                      {...(product.primaryCta.external
                        ? { target: '_blank', rel: 'noreferrer' }
                        : {})}
                    >
                      {product.primaryCta.label}
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Stats — production credibility */}
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
              className="rounded-md bg-emerald-600 px-8 py-4 text-base font-semibold text-white shadow-sm hover:bg-emerald-500 transition-colors"
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
