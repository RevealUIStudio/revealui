import { type BlockAnnotation, Button, fieldAttrs } from '@revealui/presentation';
import { FO_HIW_CLOSING } from '../../content/for-operators-how-it-works';
import type { FoHiwCtaData } from '../../lib/page-blocks';

interface ClosingCtaProps {
  data?: FoHiwCtaData;
  path?: string;
  annotation?: BlockAnnotation;
}

export function ClosingCta({
  data = {
    heading: FO_HIW_CLOSING.heading,
    body: FO_HIW_CLOSING.body,
    primaryCta: FO_HIW_CLOSING.primaryCta,
    backLink: FO_HIW_CLOSING.backLink,
  },
  path,
  annotation,
}: ClosingCtaProps) {
  const field = (suffix: string) =>
    annotation && path ? fieldAttrs(annotation, `${path}.${suffix}`) : {};

  return (
    <section className="bg-background py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-6 text-center lg:px-8">
        <h2
          className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
          {...field('heading')}
        >
          {data.heading}
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-body" {...field('body')}>
          {data.body}
        </p>

        <div className="mt-10 flex justify-center">
          <Button asChild size="lg" glow>
            <a
              href={data.primaryCta.href}
              {...(data.primaryCta.external
                ? { target: '_blank', rel: 'noopener noreferrer' }
                : {})}
              {...field('links.0.label')}
            >
              {data.primaryCta.label}
            </a>
          </Button>
        </div>

        <p className="mt-6 text-sm text-muted-foreground">
          <a
            href={data.backLink.href}
            className="hover:text-foreground transition-colors underline decoration-dotted underline-offset-4"
            {...field('links.1.label')}
          >
            {data.backLink.label}
          </a>
        </p>
      </div>
    </section>
  );
}
