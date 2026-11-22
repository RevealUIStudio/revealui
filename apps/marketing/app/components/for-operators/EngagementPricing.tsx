import {
  type BlockAnnotation,
  Button,
  fieldAttrs,
  MarketingSection,
  SectionHeader,
} from '@revealui/presentation';
import { FOR_OPERATORS_PRICING } from '../../content/for-operators';
import type { ServicesPricingIntroData } from '../../lib/page-blocks';

export interface EngagementPricingProps {
  /**
   * CMS-driven section header. The section links to revealuistudio.com.
   * Studio prices stay in contracts, not on this product surface.
   */
  readonly data?: ServicesPricingIntroData;
  readonly path?: string;
  readonly annotation?: BlockAnnotation;
}

export function EngagementPricing({ data, path, annotation }: EngagementPricingProps = {}) {
  const intro = data ?? {
    eyebrow: FOR_OPERATORS_PRICING.eyebrow,
    heading: FOR_OPERATORS_PRICING.heading,
    body: FOR_OPERATORS_PRICING.body,
  };
  const ann = annotation ?? {};
  const base = path ?? '';

  return (
    <MarketingSection tone="background" density="default" width="default">
      <SectionHeader
        eyebrow={
          base ? (
            <span {...fieldAttrs(ann, `${base}.eyebrow`)}>{intro.eyebrow}</span>
          ) : (
            intro.eyebrow
          )
        }
        eyebrowTone="muted"
        title={
          base ? (
            <span {...fieldAttrs(ann, `${base}.heading`)}>{intro.heading}</span>
          ) : (
            intro.heading
          )
        }
        description={
          base ? <span {...fieldAttrs(ann, `${base}.body`)}>{intro.body}</span> : intro.body
        }
        align="center"
      />

      <div className="mt-12 flex justify-center sm:mt-14">
        <Button asChild size="lg">
          <a href={FOR_OPERATORS_PRICING.primaryCta.href} target="_blank" rel="noopener noreferrer">
            {FOR_OPERATORS_PRICING.primaryCta.label}
          </a>
        </Button>
      </div>
    </MarketingSection>
  );
}
