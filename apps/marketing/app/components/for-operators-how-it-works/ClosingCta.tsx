import {
  type BlockAnnotation,
  Button,
  fieldAttrs,
  MarketingSection,
  SectionHeader,
} from '@revealui/presentation';
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
    <MarketingSection tone="background" density="default" width="narrow">
      <SectionHeader
        title={<span {...field('heading')}>{data.heading}</span>}
        description={<span {...field('body')}>{data.body}</span>}
        align="center"
      />

      <div className="mt-12 flex justify-center sm:mt-14">
        <Button asChild size="lg" glow>
          <a
            href={data.primaryCta.href}
            {...(data.primaryCta.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            {...field('links.0.label')}
          >
            {data.primaryCta.label}
          </a>
        </Button>
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <a
          href={data.backLink.href}
          className="underline decoration-dotted underline-offset-4 transition-colors hover:text-foreground"
          {...field('links.1.label')}
        >
          {data.backLink.label}
        </a>
      </p>
    </MarketingSection>
  );
}
