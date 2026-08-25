import {
  type BlockAnnotation,
  Button,
  fieldAttrs,
  MarketingSection,
  SectionHeader,
} from '@revealui/presentation';
import { FO_MANAGED_WAITLIST } from '../../content/for-operators-managed';
import type { FoManagedWaitlistData } from '../../lib/page-blocks';

export interface FoManagedWaitlistProps {
  readonly data?: FoManagedWaitlistData;
  readonly path?: string;
  readonly annotation?: BlockAnnotation;
}

/**
 * De-cataloged leftover. Not a Cloud waitlist form. Public door is
 * Enterprise inquire / Contact sales.
 */
export function Waitlist({ data, path, annotation }: FoManagedWaitlistProps = {}) {
  const content = data ?? {
    eyebrow: FO_MANAGED_WAITLIST.eyebrow,
    heading: FO_MANAGED_WAITLIST.heading,
    body: FO_MANAGED_WAITLIST.body,
    inputPlaceholder: FO_MANAGED_WAITLIST.inputPlaceholder,
    buttonLabel: FO_MANAGED_WAITLIST.buttonLabel,
    buttonLabelLoading: FO_MANAGED_WAITLIST.buttonLabelLoading,
    successMessage: FO_MANAGED_WAITLIST.successMessage,
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
        description={
          base ? <span {...fieldAttrs(ann, `${base}.body`)}>{content.body}</span> : content.body
        }
        align="center"
      />
      <div className="mx-auto mt-12 flex max-w-sm justify-center sm:mt-14">
        <Button asChild variant="brand">
          <a href={FO_MANAGED_WAITLIST.href}>
            <span {...(base ? fieldAttrs(ann, `${base}.items.1.body`) : {})}>
              {content.buttonLabel}
            </span>
          </a>
        </Button>
      </div>
    </MarketingSection>
  );
}
