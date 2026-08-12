import { type BlockAnnotation, fieldAttrs } from '@revealui/presentation';
import { PRODUCTS_FLAGSHIP, PRODUCTS_PAGE_HERO, PRODUCTS_SISTERS } from '../../content/products';
import type { ProductsHeroData } from '../../lib/page-blocks';

// Anchor chips are derived from the product roster, not block-driven prose.
const ALL_PRODUCT_ANCHORS = [
  { slug: PRODUCTS_FLAGSHIP.slug, name: PRODUCTS_FLAGSHIP.name },
  ...PRODUCTS_SISTERS.map((p) => ({ slug: p.slug, name: p.name })),
] as const;

export interface ProductsHeroProps {
  /** Rich hero data; defaults to the static content module (byte-identical). */
  data?: ProductsHeroData;
  /** Dot-path of this block's data object within the page array, e.g. `blocks.0.data`. */
  path?: string;
  /** Edit-mode annotation. Inactive by default: emits zero data attributes. */
  annotation?: BlockAnnotation;
}

export function ProductsHero({
  data = PRODUCTS_PAGE_HERO,
  path = 'blocks.0.data',
  annotation = {},
}: ProductsHeroProps) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-blue-500/10 px-6 py-24 sm:px-6 sm:py-32 lg:px-8">
      <div className="mx-auto max-w-4xl text-center">
        <h1
          className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl"
          {...fieldAttrs(annotation, `${path}.title`)}
        >
          {data.h1}
        </h1>
        <p
          className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-body sm:text-xl"
          {...fieldAttrs(annotation, `${path}.subtitle`)}
        >
          {data.subtitle}
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-2 text-sm font-medium">
          {ALL_PRODUCT_ANCHORS.map((anchor) => (
            <a
              key={anchor.slug}
              href={`#${anchor.slug}`}
              className="rounded-full bg-card px-4 py-1.5 text-muted-foreground ring-1 ring-border transition-colors hover:bg-primary/10 hover:text-primary hover:ring-primary/30"
            >
              {anchor.name}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
