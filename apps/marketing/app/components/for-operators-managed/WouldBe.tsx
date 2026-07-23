import { type BlockAnnotation, fieldAttrs } from '@revealui/presentation';
import { FO_MANAGED_WOULD_BE } from '../../content/for-operators-managed';
import type { FoManagedWouldBeData } from '../../lib/page-blocks';

export interface FoManagedWouldBeProps {
  readonly data?: FoManagedWouldBeData;
  readonly path?: string;
  readonly annotation?: BlockAnnotation;
}

export function WouldBe({ data, path, annotation }: FoManagedWouldBeProps = {}) {
  const content = data ?? {
    eyebrow: FO_MANAGED_WOULD_BE.eyebrow,
    heading: FO_MANAGED_WOULD_BE.heading,
    capabilities: FO_MANAGED_WOULD_BE.capabilities.map((c) => ({
      title: c.title,
      body: c.body,
    })),
    closing: FO_MANAGED_WOULD_BE.closing,
  };
  const ann = annotation ?? {};
  const base = path ?? '';
  const closingIndex = content.capabilities.length;

  return (
    <section className="bg-background py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
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
        </div>

        <ul className="mx-auto mt-16 grid max-w-4xl grid-cols-1 gap-6 list-none p-0">
          {content.capabilities.map((capability, index) => (
            <li
              key={capability.title}
              className="rounded-2xl border border-border bg-card p-6 shadow-sm"
            >
              <h3
                className="text-lg font-semibold leading-7 text-foreground"
                {...(base ? fieldAttrs(ann, `${base}.items.${index}.label`) : {})}
              >
                {capability.title}
              </h3>
              <p
                className="mt-2 text-base leading-7 text-muted-foreground"
                {...(base ? fieldAttrs(ann, `${base}.items.${index}.body`) : {})}
              >
                {capability.body}
              </p>
            </li>
          ))}
        </ul>

        <p
          className="mx-auto mt-12 max-w-2xl text-center text-base leading-7 text-foreground font-medium"
          {...(base ? fieldAttrs(ann, `${base}.items.${closingIndex}.body`) : {})}
        >
          {content.closing}
        </p>
      </div>
    </section>
  );
}
