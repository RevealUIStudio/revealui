import { type BlockAnnotation, fieldAttrs } from '@revealui/presentation';
import { FOR_OPERATORS_HOW_WE_DELIVER } from '../../content/for-operators';
import type { ServicesHowWeDeliverData } from '../../lib/page-blocks';

export interface HowWeDeliverProps {
  readonly data?: ServicesHowWeDeliverData;
  readonly path?: string;
  readonly annotation?: BlockAnnotation;
}

export function HowWeDeliver({ data, path, annotation }: HowWeDeliverProps = {}) {
  const content = data ?? {
    eyebrow: FOR_OPERATORS_HOW_WE_DELIVER.eyebrow,
    heading: FOR_OPERATORS_HOW_WE_DELIVER.heading,
    paragraph1: FOR_OPERATORS_HOW_WE_DELIVER.paragraph1,
    paragraph2: { ...FOR_OPERATORS_HOW_WE_DELIVER.paragraph2 },
    paragraph3: FOR_OPERATORS_HOW_WE_DELIVER.paragraph3,
  };
  const ann = annotation ?? {};
  const base = path ?? '';
  const { eyebrow, heading, paragraph1, paragraph2, paragraph3 } = content;

  return (
    <section className="bg-muted py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-6 lg:px-8">
        <p
          className="text-sm font-semibold uppercase tracking-widest text-muted-foreground"
          {...(base ? fieldAttrs(ann, `${base}.eyebrow`) : {})}
        >
          {eyebrow}
        </p>
        <h2
          className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
          {...(base ? fieldAttrs(ann, `${base}.heading`) : {})}
        >
          {heading}
        </h2>

        <div className="mt-8 space-y-6 text-base leading-7 text-muted-foreground">
          <p {...(base ? fieldAttrs(ann, `${base}.body`) : {})}>{paragraph1}</p>
          <p>
            <span {...(base ? fieldAttrs(ann, `${base}.items.0.body`) : {})}>
              {paragraph2.before}
            </span>
            <a
              href={paragraph2.linkHref}
              className="font-medium text-primary hover:underline underline-offset-4"
              {...(base ? fieldAttrs(ann, `${base}.items.1.body`) : {})}
            >
              {paragraph2.linkLabel}
            </a>
            <span {...(base ? fieldAttrs(ann, `${base}.items.2.body`) : {})}>
              {paragraph2.after}
            </span>
          </p>
          <p {...(base ? fieldAttrs(ann, `${base}.items.3.body`) : {})}>{paragraph3}</p>
        </div>
      </div>
    </section>
  );
}
