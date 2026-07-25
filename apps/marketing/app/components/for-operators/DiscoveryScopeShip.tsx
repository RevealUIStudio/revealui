import { type BlockAnnotation, fieldAttrs } from '@revealui/presentation';
import { FOR_OPERATORS_DISCOVERY } from '../../content/for-operators';
import type { ServicesDiscoveryData } from '../../lib/page-blocks';

export interface DiscoveryScopeShipProps {
  readonly data?: ServicesDiscoveryData;
  readonly path?: string;
  readonly annotation?: BlockAnnotation;
}

export function DiscoveryScopeShip({ data, path, annotation }: DiscoveryScopeShipProps = {}) {
  const content = data ?? {
    eyebrow: FOR_OPERATORS_DISCOVERY.eyebrow,
    heading: FOR_OPERATORS_DISCOVERY.heading,
    body: FOR_OPERATORS_DISCOVERY.body,
    link: FOR_OPERATORS_DISCOVERY.link,
  };
  const ann = annotation ?? {};
  const base = path ?? '';

  return (
    <section className="bg-background py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-6 text-center lg:px-8">
        <p
          className="text-sm font-semibold uppercase tracking-widest text-muted-foreground"
          {...(base ? fieldAttrs(ann, `${base}.eyebrow`) : {})}
        >
          {content.eyebrow}
        </p>
        <h2
          className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
          {...(base ? fieldAttrs(ann, `${base}.heading`) : {})}
        >
          {content.heading}
        </h2>
        <p
          className="mt-6 text-base leading-7 text-muted-foreground"
          {...(base ? fieldAttrs(ann, `${base}.body`) : {})}
        >
          {content.body}
        </p>
        <p className="mt-8">
          <a
            href={content.link.href}
            className="font-medium text-primary hover:underline underline-offset-4"
            {...(base ? fieldAttrs(ann, `${base}.items.0.label`) : {})}
          >
            {content.link.label}
          </a>
        </p>
      </div>
    </section>
  );
}
