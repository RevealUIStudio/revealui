import {
  type BlockAnnotation,
  Button,
  fieldAttrs,
  MarketingSection,
  SectionHeader,
} from '@revealui/presentation';
import { FO_MANAGED_TODAY } from '../../content/for-operators-managed';
import type { FoManagedTodayData } from '../../lib/page-blocks';

export interface FoManagedTodayProps {
  readonly data?: FoManagedTodayData;
  readonly path?: string;
  readonly annotation?: BlockAnnotation;
}

export function Today({ data, path, annotation }: FoManagedTodayProps = {}) {
  const content = data ?? {
    eyebrow: FO_MANAGED_TODAY.eyebrow,
    heading: FO_MANAGED_TODAY.heading,
    body: FO_MANAGED_TODAY.body,
    primaryCta: FO_MANAGED_TODAY.primaryCta,
    detailLink: FO_MANAGED_TODAY.detailLink,
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

      <div className="mt-12 flex flex-col items-center gap-4 sm:mt-14">
        <Button asChild size="lg">
          <a
            href={content.primaryCta.href}
            {...(content.primaryCta.external
              ? { target: '_blank', rel: 'noopener noreferrer' }
              : {})}
            {...(base ? fieldAttrs(ann, `${base}.items.0.label`) : {})}
          >
            {content.primaryCta.label}
          </a>
        </Button>
        <p className="text-sm">
          <a
            href={content.detailLink.href}
            className="font-medium text-primary underline-offset-4 hover:underline"
            {...(base ? fieldAttrs(ann, `${base}.items.1.label`) : {})}
          >
            {content.detailLink.label}
          </a>
        </p>
      </div>
    </MarketingSection>
  );
}
