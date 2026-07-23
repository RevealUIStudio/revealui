import { type BlockAnnotation, Button, fieldAttrs } from '@revealui/presentation';
import { FOR_OPERATORS_HERO } from '../../content/for-operators';
import type { ServicesHeroData } from '../../lib/page-blocks';

export interface ServicesHeroProps {
  /** CMS-driven data; defaults to the static content module. */
  readonly data?: ServicesHeroData;
  /** Dot-path into the page blocks array (e.g. `blocks.0.data`). */
  readonly path?: string;
  readonly annotation?: BlockAnnotation;
}

export function Hero({ data, path, annotation }: ServicesHeroProps = {}) {
  const content = data ?? {
    eyebrow: FOR_OPERATORS_HERO.eyebrow,
    h1Lines: [...FOR_OPERATORS_HERO.h1Lines],
    subtitle: FOR_OPERATORS_HERO.subtitle,
    primaryCta: FOR_OPERATORS_HERO.primaryCta,
    reverseLink: FOR_OPERATORS_HERO.reverseLink,
  };
  const ann = annotation ?? {};
  const base = path ?? '';

  return (
    <section className="relative isolate overflow-hidden bg-background px-6 pt-20 pb-20 sm:px-6 sm:pt-28 sm:pb-28 lg:px-8">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/5 via-background to-background" />

      <div className="relative mx-auto max-w-3xl text-center">
        <p
          className="text-sm font-semibold uppercase tracking-[0.2em] text-primary mb-6"
          {...(base ? fieldAttrs(ann, `${base}.eyebrow`) : {})}
        >
          {content.eyebrow}
        </p>

        <h1
          className="text-5xl font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl"
          {...(base ? fieldAttrs(ann, `${base}.title`) : {})}
        >
          {content.h1Lines.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </h1>

        <p
          className="mx-auto mt-8 max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl"
          {...(base ? fieldAttrs(ann, `${base}.subtitle`) : {})}
        >
          {content.subtitle}
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <a
              href={content.primaryCta.href}
              {...(content.primaryCta.external
                ? { target: '_blank', rel: 'noopener noreferrer' }
                : {})}
              {...(base ? fieldAttrs(ann, `${base}.links.0.label`) : {})}
            >
              {content.primaryCta.label}
            </a>
          </Button>
        </div>

        <p className="mt-8 text-sm text-muted-foreground">
          <a
            href={content.reverseLink.href}
            className="hover:text-foreground transition-colors underline decoration-dotted underline-offset-4"
            {...(base ? fieldAttrs(ann, `${base}.links.1.label`) : {})}
          >
            {content.reverseLink.label}
          </a>
        </p>
      </div>
    </section>
  );
}
