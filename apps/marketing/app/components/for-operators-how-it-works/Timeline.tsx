import {
  type BlockAnnotation,
  fieldAttrs,
  MarketingSection,
  SectionHeader,
} from '@revealui/presentation';
import { FO_HIW_TIMELINE } from '../../content/for-operators-how-it-works';
import type { FoHiwTimelineData } from '../../lib/page-blocks';

interface TimelineProps {
  data?: FoHiwTimelineData;
  path?: string;
  annotation?: BlockAnnotation;
}

export function Timeline({ data = FO_HIW_TIMELINE, path, annotation }: TimelineProps) {
  const field = (suffix: string) =>
    annotation && path ? fieldAttrs(annotation, `${path}.${suffix}`) : {};

  return (
    <MarketingSection tone="secondary" density="default" width="narrow">
      <SectionHeader
        eyebrow={<span {...field('eyebrow')}>{data.eyebrow}</span>}
        eyebrowTone="muted"
        title={<span {...field('heading')}>{data.heading}</span>}
        align="start"
      />

      <p className="mt-6 text-base leading-7 text-body" {...field('body')}>
        {data.paragraph1}
      </p>
      <p className="mt-4 text-base leading-7 text-body" {...field('items.0.body')}>
        {data.paragraph2}
      </p>
    </MarketingSection>
  );
}
