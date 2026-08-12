import { type BlockAnnotation, fieldAttrs } from '@revealui/presentation';
import { HOME_DEMO } from '../../content/home';
import type { DemoData } from '../../lib/page-blocks';
import { ProductFrame } from './ProductFrame';

export interface DemoProps {
  /** Rich section data; defaults to the static content module (byte-identical). */
  data?: DemoData;
  /** Dot-path of this block's data object within the page array, e.g. `blocks.0.data`. */
  path?: string;
  /** Edit-mode annotation. Inactive by default: emits zero data attributes. */
  annotation?: BlockAnnotation;
}

export function Demo({ data = HOME_DEMO, path = 'blocks.0.data', annotation = {} }: DemoProps) {
  return (
    <section id="demo" className="relative bg-secondary py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p
            className="text-xs font-semibold uppercase tracking-widest text-muted-foreground"
            {...fieldAttrs(annotation, `${path}.eyebrow`)}
          >
            {data.eyebrow}
          </p>
          <h2
            className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
            {...fieldAttrs(annotation, `${path}.heading`)}
          >
            {data.heading}
          </h2>
          <p
            className="mt-5 text-lg leading-8 text-body"
            {...fieldAttrs(annotation, `${path}.body`)}
          >
            {data.body}
          </p>
        </div>

        {/* Product-as-proof: live component frame (Linear craft pattern).
            Content mockupCaption was previously unwired; honesty line stays. */}
        <div className="mt-14 sm:mt-16">
          <ProductFrame caption={HOME_DEMO.mockupCaption} />
        </div>

        {/* Beats as aligned stack, not three bordered cards (Linear: density over chrome). */}
        <ol className="mx-auto mt-14 grid max-w-5xl list-none grid-cols-1 gap-0 divide-y divide-border border-y border-border p-0 sm:mt-16 lg:grid-cols-3 lg:gap-0 lg:divide-x lg:divide-y-0">
          {data.beats.map((b, index) => (
            <li key={b.n} className="relative px-0 py-7 lg:px-8 lg:py-8 first:lg:pl-0 last:lg:pr-0">
              <div
                className="font-mono text-[11px] font-medium tabular-nums tracking-widest text-muted-foreground"
                {...fieldAttrs(annotation, `${path}.items.${index}.label`)}
              >
                {b.n}
              </div>
              <h3
                className="mt-3 font-display text-lg font-semibold tracking-tight text-foreground"
                {...fieldAttrs(annotation, `${path}.items.${index}.title`)}
              >
                {b.title}
              </h3>
              <p
                className="mt-2 text-sm leading-6 text-muted-foreground"
                {...fieldAttrs(annotation, `${path}.items.${index}.body`)}
              >
                {b.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
