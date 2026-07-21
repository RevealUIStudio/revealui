import { Button, IconCheckCircle } from '@revealui/presentation';
import { useState } from 'react';
import { Footer } from '../components/Footer';
import { Faq } from '../components/landing/Faq';
import { Proof } from '../components/landing/Proof';
import { ProductsCta } from '../components/products/ProductsCta';
import { ProductsHero } from '../components/products/ProductsHero';
import {
  PRODUCT_STATUS_STYLES,
  PRODUCTS_FLAGSHIP,
  PRODUCTS_SISTERS,
  PRODUCTS_STATS_SECTION,
  type ProductStatus,
} from '../content/products';
import {
  PRODUCTS_FALLBACK_BLOCKS,
  productsCtaSlot,
  productsFaqSlot,
  productsHeroSlot,
} from '../lib/page-blocks';
import { useMarketingPageBlocks } from '../lib/use-page-blocks';

// Filter chips for the fleet-products table. "All" plus each status, ordered
// stability-descending to match the grid.
const STATUS_FILTERS: readonly (ProductStatus | 'All')[] = [
  'All',
  'Beta',
  'Alpha',
  'Active (MIT)',
  'Planned',
];

export function ProductsPage() {
  const [filter, setFilter] = useState<ProductStatus | 'All'>('All');
  const visibleSisters =
    filter === 'All' ? PRODUCTS_SISTERS : PRODUCTS_SISTERS.filter((p) => p.status === filter);
  const countFor = (f: ProductStatus | 'All') =>
    f === 'All' ? PRODUCTS_SISTERS.length : PRODUCTS_SISTERS.filter((p) => p.status === f).length;
  const { blocks, annotation } = useMarketingPageBlocks('products', PRODUCTS_FALLBACK_BLOCKS);
  const hero = productsHeroSlot(blocks);
  const faq = productsFaqSlot(blocks);
  const cta = productsCtaSlot(blocks);
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <ProductsHero data={hero.data} path={hero.path} annotation={annotation} />

      {/* Flagship — RevealUI featured card */}
      <section id={PRODUCTS_FLAGSHIP.slug} className="py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary/90 to-primary/70 p-10 shadow-2xl ring-1 ring-primary/20 sm:p-14">
            <div className="absolute -right-16 -top-16 h-72 w-72 rounded-full bg-primary-foreground/10 blur-3xl" />
            <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-blue-500/15 blur-3xl" />
            <div className="relative">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-foreground/15 ring-1 ring-primary-foreground/30 backdrop-blur">
                    <svg
                      className="h-7 w-7 text-primary-foreground"
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
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-foreground/90">
                      {PRODUCTS_FLAGSHIP.eyebrow}
                    </p>
                    <h2 className="mt-1 text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl">
                      {PRODUCTS_FLAGSHIP.name}
                    </h2>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <span className="rounded-full bg-primary-foreground/15 px-3 py-1 text-primary-foreground ring-1 ring-primary-foreground/30 backdrop-blur">
                    {PRODUCTS_FLAGSHIP.status}
                  </span>
                  <span className="rounded-full bg-primary-foreground/10 px-3 py-1 font-mono text-primary-foreground/90 ring-1 ring-primary-foreground/20">
                    {PRODUCTS_FLAGSHIP.version}
                  </span>
                </div>
              </div>

              <p className="mt-6 max-w-3xl text-xl font-medium leading-8 text-primary-foreground">
                {PRODUCTS_FLAGSHIP.tagline}
              </p>
              <p className="mt-3 max-w-3xl text-base leading-7 text-primary-foreground/90">
                {PRODUCTS_FLAGSHIP.body}
              </p>

              <dl className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {PRODUCTS_FLAGSHIP.facts.map((fact) => (
                  <div
                    key={fact.label}
                    className="rounded-xl bg-primary-foreground/10 px-4 py-3 ring-1 ring-primary-foreground/20 backdrop-blur"
                  >
                    <dt className="text-xs uppercase tracking-wide text-primary-foreground/80">
                      {fact.label}
                    </dt>
                    <dd className="mt-1 text-2xl font-bold tracking-tight text-primary-foreground">
                      {fact.stat}
                    </dd>
                  </div>
                ))}
              </dl>

              <p className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary-foreground/15 px-4 py-1.5 text-sm font-semibold text-primary-foreground ring-1 ring-primary-foreground/30 backdrop-blur">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <title>Pricing</title>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                  />
                </svg>
                {PRODUCTS_FLAGSHIP.priceLabel}
              </p>

              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <a
                  href={PRODUCTS_FLAGSHIP.ctas.docs.href}
                  className="rounded-md bg-primary-foreground px-6 py-3 text-sm font-semibold text-primary shadow-sm transition-colors hover:bg-primary-foreground/90"
                >
                  {PRODUCTS_FLAGSHIP.ctas.docs.label}
                </a>
                <a
                  href={PRODUCTS_FLAGSHIP.ctas.pricing.href}
                  className="rounded-md bg-primary-foreground/15 px-6 py-3 text-sm font-semibold text-primary-foreground ring-1 ring-primary-foreground/30 transition-colors hover:bg-primary-foreground/25"
                >
                  {PRODUCTS_FLAGSHIP.ctas.pricing.label}
                </a>
                <a
                  href={PRODUCTS_FLAGSHIP.ctas.repo.href}
                  className="rounded-md px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-foreground/10"
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
      <section className="bg-secondary py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              And the rest of the fleet
            </h2>
            <p className="mt-4 text-lg leading-7 text-muted-foreground">
              Sister products that extend the runtime: secrets, dev tooling, white-labeling, skills,
              and the agent tool catalog.
            </p>
          </div>

          {/* Status filter chips (Phase D, interactive). */}
          <div
            className="mt-10 flex flex-wrap items-center justify-center gap-2"
            role="tablist"
            aria-label="Filter products by status"
          >
            {STATUS_FILTERS.map((f) => {
              const selected = filter === f;
              return (
                <Button
                  key={f}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  size="sm"
                  appearance={selected ? 'solid' : 'outline'}
                  variant={selected ? 'brand' : 'neutral'}
                  onClick={() => setFilter(f)}
                  className="rounded-full"
                >
                  {f}
                  <span className="text-xs text-muted-foreground">{countFor(f)}</span>
                </Button>
              );
            })}
          </div>

          <ul className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
            {visibleSisters.map((product) => {
              const status = PRODUCT_STATUS_STYLES[product.status];
              return (
                <li
                  key={product.slug}
                  id={product.slug}
                  className="group relative flex flex-col rounded-2xl bg-card p-8 shadow-sm ring-1 ring-border transition-shadow hover:shadow-lg"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary ring-1 ring-border">
                        <svg
                          className="h-6 w-6 text-muted-foreground"
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
                        <h3 className="text-xl font-bold tracking-tight text-foreground">
                          {product.name}
                        </h3>
                        <p className="mt-0.5 text-sm font-medium text-muted-foreground">
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

                  <ul className="mt-5 grow space-y-2.5">
                    {product.highlights.map((highlight) => (
                      <li
                        key={highlight}
                        className="flex items-start gap-2.5 text-sm leading-6 text-muted-foreground"
                      >
                        <IconCheckCircle size="sm" className="mt-1 flex-shrink-0 text-primary" />
                        {highlight}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-4">
                    <span className="text-xs font-semibold text-foreground/70">
                      {product.priceLabel}
                    </span>
                    <a
                      href={product.primaryCta.href}
                      className="inline-flex min-h-11 items-center text-sm font-semibold text-primary transition-colors hover:text-primary/80"
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
      <section className="bg-card py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {PRODUCTS_STATS_SECTION.heading}
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">{PRODUCTS_STATS_SECTION.body}</p>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {PRODUCTS_STATS_SECTION.items.map((item) => (
              <div key={item.label} className="text-center">
                <p className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
                  {item.stat}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Proof — social proof, repo signals, and trust cards */}
      <Proof />

      {/* FAQ — handle licensing / self-host / production-ready objections */}
      <Faq data={faq.data} path={faq.path} annotation={annotation} />

      {/* CTA */}
      <ProductsCta data={cta.data} path={cta.path} annotation={annotation} />

      <Footer />
    </div>
  );
}
