import {
  type BlockAnnotation,
  fieldAttrs,
  MarketingSection,
  SectionHeader,
} from '@revealui/presentation';
import { FO_HIW_OWNERSHIP } from '../../content/for-operators-how-it-works';
import type { FoHiwOwnershipData } from '../../lib/page-blocks';

interface OwnershipProps {
  data?: FoHiwOwnershipData;
  path?: string;
  annotation?: BlockAnnotation;
}

export function Ownership({ data = FO_HIW_OWNERSHIP, path, annotation }: OwnershipProps) {
  const field = (suffix: string) =>
    annotation && path ? fieldAttrs(annotation, `${path}.${suffix}`) : {};

  const diffIndex = data.claims.length;

  return (
    <MarketingSection tone="background" density="default" width="narrow">
      <SectionHeader
        eyebrow={<span {...field('eyebrow')}>{data.eyebrow}</span>}
        eyebrowTone="muted"
        title={<span {...field('heading')}>{data.heading}</span>}
        align="start"
      />

      <p className="mt-6 text-base leading-7 text-body" {...field('body')}>
        {data.intro}
      </p>

      <ul className="mt-6 list-none space-y-4 p-0">
        {data.claims.map((claim, index) => (
          <li key={claim.title} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h3
              className="text-base font-semibold leading-7 text-foreground"
              {...field(`items.${index}.title`)}
            >
              {claim.title}
            </h3>
            <p
              className="mt-1 text-base leading-7 text-muted-foreground"
              {...field(`items.${index}.body`)}
            >
              {claim.body}
            </p>
          </li>
        ))}
      </ul>

      <p
        className="mt-8 text-base font-medium leading-7 text-foreground"
        {...field(`items.${diffIndex}.body`)}
      >
        {data.differentiator}
      </p>
    </MarketingSection>
  );
}
