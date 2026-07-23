import { type BlockAnnotation, fieldAttrs } from '@revealui/presentation';
import { FO_HIW_TIMELINE } from '../../content/for-operators-how-it-works';
import type { FoHiwTimelineData } from '../../lib/page-blocks';

interface TimelineProps {
  data?: FoHiwTimelineData;
  path?: string;
  annotation?: BlockAnnotation;
}

export function Timeline({ data = FO_HIW_TIMELINE, path, annotation }: TimelineProps) {
  const field = (suffix: string) =>
    annotation && path ? fieldAttrs(annotation, `${path}.${suffix}`) : {};

  return (
    <section className="bg-muted py-24 sm:py-32">
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
          {data.paragraph1}
        </p>
        <p className="mt-4 text-base leading-7 text-muted-foreground" {...field('items.0.body')}>
          {data.paragraph2}
        </p>
      </div>
    </section>
  );
}
