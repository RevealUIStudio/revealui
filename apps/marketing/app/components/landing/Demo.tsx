import {
  type BlockAnnotation,
  fieldAttrs,
  MarketingSection,
  SectionHeader,
} from '@revealui/presentation';
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
    <MarketingSection
      id="demo"
      tone="secondary"
      density="default"
      width="default"
      className="relative"
    >
      <SectionHeader
        eyebrow={<span {...fieldAttrs(annotation, `${path}.eyebrow`)}>{data.eyebrow}</span>}
        eyebrowTone="muted"
        title={<span {...fieldAttrs(annotation, `${path}.heading`)}>{data.heading}</span>}
        description={<span {...fieldAttrs(annotation, `${path}.body`)}>{data.body}</span>}
        align="center"
      />

      {/* Product-as-proof: live component frame (Linear craft pattern).
          Content mockupCaption was previously unwired; honesty line stays. */}
      <div className="mt-12 sm:mt-14">
        <ProductFrame caption={HOME_DEMO.mockupCaption} />
      </div>

      {/* Beats as aligned stack, not three bordered cards (Linear: density over chrome). */}
      <ol className="mx-auto mt-12 grid max-w-5xl list-none grid-cols-1 gap-0 divide-y divide-border border-y border-border p-0 sm:mt-14 lg:grid-cols-3 lg:gap-0 lg:divide-x lg:divide-y-0">
        {data.beats.map((b, index) => (
          <li key={b.n} className="relative px-0 py-6 lg:px-8 lg:py-7 first:lg:pl-0 last:lg:pr-0">
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
              className="mt-2 text-sm leading-6 text-body"
              {...fieldAttrs(annotation, `${path}.items.${index}.body`)}
            >
              {b.body}
            </p>
          </li>
        ))}
      </ol>
    </MarketingSection>
  );
}
