import { type BlockAnnotation, Button, fieldAttrs } from '@revealui/presentation';
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
    <section className="relative isolate overflow-hidden bg-background px-6 pt-20 pb-20 sm:px-6 sm:pt-28 sm:pb-28 lg:px-8">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/5 via-background to-background" />

      <div className="relative mx-auto max-w-3xl text-center">
        <p
          className="text-sm font-semibold uppercase tracking-[0.2em] text-primary mb-6"
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
          className="mx-auto mt-8 max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl"
          {...field('subtitle')}
        >
          {data.subtitle}
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button asChild size="lg" className="w-full sm:w-auto">
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
            className="hover:text-foreground transition-colors underline decoration-dotted underline-offset-4"
            {...field('links.1.label')}
          >
            {data.backLink.label}
          </a>
        </p>
      </div>
    </section>
  );
}
