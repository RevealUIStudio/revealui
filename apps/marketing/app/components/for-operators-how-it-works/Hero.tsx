import { type BlockAnnotation, Button, fieldAttrs, MarketingSection } from '@revealui/presentation';
import { FO_HIW_HERO } from '../../content/for-operators-how-it-works';
import type { FoHiwHeroData } from '../../lib/page-blocks';

interface HeroProps {
  data?: FoHiwHeroData;
  path?: string;
  annotation?: BlockAnnotation;
}

export function Hero({
  data = {
    eyebrow: FO_HIW_HERO.eyebrow,
    h1Lines: FO_HIW_HERO.h1Lines,
    subtitle: FO_HIW_HERO.subtitle,
    primaryCta: FO_HIW_HERO.primaryCta,
    backLink: FO_HIW_HERO.backLink,
  },
  path,
  annotation,
}: HeroProps) {
  const field = (suffix: string) =>
    annotation && path ? fieldAttrs(annotation, `${path}.${suffix}`) : {};

  return (
    <MarketingSection
      tone="background"
      density="spacious"
      width="narrow"
      className="relative isolate overflow-hidden"
    >
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/5 via-background to-background" />

      <div className="relative text-center">
        <p
          className="mb-6 text-sm font-semibold uppercase tracking-[0.2em] text-primary"
          {...field('eyebrow')}
        >
          {data.eyebrow}
        </p>

        <h1
          className="text-5xl font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl"
          {...field('title')}
        >
          {data.h1Lines.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </h1>

        <p
          className="mx-auto mt-8 max-w-2xl text-lg leading-8 text-body sm:text-xl"
          {...field('subtitle')}
        >
          {data.subtitle}
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button asChild size="lg" glow className="w-full sm:w-auto">
            <a
              href={data.primaryCta.href}
              {...(data.primaryCta.external
                ? { target: '_blank', rel: 'noopener noreferrer' }
                : {})}
              {...field('links.0.label')}
            >
              {data.primaryCta.label}
            </a>
          </Button>
        </div>

        <p className="mt-8 text-sm text-muted-foreground">
          <a
            href={data.backLink.href}
            className="underline decoration-dotted underline-offset-4 transition-colors hover:text-foreground"
            {...field('links.1.label')}
          >
            {data.backLink.label}
          </a>
        </p>
      </div>
    </MarketingSection>
  );
}
