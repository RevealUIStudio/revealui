import { Button, MarketingSection, SectionHeader } from '@revealui/presentation';
import { Footer } from '../components/Footer';
import {
  ROADMAP_CTA,
  ROADMAP_CTA_LINKS,
  ROADMAP_CTA_PRODUCTS_LINK,
  ROADMAP_HERO,
  ROADMAP_HERO_LINK,
  ROADMAP_SHIPPED,
  ROADMAP_SHIPPED_SECTION,
  ROADMAP_UPCOMING,
  ROADMAP_UPCOMING_SECTION,
  type RoadmapItem,
} from '../content/roadmap';

/** Quiet token-only chips (no off-palette rainbow). Category is label meta. */
function statusBadgeClass(status: string): string {
  if (status === 'Shipped' || status === 'Available') {
    return 'text-primary bg-primary/10 ring-primary/20';
  }
  return 'text-muted-foreground bg-muted ring-border';
}

function FeatureCard({ feature }: { feature: RoadmapItem }) {
  return (
    <div className="rounded-2xl bg-card p-6 ring-1 ring-border sm:p-8">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-muted-foreground ring-1 ring-border">
          {feature.category}
        </span>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${statusBadgeClass(feature.status)}`}
        >
          {feature.status}
        </span>
      </div>
      <h3 className="font-display text-lg font-semibold tracking-tight text-foreground">
        {feature.name}
      </h3>
      <p className="mt-3 text-sm leading-6 text-body">{feature.description}</p>
    </div>
  );
}

export function RoadmapPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingSection
        tone="background"
        density="spacious"
        width="default"
        className="relative overflow-hidden"
        innerClassName="max-w-4xl text-center"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-primary/10 via-background to-primary/5"
        />
        <h1 className="font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
          Product <span className="text-primary">Roadmap</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-body sm:text-xl">
          {ROADMAP_HERO.subtitle} See our{' '}
          <a
            href={ROADMAP_HERO_LINK.href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline decoration-primary/40 underline-offset-4 hover:text-primary/80"
          >
            {ROADMAP_HERO_LINK.label}
          </a>{' '}
          for the full timeline.
        </p>
      </MarketingSection>

      <MarketingSection tone="secondary" density="compact" width="default">
        <SectionHeader
          title={ROADMAP_SHIPPED_SECTION.title}
          align="start"
          titleClassName="text-2xl sm:text-3xl"
          className="mb-8 max-w-none"
        />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {ROADMAP_SHIPPED.map((feature) => (
            <FeatureCard key={feature.name} feature={feature} />
          ))}
        </div>
      </MarketingSection>

      <MarketingSection tone="background" density="compact" width="default">
        <SectionHeader
          title={ROADMAP_UPCOMING_SECTION.title}
          align="start"
          titleClassName="text-2xl sm:text-3xl"
          className="mb-8 max-w-none"
        />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {ROADMAP_UPCOMING.map((feature) => (
            <FeatureCard key={feature.name} feature={feature} />
          ))}
        </div>
      </MarketingSection>

      <MarketingSection
        tone="secondary"
        density="compact"
        width="default"
        innerClassName="max-w-4xl text-center"
      >
        <SectionHeader
          title={ROADMAP_CTA.title}
          description={ROADMAP_CTA.subtitle}
          align="center"
          titleClassName="text-2xl sm:text-3xl"
        />
        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button asChild size="lg" variant="brand">
            <a
              href={ROADMAP_CTA_LINKS.requestFeature.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              {ROADMAP_CTA_LINKS.requestFeature.label}
            </a>
          </Button>
          <Button asChild size="lg" appearance="outline" variant="neutral">
            <a
              href={ROADMAP_CTA_LINKS.joinDiscussion.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              {ROADMAP_CTA_LINKS.joinDiscussion.label}
            </a>
          </Button>
        </div>
        <p className="mt-8 text-sm text-muted-foreground">
          See what&apos;s shipped today &rarr;{' '}
          <a
            href={ROADMAP_CTA_PRODUCTS_LINK.href}
            className="font-medium text-foreground transition-colors hover:text-foreground/80"
          >
            {ROADMAP_CTA_PRODUCTS_LINK.label}
          </a>
        </p>
      </MarketingSection>

      <Footer />
    </div>
  );
}
