import {
  type BlockAnnotation,
  fieldAttrs,
  IconPlus,
  MarketingSection,
  SectionHeader,
} from '@revealui/presentation';
import { HOME_FAQ } from '../../content/home';
import type { FaqData } from '../../lib/page-blocks';

export interface FaqProps {
  /** Rich FAQ data; defaults to the static content module (byte-identical). */
  data?: FaqData;
  /** Dot-path of this block's data object within the page array, e.g. `blocks.1.data`. */
  path?: string;
  /** Edit-mode annotation. Inactive by default: emits zero data attributes. */
  annotation?: BlockAnnotation;
}

export function Faq({ data = HOME_FAQ, path = 'blocks.1.data', annotation = {} }: FaqProps) {
  return (
    <MarketingSection id="faq" tone="background" density="default" width="default">
      <SectionHeader
        eyebrow={<span {...fieldAttrs(annotation, `${path}.eyebrow`)}>{data.eyebrow}</span>}
        eyebrowTone="muted"
        title={<span {...fieldAttrs(annotation, `${path}.heading`)}>{data.heading}</span>}
        align="center"
      />

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
                <IconPlus size="sm" label="Toggle" />
              </span>
            </summary>
            <div
              className="mt-4 pr-9 text-base leading-7 text-body"
              {...fieldAttrs(annotation, `${path}.items.${index}.body`)}
            >
              {item.answer}
            </div>
          </details>
        ))}
      </div>
    </MarketingSection>
  );
}
