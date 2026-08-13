import { type BlockAnnotation, fieldAttrs, MarketingSection } from '@revealui/presentation';
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
            className="underline decoration-dotted underline-offset-4 transition-colors hover:text-foreground"
            {...(base ? fieldAttrs(ann, `${base}.links.0.label`) : {})}
          >
            {content.backLink.label}
          </a>
        </p>
      </div>
    </MarketingSection>
  );
}
