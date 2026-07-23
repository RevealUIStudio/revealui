import { type BlockAnnotation, fieldAttrs, IconPlus } from '@revealui/presentation';
import { FOR_OPERATORS_FAQ } from '../../content/for-operators';
import type { ServicesFaqData } from '../../lib/page-blocks';

export interface FaqProps {
  readonly data?: ServicesFaqData;
  readonly path?: string;
  readonly annotation?: BlockAnnotation;
}

export function Faq({ data, path, annotation }: FaqProps = {}) {
  const content = data ?? {
    eyebrow: FOR_OPERATORS_FAQ.eyebrow,
    heading: FOR_OPERATORS_FAQ.heading,
    items: FOR_OPERATORS_FAQ.items.map((item) => ({
      question: item.question,
      answer: item.answer,
    })),
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
        </div>

        <div className="mx-auto mt-16 max-w-3xl divide-y divide-border">
          {content.items.map((item, index) => (
            <details key={item.question} className="group py-6">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-6 text-left">
                <h3
                  className="text-lg font-semibold leading-7 text-foreground"
                  {...(base ? fieldAttrs(ann, `${base}.items.${index}.label`) : {})}
                >
                  {item.question}
                </h3>
                <span className="ml-2 mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition group-open:rotate-45 group-open:bg-primary/10 group-open:text-primary">
                  <IconPlus size="sm" label="Toggle" />
                </span>
              </summary>
              <div
                className="mt-4 pr-9 text-base leading-7 text-muted-foreground"
                {...(base ? fieldAttrs(ann, `${base}.items.${index}.body`) : {})}
              >
                {item.answer}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
