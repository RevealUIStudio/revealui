import { type BlockAnnotation, fieldAttrs } from '@revealui/presentation';
import { FO_MANAGED_PREREQS } from '../../content/for-operators-managed';
import type { FoManagedPrereqsData } from '../../lib/page-blocks';

export interface FoManagedPrereqsProps {
  readonly data?: FoManagedPrereqsData;
  readonly path?: string;
  readonly annotation?: BlockAnnotation;
}

export function Prerequisites({ data, path, annotation }: FoManagedPrereqsProps = {}) {
  const content = data ?? {
    eyebrow: FO_MANAGED_PREREQS.eyebrow,
    heading: FO_MANAGED_PREREQS.heading,
    intro: FO_MANAGED_PREREQS.intro,
    prerequisites: FO_MANAGED_PREREQS.prerequisites.map((p) => ({
      title: p.title,
      body: p.body,
    })),
    closing: FO_MANAGED_PREREQS.closing,
  };
  const ann = annotation ?? {};
  const base = path ?? '';
  const closingIndex = content.prerequisites.length;

  return (
    <section className="bg-muted py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-6 lg:px-8">
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
          {content.intro}
        </p>

        <ul className="mt-6 space-y-4 list-none p-0">
          {content.prerequisites.map((prereq, index) => (
            <li
              key={prereq.title}
              className="rounded-2xl border border-border bg-card p-5 shadow-sm"
            >
              <h3
                className="text-base font-semibold leading-7 text-foreground"
                {...(base ? fieldAttrs(ann, `${base}.items.${index}.label`) : {})}
              >
                {prereq.title}
              </h3>
              <p
                className="mt-2 text-base leading-7 text-muted-foreground"
                {...(base ? fieldAttrs(ann, `${base}.items.${index}.body`) : {})}
              >
                {prereq.body}
              </p>
            </li>
          ))}
        </ul>

        <p
          className="mt-8 text-base leading-7 text-foreground font-medium"
          {...(base ? fieldAttrs(ann, `${base}.items.${closingIndex}.body`) : {})}
        >
          {content.closing}
        </p>
      </div>
    </section>
  );
}
