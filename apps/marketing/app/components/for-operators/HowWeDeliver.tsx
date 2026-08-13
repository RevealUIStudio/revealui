import {
  type BlockAnnotation,
  fieldAttrs,
  MarketingSection,
  SectionHeader,
} from '@revealui/presentation';
import { FOR_OPERATORS_HOW_WE_DELIVER } from '../../content/for-operators';
import type { ServicesHowWeDeliverData } from '../../lib/page-blocks';

export interface HowWeDeliverProps {
  readonly data?: ServicesHowWeDeliverData;
  readonly path?: string;
  readonly annotation?: BlockAnnotation;
}

export function HowWeDeliver({ data, path, annotation }: HowWeDeliverProps = {}) {
  const content = data ?? {
    eyebrow: FOR_OPERATORS_HOW_WE_DELIVER.eyebrow,
    heading: FOR_OPERATORS_HOW_WE_DELIVER.heading,
    paragraph1: FOR_OPERATORS_HOW_WE_DELIVER.paragraph1,
    paragraph2: { ...FOR_OPERATORS_HOW_WE_DELIVER.paragraph2 },
    paragraph3: FOR_OPERATORS_HOW_WE_DELIVER.paragraph3,
  };
  const ann = annotation ?? {};
  const base = path ?? '';
  const { eyebrow, heading, paragraph1, paragraph2, paragraph3 } = content;

  return (
    <MarketingSection tone="secondary" density="default" width="narrow">
      <SectionHeader
        eyebrow={base ? <span {...fieldAttrs(ann, `${base}.eyebrow`)}>{eyebrow}</span> : eyebrow}
        eyebrowTone="muted"
        title={base ? <span {...fieldAttrs(ann, `${base}.heading`)}>{heading}</span> : heading}
        align="start"
      />

      <div className="mt-12 space-y-6 text-base leading-7 text-body sm:mt-14">
        <p {...(base ? fieldAttrs(ann, `${base}.body`) : {})}>{paragraph1}</p>
        <p>
          <span {...(base ? fieldAttrs(ann, `${base}.items.0.body`) : {})}>
            {paragraph2.before}
          </span>
          <a
            href={paragraph2.linkHref}
            className="font-medium text-primary underline-offset-4 hover:underline"
            {...(base ? fieldAttrs(ann, `${base}.items.1.body`) : {})}
          >
            {paragraph2.linkLabel}
          </a>
          <span {...(base ? fieldAttrs(ann, `${base}.items.2.body`) : {})}>{paragraph2.after}</span>
        </p>
        <p {...(base ? fieldAttrs(ann, `${base}.items.3.body`) : {})}>{paragraph3}</p>
      </div>
    </MarketingSection>
  );
}
