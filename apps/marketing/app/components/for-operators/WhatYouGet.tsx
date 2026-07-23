import { type BlockAnnotation, fieldAttrs } from '@revealui/presentation';
import { FOR_OPERATORS_WHAT_YOU_GET } from '../../content/for-operators';
import type { ServicesWhatYouGetData } from '../../lib/page-blocks';
import { CenteredCardGrid } from '../CenteredCardGrid';

export interface WhatYouGetProps {
  readonly data?: ServicesWhatYouGetData;
  readonly path?: string;
  readonly annotation?: BlockAnnotation;
}

export function WhatYouGet({ data, path, annotation }: WhatYouGetProps = {}) {
  const content = data ?? {
    eyebrow: FOR_OPERATORS_WHAT_YOU_GET.eyebrow,
    heading: FOR_OPERATORS_WHAT_YOU_GET.heading,
    body: FOR_OPERATORS_WHAT_YOU_GET.body,
    cards: FOR_OPERATORS_WHAT_YOU_GET.cards.map((c) => ({ title: c.title, body: c.body })),
  };
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
            {content.eyebrow}
          </p>
          <h2
            className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
            {...(base ? fieldAttrs(ann, `${base}.heading`) : {})}
          >
            {content.heading}
          </h2>
          <p
            className="mt-6 text-lg leading-8 text-muted-foreground"
            {...(base ? fieldAttrs(ann, `${base}.body`) : {})}
          >
            {content.body}
          </p>
        </div>

        <CenteredCardGrid className="mx-auto mt-16 max-w-5xl">
          {content.cards.map((card, index) => (
            <div
              key={card.title}
              className="w-full rounded-2xl border border-border bg-card p-6 shadow-sm sm:w-[calc(50%-0.75rem)] lg:w-[calc(33.333%-1rem)]"
            >
              <h3
                className="text-lg font-semibold leading-7 text-foreground"
                {...(base ? fieldAttrs(ann, `${base}.items.${index}.label`) : {})}
              >
                {card.title}
              </h3>
              <p
                className="mt-3 text-base leading-7 text-muted-foreground"
                {...(base ? fieldAttrs(ann, `${base}.items.${index}.body`) : {})}
              >
                {card.body}
              </p>
            </div>
          ))}
        </CenteredCardGrid>
      </div>
    </section>
  );
}
