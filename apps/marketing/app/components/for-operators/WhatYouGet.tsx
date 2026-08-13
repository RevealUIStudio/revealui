import {
  type BlockAnnotation,
  fieldAttrs,
  MarketingSection,
  SectionHeader,
} from '@revealui/presentation';
import { FOR_OPERATORS_WHAT_YOU_GET } from '../../content/for-operators';
import type { ServicesWhatYouGetData } from '../../lib/page-blocks';
import { CenteredCardGrid } from '../CenteredCardGrid';

export interface WhatYouGetProps {
  readonly data?: ServicesWhatYouGetData;
  readonly path?: string;
  readonly annotation?: BlockAnnotation;
}

export function WhatYouGet({ data, path, annotation }: WhatYouGetProps = {}) {
  const content = data ?? {
    eyebrow: FOR_OPERATORS_WHAT_YOU_GET.eyebrow,
    heading: FOR_OPERATORS_WHAT_YOU_GET.heading,
    body: FOR_OPERATORS_WHAT_YOU_GET.body,
    cards: FOR_OPERATORS_WHAT_YOU_GET.cards.map((c) => ({ title: c.title, body: c.body })),
  };
  const ann = annotation ?? {};
  const base = path ?? '';

  return (
    <MarketingSection tone="background" density="default" width="default">
      <SectionHeader
        eyebrow={
          base ? (
            <span {...fieldAttrs(ann, `${base}.eyebrow`)}>{content.eyebrow}</span>
          ) : (
            content.eyebrow
          )
        }
        eyebrowTone="muted"
        title={
          base ? (
            <span {...fieldAttrs(ann, `${base}.heading`)}>{content.heading}</span>
          ) : (
            content.heading
          )
        }
        description={
          base ? <span {...fieldAttrs(ann, `${base}.body`)}>{content.body}</span> : content.body
        }
        align="center"
      />

      <CenteredCardGrid className="mx-auto mt-16 max-w-5xl">
        {content.cards.map((card, index) => (
          <div
            key={card.title}
            className="w-full rounded-2xl border border-border bg-card p-6 shadow-sm sm:w-[calc(50%-0.75rem)] lg:w-[calc(33.333%-1rem)]"
          >
            <h3
              className="text-lg font-semibold leading-7 text-foreground"
              {...(base ? fieldAttrs(ann, `${base}.items.${index}.label`) : {})}
            >
              {card.title}
            </h3>
            <p
              className="mt-3 text-base leading-7 text-body"
              {...(base ? fieldAttrs(ann, `${base}.items.${index}.body`) : {})}
            >
              {card.body}
            </p>
          </div>
        ))}
      </CenteredCardGrid>
    </MarketingSection>
  );
}
