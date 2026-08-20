import {
  type BlockAnnotation,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  fieldAttrs,
  MarketingSection,
  SectionHeader,
} from '@revealui/presentation';
import { FOR_OPERATORS_PRICING } from '../../content/for-operators';
import type { ServicesPricingIntroData } from '../../lib/page-blocks';

export interface EngagementPricingProps {
  /**
   * CMS-driven section header only. Engagement ladder rungs (titles, prices,
   * bodies, CTAs) stay component-local from for-operators + contracts.
   */
  readonly data?: ServicesPricingIntroData;
  readonly path?: string;
  readonly annotation?: BlockAnnotation;
}

export function EngagementPricing({ data, path, annotation }: EngagementPricingProps = {}) {
  const intro = data ?? {
    eyebrow: FOR_OPERATORS_PRICING.eyebrow,
    heading: FOR_OPERATORS_PRICING.heading,
    body: FOR_OPERATORS_PRICING.body,
  };
  const { rungs } = FOR_OPERATORS_PRICING;
  const ann = annotation ?? {};
  const base = path ?? '';

  return (
    <MarketingSection tone="background" density="default" width="default">
      <SectionHeader
        eyebrow={
          base ? (
            <span {...fieldAttrs(ann, `${base}.eyebrow`)}>{intro.eyebrow}</span>
          ) : (
            intro.eyebrow
          )
        }
        eyebrowTone="muted"
        title={
          base ? (
            <span {...fieldAttrs(ann, `${base}.heading`)}>{intro.heading}</span>
          ) : (
            intro.heading
          )
        }
        description={
          base ? <span {...fieldAttrs(ann, `${base}.body`)}>{intro.body}</span> : intro.body
        }
        align="center"
      />

      <ul className="mx-auto mt-12 grid max-w-5xl list-none grid-cols-1 gap-6 p-0 sm:mt-14 lg:grid-cols-3">
        {rungs.map((rung) => (
          <li key={rung.title} className="h-full">
            <Card className="flex h-full flex-col rounded-2xl">
              <CardHeader>
                <CardTitle className="text-lg font-semibold leading-7">{rung.title}</CardTitle>
                <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
                  {rung.price}
                </p>
              </CardHeader>
              <CardContent className="flex-1">
                <p className="text-base leading-7 text-body">{rung.body}</p>
              </CardContent>
              <CardFooter>
                <Button asChild appearance="outline" variant="neutral" className="w-full">
                  <a
                    href={rung.cta.href}
                    {...(rung.cta.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  >
                    {rung.cta.label}
                  </a>
                </Button>
              </CardFooter>
            </Card>
          </li>
        ))}
      </ul>
    </MarketingSection>
  );
}
