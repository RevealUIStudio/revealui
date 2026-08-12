import { type BlockAnnotation, Button, fieldAttrs } from '@revealui/presentation';
import { FOR_OPERATORS_CLOSING } from '../../content/for-operators';
import type { ServicesCtaData } from '../../lib/page-blocks';

export interface ClosingCtaProps {
  readonly data?: ServicesCtaData;
  readonly path?: string;
  readonly annotation?: BlockAnnotation;
}

export function ClosingCta({ data, path, annotation }: ClosingCtaProps = {}) {
  const content = data ?? {
    heading: FOR_OPERATORS_CLOSING.heading,
    body: FOR_OPERATORS_CLOSING.body,
    primaryCta: FOR_OPERATORS_CLOSING.primaryCta,
    emailFallback: { ...FOR_OPERATORS_CLOSING.emailFallback },
  };
  const ann = annotation ?? {};
  const base = path ?? '';

  return (
    <section className="bg-muted py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-6 text-center lg:px-8">
        <h2
          className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
          {...(base ? fieldAttrs(ann, `${base}.heading`) : {})}
        >
          {content.heading}
        </h2>
        <p
          className="mx-auto mt-6 max-w-2xl text-base leading-7 text-body"
          {...(base ? fieldAttrs(ann, `${base}.body`) : {})}
        >
          {content.body}
        </p>

        <div className="mt-10 flex justify-center">
          <Button asChild size="lg" glow>
            <a
              href={content.primaryCta.href}
              {...(content.primaryCta.external
                ? { target: '_blank', rel: 'noopener noreferrer' }
                : {})}
              {...(base ? fieldAttrs(ann, `${base}.links.0.label`) : {})}
            >
              {content.primaryCta.label}
            </a>
          </Button>
        </div>

        <p className="mt-6 text-sm text-muted-foreground">
          <span {...(base ? fieldAttrs(ann, `${base}.snippet.lines.0`) : {})}>
            {content.emailFallback.prefix}
          </span>
          <a
            href={`mailto:${content.emailFallback.address}`}
            className="font-medium text-primary hover:underline underline-offset-4"
            {...(base ? fieldAttrs(ann, `${base}.snippet.lines.1`) : {})}
          >
            {content.emailFallback.address}
          </a>
          <span {...(base ? fieldAttrs(ann, `${base}.snippet.lines.2`) : {})}>
            {content.emailFallback.suffix}
          </span>
        </p>
      </div>
    </section>
  );
}
