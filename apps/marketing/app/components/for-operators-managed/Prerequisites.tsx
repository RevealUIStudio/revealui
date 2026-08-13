import {
  type BlockAnnotation,
  fieldAttrs,
  MarketingSection,
  SectionHeader,
} from '@revealui/presentation';
import { FO_MANAGED_PREREQS } from '../../content/for-operators-managed';
import type { FoManagedPrereqsData } from '../../lib/page-blocks';

export interface FoManagedPrereqsProps {
  readonly data?: FoManagedPrereqsData;
  readonly path?: string;
  readonly annotation?: BlockAnnotation;
}

export function Prerequisites({ data, path, annotation }: FoManagedPrereqsProps = {}) {
  const content = data ?? {
    eyebrow: FO_MANAGED_PREREQS.eyebrow,
    heading: FO_MANAGED_PREREQS.heading,
    intro: FO_MANAGED_PREREQS.intro,
    prerequisites: FO_MANAGED_PREREQS.prerequisites.map((p) => ({
      title: p.title,
      body: p.body,
    })),
    closing: FO_MANAGED_PREREQS.closing,
  };
  const ann = annotation ?? {};
  const base = path ?? '';
  const closingIndex = content.prerequisites.length;

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
        description={
          base ? <span {...fieldAttrs(ann, `${base}.body`)}>{content.intro}</span> : content.intro
        }
        align="start"
      />

      <ul className="mt-12 list-none space-y-4 p-0 sm:mt-14">
        {content.prerequisites.map((prereq, index) => (
          <li key={prereq.title} className="rounded-2xl bg-card p-6 ring-1 ring-border">
            <h3
              className="text-base font-semibold leading-7 text-foreground"
              {...(base ? fieldAttrs(ann, `${base}.items.${index}.label`) : {})}
            >
              {prereq.title}
            </h3>
            <p
              className="mt-2 text-base leading-7 text-body"
              {...(base ? fieldAttrs(ann, `${base}.items.${index}.body`) : {})}
            >
              {prereq.body}
            </p>
          </li>
        ))}
      </ul>

      <p
        className="mt-8 text-base font-medium leading-7 text-foreground"
        {...(base ? fieldAttrs(ann, `${base}.items.${closingIndex}.body`) : {})}
      >
        {content.closing}
      </p>
    </MarketingSection>
  );
}
