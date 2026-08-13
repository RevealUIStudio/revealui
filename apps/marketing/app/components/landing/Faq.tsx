import {
  Accordion,
  AccordionItem,
  type BlockAnnotation,
  fieldAttrs,
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

      <Accordion className="mx-auto mt-12 max-w-3xl border-t border-border sm:mt-14">
        {data.items.map((item, index) => (
          <AccordionItem
            key={item.question}
            title={
              <span
                className="text-lg font-semibold leading-7 text-foreground"
                {...fieldAttrs(annotation, `${path}.items.${index}.label`)}
              >
                {item.question}
              </span>
            }
          >
            <p
              className="pr-2 text-base leading-7 text-body"
              {...fieldAttrs(annotation, `${path}.items.${index}.body`)}
            >
              {item.answer}
            </p>
          </AccordionItem>
        ))}
      </Accordion>
    </MarketingSection>
  );
}
