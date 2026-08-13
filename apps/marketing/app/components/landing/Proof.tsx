import { Button, GitHubIcon, MarketingSection, SectionHeader } from '@revealui/presentation';
import { PROOF_DEPLOYERS, PROOF_SECTION, PROOF_TRUST } from '../../content/proof';
import { SITE } from '../../content/site';
import { LiveMetricsBadge } from './LiveMetricsBadge';

export function Proof() {
  return (
    <MarketingSection tone="background" density="default" width="default">
      <SectionHeader
        eyebrow={PROOF_SECTION.eyebrow}
        eyebrowTone="muted"
        title={PROOF_SECTION.heading}
        description={PROOF_SECTION.body}
        align="center"
      />

      <div className="mt-12 flex justify-center sm:mt-14">
        <a
          href={SITE.urls.repo}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-1.5 text-sm font-medium text-foreground ring-1 ring-border transition hover:ring-border/80"
        >
          <GitHubIcon className="size-4" />
          {PROOF_SECTION.repoLinkLabel}
        </a>
      </div>

      <div className="mt-10 sm:mt-12">
        <LiveMetricsBadge />
      </div>

      <div className="mx-auto mt-10 max-w-2xl text-center sm:mt-12">
        <p className="text-base leading-7 text-body">
          {PROOF_TRUST.body}{' '}
          <a
            href={PROOF_TRUST.linkHref}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline decoration-primary/40 underline-offset-4 hover:text-primary/80"
          >
            {PROOF_TRUST.linkLabel}
          </a>
        </p>
      </div>

      <div className="mt-8 text-center">
        <Button
          asChild
          appearance="link"
          size="default"
          className="items-center justify-center text-sm font-medium"
        >
          <a href={PROOF_TRUST.changelogCta.href}>{PROOF_TRUST.changelogCta.label}</a>
        </Button>
      </div>

      {/* Secondary FDE layer — same homepage section (≤7 rule), not a new section */}
      <div className="mx-auto mt-12 max-w-2xl border-t border-border pt-12 text-center sm:mt-14 sm:pt-14">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {PROOF_DEPLOYERS.eyebrow}
        </p>
        <h3 className="mt-3 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {PROOF_DEPLOYERS.heading}
        </h3>
        <p className="mt-4 text-base leading-7 text-body">{PROOF_DEPLOYERS.body}</p>
        <p className="mt-4 text-sm leading-6 text-body">{PROOF_DEPLOYERS.foil}</p>
        <div className="mt-8">
          <Button asChild size="default" className="items-center justify-center">
            <a href={PROOF_DEPLOYERS.cta.href} target="_blank" rel="noopener noreferrer">
              {PROOF_DEPLOYERS.cta.label}
            </a>
          </Button>
        </div>
      </div>
    </MarketingSection>
  );
}
