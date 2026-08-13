import {
  type BlockAnnotation,
  Button,
  fieldAttrs,
  IconPrimitiveAgents,
  IconPrimitiveContent,
  IconPrimitiveOffers,
  IconPrimitivePayments,
  IconPrimitivePeople,
  type IconProps,
  MarketingSection,
  SectionHeader,
} from '@revealui/presentation';
import type { ComponentType } from 'react';
import { HOME_PRIMITIVES, HOME_PRIMITIVES_SECTION } from '../../content/primitives';
import { PRIMITIVES_FALLBACK_DATA, type PrimitivesData } from '../../lib/page-blocks';

// Accent chips must be surface-relative so they adapt under the token-based
// theme (dark-first; light via system pref OR a manual [data-theme] override).
// We deliberately do NOT use Tailwind `dark:` variants: those are media-based
// and would desync from a manual [data-theme] toggle. brand rides the adaptive
// primary token; the other four keep distinct accent hues at /10–/20 opacity.
const accentBg: Record<string, string> = {
  brand: 'bg-primary/10 text-primary ring-primary/20',
  // legacy alias if CMS still has emerald
  emerald: 'bg-primary/10 text-primary ring-primary/20',
  blue: 'bg-blue-500/10 text-blue-500 ring-blue-500/20',
  amber: 'bg-amber-500/10 text-amber-500 ring-amber-500/20',
  cyan: 'bg-cyan-500/10 text-cyan-500 ring-cyan-500/20',
  violet: 'bg-violet-500/10 text-violet-500 ring-violet-500/20',
};

// Icons ship from @revealui/presentation (Gate 5 move-and-import). Order matches
// HOME_PRIMITIVES / block stream — keyed by index so CMS label renames keep icons.
const PRIMITIVE_ICONS: readonly ComponentType<IconProps>[] = [
  IconPrimitivePeople,
  IconPrimitiveContent,
  IconPrimitiveOffers,
  IconPrimitivePayments,
  IconPrimitiveAgents,
];

const primitiveStyles = HOME_PRIMITIVES.map((p) => ({ color: p.color }));

export interface PrimitivesProps {
  /** Rich section data; defaults to the static content modules (byte-identical). */
  data?: PrimitivesData;
  /** Dot-path of this block's data object within the page array, e.g. `blocks.1.data`. */
  path?: string;
  /** Edit-mode annotation. Inactive by default: emits zero data attributes. */
  annotation?: BlockAnnotation;
}

export function Primitives({
  data = PRIMITIVES_FALLBACK_DATA,
  path = 'blocks.1.data',
  annotation = {},
}: PrimitivesProps) {
  return (
    <MarketingSection tone="background" density="default" width="default">
      <SectionHeader
        eyebrow={<span {...fieldAttrs(annotation, `${path}.eyebrow`)}>{data.eyebrow}</span>}
        eyebrowTone="muted"
        title={<span {...fieldAttrs(annotation, `${path}.heading`)}>{data.heading}</span>}
        description={<span {...fieldAttrs(annotation, `${path}.body`)}>{data.body}</span>}
        align="center"
      />

      {/* Quiet stacked rows (not a card grid). Linear craft: density + alignment
          over decorative cards. Alternating icon side still gives rhythm. */}
      <div className="mx-auto mt-12 max-w-3xl divide-y divide-border border-y border-border sm:mt-14">
        {data.items.map((item, index) => {
          const flipped = index % 2 === 1;
          const style = primitiveStyles[index];
          return (
            <div
              key={item.label}
              className={`flex flex-col gap-4 py-7 sm:items-center sm:gap-8 sm:py-8 ${
                flipped ? 'sm:flex-row-reverse' : 'sm:flex-row'
              }`}
            >
              <div
                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl ring-1 ${style ? accentBg[style.color] : ''}`}
              >
                {(() => {
                  const Icon = PRIMITIVE_ICONS[index];
                  return Icon ? <Icon className="h-7 w-7" size="lg" label={item.label} /> : null;
                })()}
              </div>
              <div className={`flex-1 min-w-0 ${flipped ? 'sm:text-right' : ''}`}>
                <h3
                  className="font-display text-lg font-semibold tracking-tight text-foreground"
                  {...fieldAttrs(annotation, `${path}.items.${index}.label`)}
                >
                  {item.label}
                </h3>
                <p
                  className="mt-1.5 text-base leading-7 text-body"
                  {...fieldAttrs(annotation, `${path}.items.${index}.body`)}
                >
                  {item.body}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-10 text-center">
        <Button
          asChild
          appearance="link"
          size="default"
          className="items-center justify-center text-sm font-medium"
        >
          <a href={HOME_PRIMITIVES_SECTION.docsLink.href}>
            {HOME_PRIMITIVES_SECTION.docsLink.label}
          </a>
        </Button>
      </div>
    </MarketingSection>
  );
}
