import { type BlockAnnotation, fieldAttrs } from '@revealui/presentation';
import { FO_MANAGED_HERO } from '../../content/for-operators-managed';
import type { FoManagedHeroData } from '../../lib/page-blocks';

export interface FoManagedHeroProps {
  readonly data?: FoManagedHeroData;
  readonly path?: string;
  readonly annotation?: BlockAnnotation;
}

export function Hero({ data, path, annotation }: FoManagedHeroProps = {}) {
  const content = data ?? {
    eyebrow: FO_MANAGED_HERO.eyebrow,
    h1Lines: [...FO_MANAGED_HERO.h1Lines],
    subtitle: FO_MANAGED_HERO.subtitle,
    backLink: FO_MANAGED_HERO.backLink,
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
          className="mx-auto mt-8 max-w-2xl text-lg leading-8 text-body sm:text-xl"
          {...(base ? fieldAttrs(ann, `${base}.subtitle`) : {})}
        >
          {content.subtitle}
        </p>

        <p className="mt-10 text-sm text-muted-foreground">
          <a
            href={content.backLink.href}
            className="hover:text-foreground transition-colors underline decoration-dotted underline-offset-4"
            {...(base ? fieldAttrs(ann, `${base}.links.0.label`) : {})}
          >
            {content.backLink.label}
          </a>
        </p>
      </div>
    </section>
  );
}
