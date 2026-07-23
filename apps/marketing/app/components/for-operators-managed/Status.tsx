import { type BlockAnnotation, fieldAttrs } from '@revealui/presentation';
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

        <div className="mt-8 space-y-6 text-base leading-7 text-muted-foreground">
          <p {...(base ? fieldAttrs(ann, `${base}.body`) : {})}>{content.paragraph1}</p>
          <p {...(base ? fieldAttrs(ann, `${base}.items.0.body`) : {})}>{content.paragraph2}</p>
          <p {...(base ? fieldAttrs(ann, `${base}.items.1.body`) : {})}>{content.paragraph3}</p>
        </div>
      </div>
    </section>
  );
}
