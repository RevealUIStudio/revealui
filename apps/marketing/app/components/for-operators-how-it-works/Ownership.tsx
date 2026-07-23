import { type BlockAnnotation, fieldAttrs } from '@revealui/presentation';
import { FO_HIW_OWNERSHIP } from '../../content/for-operators-how-it-works';
import type { FoHiwOwnershipData } from '../../lib/page-blocks';

interface OwnershipProps {
  data?: FoHiwOwnershipData;
  path?: string;
  annotation?: BlockAnnotation;
}

export function Ownership({ data = FO_HIW_OWNERSHIP, path, annotation }: OwnershipProps) {
  const field = (suffix: string) =>
    annotation && path ? fieldAttrs(annotation, `${path}.${suffix}`) : {};

  const diffIndex = data.claims.length;

  return (
    <section className="bg-background py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-6 lg:px-8">
        <p
          className="text-sm font-semibold uppercase tracking-widest text-muted-foreground"
          {...field('eyebrow')}
        >
          {data.eyebrow}
        </p>
        <h2
          className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
          {...field('heading')}
        >
          {data.heading}
        </h2>

        <p className="mt-6 text-base leading-7 text-muted-foreground" {...field('body')}>
          {data.intro}
        </p>

        <ul className="mt-6 space-y-4 list-none p-0">
          {data.claims.map((claim, index) => (
            <li
              key={claim.title}
              className="rounded-2xl border border-border bg-card p-5 shadow-sm"
            >
              <h3
                className="text-base font-semibold leading-7 text-foreground"
                {...field(`items.${index}.title`)}
              >
                {claim.title}
              </h3>
              <p
                className="mt-1 text-base leading-7 text-muted-foreground"
                {...field(`items.${index}.body`)}
              >
                {claim.body}
              </p>
            </li>
          ))}
        </ul>

        <p
          className="mt-8 text-base leading-7 text-foreground font-medium"
          {...field(`items.${diffIndex}.body`)}
        >
          {data.differentiator}
        </p>
      </div>
    </section>
  );
}
