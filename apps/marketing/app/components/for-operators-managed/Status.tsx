import {
  type BlockAnnotation,
  fieldAttrs,
  MarketingSection,
  SectionHeader,
} from '@revealui/presentation';
import { FO_MANAGED_STATUS } from '../../content/for-operators-managed';
import type { FoManagedStatusData } from '../../lib/page-blocks';

export interface FoManagedStatusProps {
  readonly data?: FoManagedStatusData;
  readonly path?: string;
  readonly annotation?: BlockAnnotation;
}

export function Status({ data, path, annotation }: FoManagedStatusProps = {}) {
  const content = data ?? {
    eyebrow: FO_MANAGED_STATUS.eyebrow,
    heading: FO_MANAGED_STATUS.heading,
    paragraph1: FO_MANAGED_STATUS.paragraph1,
    paragraph2: FO_MANAGED_STATUS.paragraph2,
    paragraph3: FO_MANAGED_STATUS.paragraph3,
  };
  const ann = annotation ?? {};
  const base = path ?? '';

  return (
    <MarketingSection tone="secondary" density="default" width="narrow">
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
        align="start"
      />

      <div className="mt-8 space-y-6 text-base leading-7 text-body">
        <p {...(base ? fieldAttrs(ann, `${base}.body`) : {})}>{content.paragraph1}</p>
        <p {...(base ? fieldAttrs(ann, `${base}.items.0.body`) : {})}>{content.paragraph2}</p>
        <p {...(base ? fieldAttrs(ann, `${base}.items.1.body`) : {})}>{content.paragraph3}</p>
      </div>
    </MarketingSection>
  );
}
