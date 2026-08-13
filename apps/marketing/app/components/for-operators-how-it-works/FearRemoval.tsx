import {
  type BlockAnnotation,
  fieldAttrs,
  MarketingSection,
  SectionHeader,
} from '@revealui/presentation';
import { FO_HIW_FEAR } from '../../content/for-operators-how-it-works';
import type { FoHiwFearData } from '../../lib/page-blocks';

interface FearRemovalProps {
  data?: FoHiwFearData;
  path?: string;
  annotation?: BlockAnnotation;
}

export function FearRemoval({ data = FO_HIW_FEAR, path, annotation }: FearRemovalProps) {
  const field = (suffix: string) =>
    annotation && path ? fieldAttrs(annotation, `${path}.${suffix}`) : {};

  // Item layout: paragraph2, then options, then closing (matches foHiwFearBlock).
  const optionStart = 1;
  const closingIndex = optionStart + data.options.length;

  return (
    <MarketingSection tone="secondary" density="default" width="narrow">
      <SectionHeader
        eyebrow={<span {...field('eyebrow')}>{data.eyebrow}</span>}
        eyebrowTone="muted"
        title={<span {...field('heading')}>{data.heading}</span>}
        align="start"
      />

      <p className="mt-8 text-base leading-7 text-body" {...field('body')}>
        {data.paragraph1}
      </p>
      <p className="mt-4 text-base leading-7 text-body" {...field('items.0.body')}>
        {data.paragraph2}
      </p>

      <ul className="mt-6 list-none space-y-4 p-0">
        {data.options.map((option, index) => (
          <li key={option.title} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h3
              className="text-base font-semibold leading-7 text-foreground"
              {...field(`items.${optionStart + index}.title`)}
            >
              {option.title}
            </h3>
            <p
              className="mt-1 text-base leading-7 text-muted-foreground"
              {...field(`items.${optionStart + index}.body`)}
            >
              {option.body}
            </p>
          </li>
        ))}
      </ul>

      <p
        className="mt-8 text-base font-medium leading-7 text-foreground"
        {...field(`items.${closingIndex}.body`)}
      >
        {data.closing}
      </p>
    </MarketingSection>
  );
}
