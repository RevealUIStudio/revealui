import { type BlockAnnotation, fieldAttrs } from '@revealui/presentation';
import { HOME_FAQ } from '../../content/home';
import type { FaqData } from '../../lib/page-blocks';

export interface FaqProps {
  /** Rich FAQ data; defaults to the static content module (byte-identical). */
  data?: FaqData;
  /** Dot-path base of this block within the page array, e.g. `blocks.1`. */
  path?: string;
  /** Edit-mode annotation. Inactive by default: emits zero data attributes. */
  annotation?: BlockAnnotation;
}

export function Faq({ data = HOME_FAQ, path = 'blocks.1', annotation = {} }: FaqProps) {
  return (
    <section id="faq" className="bg-background py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p
            className="text-sm font-semibold uppercase tracking-widest text-muted-foreground"
            {...fieldAttrs(annotation, `${path}.eyebrow`)}
          >
            {data.eyebrow}
          </p>
          <h2
            className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
            {...fieldAttrs(annotation, `${path}.heading`)}
          >
            {data.heading}
          </h2>
        </div>

        <div className="mx-auto mt-16 max-w-3xl divide-y divide-border">
          {data.items.map((item, index) => (
            <details key={item.question} className="group py-6">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-6 text-left">
                <h3
                  className="text-lg font-semibold leading-7 text-foreground"
                  {...fieldAttrs(annotation, `${path}.items.${index}.label`)}
                >
                  {item.question}
                </h3>

                <span className="ml-2 mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition group-open:rotate-45 group-open:bg-primary/10 group-open:text-primary">
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <title>Toggle</title>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </span>
              </summary>
              <div
                className="mt-4 pr-9 text-base leading-7 text-muted-foreground"
                {...fieldAttrs(annotation, `${path}.items.${index}.body`)}
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
