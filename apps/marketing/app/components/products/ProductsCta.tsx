import { type BlockAnnotation, fieldAttrs } from '@revealui/presentation';
import { PRODUCTS_CTA_SECTION } from '../../content/products';
import type { ProductsCtaData } from '../../lib/page-blocks';

export interface ProductsCtaProps {
  /** Rich CTA data; defaults to the static content module (byte-identical). */
  data?: ProductsCtaData;
  /** Dot-path base of this block within the page array, e.g. `blocks.1`. */
  path?: string;
  /** Edit-mode annotation. Inactive by default: emits zero data attributes. */
  annotation?: BlockAnnotation;
}

export function ProductsCta({
  data = PRODUCTS_CTA_SECTION,
  path = 'blocks.1',
  annotation = {},
}: ProductsCtaProps) {
  return (
    <section className="py-24 sm:py-32">
      <div className="mx-auto max-w-2xl px-6 text-center lg:px-8">
        <h2
          className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
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
        <div
          className="mt-8 rounded-lg bg-foreground px-6 py-4 text-left font-mono text-sm text-background"
          {...fieldAttrs(annotation, `${path}.snippet.lines`)}
        >
          <span className="text-background/50">$</span> {data.cliSnippet}
        </div>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href={data.cta.docs.href}
            className="rounded-md bg-primary px-8 py-4 text-base font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
          >
            {data.cta.docs.label}
          </a>
          <a
            href={data.cta.pricing.href}
            className="rounded-md bg-secondary px-8 py-4 text-base font-semibold text-foreground hover:bg-muted transition-colors"
          >
            {data.cta.pricing.label}
          </a>
        </div>
      </div>
    </section>
  );
}
