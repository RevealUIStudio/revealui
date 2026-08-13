import {
  type BlockAnnotation,
  Button,
  fieldAttrs,
  IconArrowRight,
  MarketingSection,
  SectionHeader,
} from '@revealui/presentation';
import { HOME_GET_STARTED } from '../content/home';
import type { GetStartedData } from '../lib/page-blocks';
import { NewsletterSignup } from './NewsletterSignup';

export interface GetStartedProps {
  /** Rich CTA data; defaults to the static content module (byte-identical). */
  data?: GetStartedData;
  /** Dot-path of this block's data object within the page array, e.g. `blocks.1.data`. */
  path?: string;
  /** Edit-mode annotation. Inactive by default: emits zero data attributes. */
  annotation?: BlockAnnotation;
}

export function GetStarted({
  data = HOME_GET_STARTED,
  path = 'blocks.1.data',
  annotation = {},
}: GetStartedProps) {
  return (
    <MarketingSection
      tone="background"
      density="default"
      width="default"
      className="border-t border-border"
    >
      <SectionHeader
        title={<span {...fieldAttrs(annotation, `${path}.heading`)}>{data.heading}</span>}
        description={<span {...fieldAttrs(annotation, `${path}.body`)}>{data.body}</span>}
        align="center"
      />

      <div className="mx-auto max-w-2xl text-center">
        <div className="mt-12 flex flex-col items-center justify-center gap-3 sm:mt-14 sm:flex-row sm:gap-4">
          <Button asChild size="lg" variant="brand" glow>
            <a href={data.cta.primary.href}>{data.cta.primary.label}</a>
          </Button>
          <Button asChild appearance="outline" variant="neutral" size="lg">
            <a href={data.cta.secondary.href}>
              {data.cta.secondary.label}
              <IconArrowRight size="sm" className="ml-1.5" />
            </a>
          </Button>
        </div>

        {/* CLI quick-start, moved here from the hero (frontend-excellence
            Phase 1 hero declutter). */}
        <div
          className="mt-8 inline-flex items-center gap-3 rounded-xl bg-foreground px-5 py-3 font-mono text-sm shadow-lg ring-1 ring-background/10"
          {...fieldAttrs(annotation, `${path}.snippet.lines`)}
        >
          <span className="select-none text-background/50">$</span>
          {data.cli.command.map((token, index) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: static, order-fixed command tokens
              key={index}
              className={
                index === 0
                  ? 'text-emerald-400' // adherence-ignore: emerald-utility - apps/marketing/app/index.css:80-92 remaps emerald-* to cobalt oklch values (Cobalt v5 palette remap); renders cobalt today, zero visual change
                  : index === data.cli.command.length - 1
                    ? 'text-primary'
                    : 'text-background'
              }
            >
              {token}
            </span>
          ))}
        </div>
        <p
          className="mt-4 text-sm text-muted-foreground"
          {...fieldAttrs(annotation, `${path}.snippet.caption`)}
        >
          {data.cli.caption}
        </p>

        <div className="mt-12 border-t border-border pt-10 sm:mt-14">
          <p className="mb-4 text-sm font-medium text-muted-foreground">{data.newsletter.label}</p>
          <NewsletterSignup variant="stacked" />
        </div>
      </div>
    </MarketingSection>
  );
}
