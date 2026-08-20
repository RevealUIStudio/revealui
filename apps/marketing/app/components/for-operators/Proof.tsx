import {
  type BlockAnnotation,
  fieldAttrs,
  MarketingSection,
  SectionHeader,
  TextLink,
} from '@revealui/presentation';
import { FOR_OPERATORS_PROOF } from '../../content/for-operators';
import type { ServicesProofData } from '../../lib/page-blocks';

export interface ProofProps {
  readonly data?: ServicesProofData;
  readonly path?: string;
  readonly annotation?: BlockAnnotation;
}

export function Proof({ data, path, annotation }: ProofProps = {}) {
  const content = data ?? {
    eyebrow: FOR_OPERATORS_PROOF.eyebrow,
    heading: FOR_OPERATORS_PROOF.heading,
    body: FOR_OPERATORS_PROOF.body,
    bulletIntro: FOR_OPERATORS_PROOF.bulletIntro,
    bullets: [...FOR_OPERATORS_PROOF.bullets],
    links: [...FOR_OPERATORS_PROOF.links],
  };
  const ann = annotation ?? {};
  const base = path ?? '';
  // Block layout: items[0]=bullet-intro, then bullets, then links.
  const introItemIndex = 0;
  const firstBulletIndex = 1;
  const firstLinkIndex = firstBulletIndex + content.bullets.length;

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
        align="start"
      />

      <p
        className="mt-12 text-base leading-7 text-body sm:mt-14"
        {...(base ? fieldAttrs(ann, `${base}.items.${introItemIndex}.body`) : {})}
      >
        {content.bulletIntro}
      </p>

      <ul className="mt-4 list-disc space-y-3 pl-6 text-base leading-7 text-body marker:text-primary">
        {content.bullets.map((bullet, index) => (
          <li
            key={bullet}
            {...(base ? fieldAttrs(ann, `${base}.items.${firstBulletIndex + index}.body`) : {})}
          >
            {bullet}
          </li>
        ))}
      </ul>

      <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {content.links.map((link, index) => (
          <TextLink
            key={link.href}
            href={link.href}
            {...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            className="font-medium text-primary"
            {...(base ? fieldAttrs(ann, `${base}.items.${firstLinkIndex + index}.label`) : {})}
          >
            {link.label}
          </TextLink>
        ))}
      </div>
    </MarketingSection>
  );
}
