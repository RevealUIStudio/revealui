import {
  type BlockAnnotation,
  fieldAttrs,
  MarketingSection,
  SectionHeader,
} from '@revealui/presentation';
import { FOR_OPERATORS_DISCOVERY } from '../../content/for-operators';
import type { ServicesDiscoveryData } from '../../lib/page-blocks';

export interface DiscoveryScopeShipProps {
  readonly data?: ServicesDiscoveryData;
  readonly path?: string;
  readonly annotation?: BlockAnnotation;
}

export function DiscoveryScopeShip({ data, path, annotation }: DiscoveryScopeShipProps = {}) {
  const content = data ?? {
    eyebrow: FOR_OPERATORS_DISCOVERY.eyebrow,
    heading: FOR_OPERATORS_DISCOVERY.heading,
    body: FOR_OPERATORS_DISCOVERY.body,
    link: FOR_OPERATORS_DISCOVERY.link,
  };
  const ann = annotation ?? {};
  const base = path ?? '';

  return (
    <MarketingSection tone="background" density="default" width="narrow">
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
      <p className="mt-12 text-center sm:mt-14">
        <a
          href={content.link.href}
          className="font-medium text-primary underline-offset-4 hover:underline"
          {...(base ? fieldAttrs(ann, `${base}.items.0.label`) : {})}
        >
          {content.link.label}
        </a>
      </p>
    </MarketingSection>
  );
}
