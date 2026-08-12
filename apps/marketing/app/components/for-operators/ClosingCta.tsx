import {
  type BlockAnnotation,
  Button,
  fieldAttrs,
  MarketingSection,
  SectionHeader,
} from '@revealui/presentation';
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
    <MarketingSection tone="secondary" density="default" width="narrow">
      <SectionHeader
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

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <span {...(base ? fieldAttrs(ann, `${base}.snippet.lines.0`) : {})}>
          {content.emailFallback.prefix}
        </span>
        <a
          href={`mailto:${content.emailFallback.address}`}
          className="font-medium text-primary underline-offset-4 hover:underline"
          {...(base ? fieldAttrs(ann, `${base}.snippet.lines.1`) : {})}
        >
          {content.emailFallback.address}
        </a>
        <span {...(base ? fieldAttrs(ann, `${base}.snippet.lines.2`) : {})}>
          {content.emailFallback.suffix}
        </span>
      </p>
    </MarketingSection>
  );
}
