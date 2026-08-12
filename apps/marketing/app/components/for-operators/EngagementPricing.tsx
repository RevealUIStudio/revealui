import { type BlockAnnotation, Button, fieldAttrs } from '@revealui/presentation';
import { FOR_OPERATORS_PRICING } from '../../content/for-operators';
import type { ServicesPricingIntroData } from '../../lib/page-blocks';

export interface EngagementPricingProps {
  /**
   * CMS-driven section header only. Engagement ladder rungs (titles, prices,
   * bodies, CTAs) stay component-local from for-operators + contracts.
   */
  readonly data?: ServicesPricingIntroData;
  readonly path?: string;
  readonly annotation?: BlockAnnotation;
}

export function EngagementPricing({ data, path, annotation }: EngagementPricingProps = {}) {
  const intro = data ?? {
    eyebrow: FOR_OPERATORS_PRICING.eyebrow,
    heading: FOR_OPERATORS_PRICING.heading,
    body: FOR_OPERATORS_PRICING.body,
  };
  const { rungs } = FOR_OPERATORS_PRICING;
  const ann = annotation ?? {};
  const base = path ?? '';

  return (
    <section className="bg-background py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p
            className="text-sm font-semibold uppercase tracking-widest text-muted-foreground"
            {...(base ? fieldAttrs(ann, `${base}.eyebrow`) : {})}
          >
            {intro.eyebrow}
          </p>
          <h2
            className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
            {...(base ? fieldAttrs(ann, `${base}.heading`) : {})}
          >
            {intro.heading}
          </h2>
          <p
            className="mt-6 text-lg leading-8 text-body"
            {...(base ? fieldAttrs(ann, `${base}.body`) : {})}
          >
            {intro.body}
          </p>
        </div>

        <ul className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-3 list-none p-0">
          {rungs.map((rung) => (
            <li
              key={rung.title}
              className="flex flex-col rounded-2xl border border-border bg-card p-8 shadow-sm"
            >
              <h3 className="text-lg font-semibold leading-7 text-foreground">{rung.title}</h3>
              <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{rung.price}</p>
              <p className="mt-4 flex-1 text-base leading-7 text-muted-foreground">{rung.body}</p>
              <div className="mt-8">
                <Button asChild appearance="outline" variant="neutral" className="w-full">
                  <a
                    href={rung.cta.href}
                    {...(rung.cta.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  >
                    {rung.cta.label}
                  </a>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
