import {
  Badge,
  Button,
  IconCheckCircle,
  MarketingSection,
  SectionHeader,
} from '@revealui/presentation';
import { Footer } from '../components/Footer';
import { Faq } from '../components/landing/Faq';
import { Proof } from '../components/landing/Proof';
import { ProductsCta } from '../components/products/ProductsCta';
import { ProductsHero } from '../components/products/ProductsHero';
import { PRODUCTS_FLAGSHIP, PRODUCTS_STATS_SECTION } from '../content/products';
import {
  PRODUCTS_FALLBACK_BLOCKS,
  productsCtaSlot,
  productsFaqSlot,
  productsHeroSlot,
} from '../lib/page-blocks/pages/products';
import { useMarketingPageBlocks } from '../lib/use-page-blocks';

export function ProductsPage() {
  const { blocks, annotation } = useMarketingPageBlocks('products', PRODUCTS_FALLBACK_BLOCKS);
  const hero = productsHeroSlot(blocks);
  const faq = productsFaqSlot(blocks);
  const cta = productsCtaSlot(blocks);
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <ProductsHero data={hero.data} path={hero.path} annotation={annotation} />

      {/* Flagship — RevealUI featured card */}
      <MarketingSection
        id={PRODUCTS_FLAGSHIP.slug}
        tone="background"
        density="default"
        width="default"
      >
        {/* Quiet flagship panel: solid primary, no multi-blob chrome (GAP-480 residual). */}
        <div className="relative overflow-hidden rounded-2xl bg-primary p-8 ring-1 ring-primary/20 sm:p-12">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-foreground/15 ring-1 ring-primary-foreground/25">
                <svg
                  className="h-6 w-6 text-primary-foreground"
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
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-foreground/85">
                  {PRODUCTS_FLAGSHIP.eyebrow}
                </p>
                <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-primary-foreground sm:text-3xl">
                  {PRODUCTS_FLAGSHIP.name}
                </h2>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold">
              <Badge className="bg-primary-foreground/15 text-primary-foreground ring-1 ring-primary-foreground/25">
                {PRODUCTS_FLAGSHIP.status}
              </Badge>
              <Badge className="bg-primary-foreground/10 font-mono text-primary-foreground/90 ring-1 ring-primary-foreground/20">
                {PRODUCTS_FLAGSHIP.version}
              </Badge>
            </div>
          </div>

          <p className="mt-6 max-w-3xl text-lg font-medium leading-8 text-primary-foreground sm:text-xl">
            {PRODUCTS_FLAGSHIP.tagline}
          </p>
          <p className="mt-3 max-w-3xl text-base leading-7 text-primary-foreground/90">
            {PRODUCTS_FLAGSHIP.body}
          </p>

          <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            {PRODUCTS_FLAGSHIP.facts.map((fact) => (
              <div
                key={fact.label}
                className="rounded-xl bg-primary-foreground/10 px-4 py-3 ring-1 ring-primary-foreground/20"
              >
                <dt className="text-xs uppercase tracking-wide text-primary-foreground/80">
                  {fact.label}
                </dt>
                <dd className="mt-1 text-xl font-bold tracking-tight text-primary-foreground sm:text-2xl">
                  {fact.stat}
                </dd>
              </div>
            ))}
          </dl>

          <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary-foreground/15 px-4 py-1.5 text-sm font-semibold text-primary-foreground ring-1 ring-primary-foreground/25">
            <IconCheckCircle className="h-4 w-4" size="sm" label="Pricing" />
            {PRODUCTS_FLAGSHIP.priceLabel}
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild variant="neutral" appearance="solid">
              <a href={PRODUCTS_FLAGSHIP.ctas.docs.href}>{PRODUCTS_FLAGSHIP.ctas.docs.label}</a>
            </Button>
            <Button
              asChild
              appearance="outline"
              variant="neutral"
              className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/15"
            >
              <a href={PRODUCTS_FLAGSHIP.ctas.pricing.href}>
                {PRODUCTS_FLAGSHIP.ctas.pricing.label}
              </a>
            </Button>
            <Button
              asChild
              appearance="ghost"
              variant="neutral"
              className="text-primary-foreground hover:bg-primary-foreground/10"
            >
              <a
                href={PRODUCTS_FLAGSHIP.ctas.repo.href}
                {...(PRODUCTS_FLAGSHIP.ctas.repo.external
                  ? { target: '_blank', rel: 'noreferrer' }
                  : {})}
              >
                {PRODUCTS_FLAGSHIP.ctas.repo.label}
              </a>
            </Button>
          </div>
        </div>
      </MarketingSection>

      {/* Stats — production credibility */}
      <MarketingSection tone="card" density="default" width="default">
        <SectionHeader
          title={PRODUCTS_STATS_SECTION.heading}
          description={PRODUCTS_STATS_SECTION.body}
          align="center"
          className="mb-10 sm:mb-12"
        />
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4 sm:gap-8">
          {PRODUCTS_STATS_SECTION.items.map((item) => (
            <div key={item.label} className="text-center">
              <p className="font-display text-4xl font-bold tracking-tight text-foreground tabular-nums sm:text-5xl">
                {item.stat}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{item.label}</p>
            </div>
          ))}
        </div>
      </MarketingSection>

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
