import {
  type BlockAnnotation,
  fieldAttrs,
  MarketingSection,
  SectionHeader,
} from '@revealui/presentation';
import { FO_MANAGED_WOULD_BE } from '../../content/for-operators-managed';
import type { FoManagedWouldBeData } from '../../lib/page-blocks';

export interface FoManagedWouldBeProps {
  readonly data?: FoManagedWouldBeData;
  readonly path?: string;
  readonly annotation?: BlockAnnotation;
}

export function WouldBe({ data, path, annotation }: FoManagedWouldBeProps = {}) {
  const content = data ?? {
    eyebrow: FO_MANAGED_WOULD_BE.eyebrow,
    heading: FO_MANAGED_WOULD_BE.heading,
    capabilities: FO_MANAGED_WOULD_BE.capabilities.map((c) => ({
      title: c.title,
      body: c.body,
    })),
    closing: FO_MANAGED_WOULD_BE.closing,
  };
  const ann = annotation ?? {};
  const base = path ?? '';
  const closingIndex = content.capabilities.length;

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
        align="center"
      />

      <ul className="mx-auto mt-16 grid max-w-4xl list-none grid-cols-1 gap-6 p-0">
        {content.capabilities.map((capability, index) => (
          <li
            key={capability.title}
            className="rounded-2xl border border-border bg-card p-6 shadow-sm"
          >
            <h3
              className="text-lg font-semibold leading-7 text-foreground"
              {...(base ? fieldAttrs(ann, `${base}.items.${index}.label`) : {})}
            >
              {capability.title}
            </h3>
            <p
              className="mt-2 text-base leading-7 text-body"
              {...(base ? fieldAttrs(ann, `${base}.items.${index}.body`) : {})}
            >
              {capability.body}
            </p>
          </li>
        ))}
      </ul>

      <p
        className="mx-auto mt-12 max-w-2xl text-center text-base font-medium leading-7 text-foreground"
        {...(base ? fieldAttrs(ann, `${base}.items.${closingIndex}.body`) : {})}
      >
        {content.closing}
      </p>
    </MarketingSection>
  );
}
