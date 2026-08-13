import { Accordion, AccordionItem, MarketingSection, SectionHeader } from '@revealui/presentation';
import { FOR_OPERATORS_FAQ } from '../../content/for-operators';

/**
 * Services FAQ stays component-local (not CMS). The cost answer interpolates
 * engagement ladder prices from contracts; claims-safety forbids prices in blocks.
 */
export function Faq() {
  return (
    <MarketingSection tone="background" density="default" width="default">
      <SectionHeader
        eyebrow={FOR_OPERATORS_FAQ.eyebrow}
        eyebrowTone="muted"
        title={FOR_OPERATORS_FAQ.heading}
        align="center"
      />

      <Accordion className="mx-auto mt-16 max-w-3xl border-t border-border">
        {FOR_OPERATORS_FAQ.items.map((item) => (
          <AccordionItem
            key={item.question}
            title={
              <span className="text-lg font-semibold leading-7 text-foreground">
                {item.question}
              </span>
            }
          >
            <p className="pr-2 text-base leading-7 text-body">{item.answer}</p>
          </AccordionItem>
        ))}
      </Accordion>
    </MarketingSection>
  );
}
