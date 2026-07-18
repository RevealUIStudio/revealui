import { type BlockAnnotation, fieldAttrs } from '@revealui/presentation';
import { HOME_DEMO } from '../../content/home';
import type { DemoData } from '../../lib/page-blocks';

export interface DemoProps {
  /** Rich section data; defaults to the static content module (byte-identical). */
  data?: DemoData;
  /** Dot-path base of this block within the page array, e.g. `blocks.0`. */
  path?: string;
  /** Edit-mode annotation. Inactive by default: emits zero data attributes. */
  annotation?: BlockAnnotation;
}

export function Demo({ data = HOME_DEMO, path = 'blocks.0', annotation = {} }: DemoProps) {
  return (
    <section id="demo" className="bg-secondary py-24 sm:py-32">
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
          <p
            className="mt-6 text-lg leading-8 text-muted-foreground"
            {...fieldAttrs(annotation, `${path}.body`)}
          >
            {data.body}
          </p>
        </div>

        <div className="mx-auto mt-20 grid max-w-5xl grid-cols-1 gap-8 lg:grid-cols-3">
          {data.beats.map((b, index) => (
            <div key={b.n} className="rounded-2xl bg-card p-8 ring-1 ring-border">
              <div
                className="font-mono text-xs font-semibold uppercase tracking-widest text-primary"
                {...fieldAttrs(annotation, `${path}.items.${index}.label`)}
              >
                {b.n}
              </div>
              <h3
                className="mt-3 text-lg font-semibold text-foreground"
                {...fieldAttrs(annotation, `${path}.items.${index}.title`)}
              >
                {b.title}
              </h3>
              <p
                className="mt-3 text-sm leading-6 text-muted-foreground"
                {...fieldAttrs(annotation, `${path}.items.${index}.body`)}
              >
                {b.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
