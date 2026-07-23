import { type BlockAnnotation, fieldAttrs } from '@revealui/presentation';
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
    <section className="bg-muted py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-6 lg:px-8">
        <p
          className="text-sm font-semibold uppercase tracking-widest text-muted-foreground"
          {...(base ? fieldAttrs(ann, `${base}.eyebrow`) : {})}
        >
          {content.eyebrow}
        </p>
        <h2
          className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
          {...(base ? fieldAttrs(ann, `${base}.heading`) : {})}
        >
          {content.heading}
        </h2>

        <p
          className="mt-6 text-base leading-7 text-muted-foreground"
          {...(base ? fieldAttrs(ann, `${base}.body`) : {})}
        >
          {content.body}
        </p>

        <p
          className="mt-6 text-base leading-7 text-muted-foreground"
          {...(base ? fieldAttrs(ann, `${base}.items.${introItemIndex}.body`) : {})}
        >
          {content.bulletIntro}
        </p>

        <ul className="mt-4 space-y-3 list-disc pl-6 text-base leading-7 text-muted-foreground marker:text-primary">
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
            <a
              key={link.href}
              href={link.href}
              {...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              className="font-medium text-primary hover:underline underline-offset-4"
              {...(base ? fieldAttrs(ann, `${base}.items.${firstLinkIndex + index}.label`) : {})}
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
