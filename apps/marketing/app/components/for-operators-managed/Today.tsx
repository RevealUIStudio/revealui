import { type BlockAnnotation, Button, fieldAttrs } from '@revealui/presentation';
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
    <section className="bg-background py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-6 text-center lg:px-8">
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
          className="mx-auto mt-6 max-w-2xl text-base leading-7 text-muted-foreground"
          {...(base ? fieldAttrs(ann, `${base}.body`) : {})}
        >
          {content.body}
        </p>

        <div className="mt-10 flex flex-col items-center gap-4">
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
              className="font-medium text-primary hover:underline underline-offset-4"
              {...(base ? fieldAttrs(ann, `${base}.items.1.label`) : {})}
            >
              {content.detailLink.label}
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
