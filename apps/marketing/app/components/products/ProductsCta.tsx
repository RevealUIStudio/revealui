import {
  type BlockAnnotation,
  fieldAttrs,
  MarketingSection,
  SectionHeader,
} from '@revealui/presentation';
import { PRODUCTS_CTA_SECTION } from '../../content/products';
import type { ProductsCtaData } from '../../lib/page-blocks';

export interface ProductsCtaProps {
  /** Rich CTA data; defaults to the static content module (byte-identical). */
  data?: ProductsCtaData;
  /** Dot-path of this block's data object within the page array, e.g. `blocks.1.data`. */
  path?: string;
  /** Edit-mode annotation. Inactive by default: emits zero data attributes. */
  annotation?: BlockAnnotation;
}

export function ProductsCta({
  data = PRODUCTS_CTA_SECTION,
  path = 'blocks.1.data',
  annotation = {},
}: ProductsCtaProps) {
  return (
    <MarketingSection tone="background" density="default" width="narrow">
      <SectionHeader
        title={<span {...fieldAttrs(annotation, `${path}.heading`)}>{data.heading}</span>}
        description={<span {...fieldAttrs(annotation, `${path}.body`)}>{data.body}</span>}
        align="center"
      />
      <div
        className="mt-8 rounded-lg bg-foreground px-6 py-4 text-left font-mono text-sm text-background"
        {...fieldAttrs(annotation, `${path}.snippet.lines`)}
      >
        <span className="text-background/50">$</span> {data.cliSnippet}
      </div>
      <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
        <a
          href={data.cta.docs.href}
          className="rounded-md bg-primary px-8 py-4 text-base font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          {data.cta.docs.label}
        </a>
        <a
          href={data.cta.pricing.href}
          className="rounded-md bg-secondary px-8 py-4 text-base font-semibold text-foreground transition-colors hover:bg-muted"
        >
          {data.cta.pricing.label}
        </a>
      </div>
    </MarketingSection>
  );
}
