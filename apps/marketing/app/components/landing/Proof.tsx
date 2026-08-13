import { Button, GitHubIcon, MarketingSection, SectionHeader } from '@revealui/presentation';
import { PROOF_DEPLOYERS, PROOF_SECTION, PROOF_TRUST } from '../../content/proof';
import { SITE } from '../../content/site';
import { LiveMetricsBadge } from './LiveMetricsBadge';

/**
 * Homepage proof band: one story (inspectable open source + live metrics).
 * FDE / Studio handoff is a single quiet footer line (not a second section).
 */
export function Proof() {
  return (
    <MarketingSection tone="background" density="compact" width="default">
      <SectionHeader
        eyebrow={PROOF_SECTION.eyebrow}
        eyebrowTone="muted"
        title={PROOF_SECTION.heading}
        description={PROOF_SECTION.body}
        align="center"
      />

      <div className="mt-8 flex justify-center sm:mt-10">
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

      <div className="mt-8 sm:mt-10">
        <LiveMetricsBadge />
      </div>

      <div className="mx-auto mt-8 max-w-2xl text-center sm:mt-10">
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
        <div className="mt-4">
          <Button
            asChild
            appearance="link"
            size="default"
            className="items-center justify-center text-sm font-medium"
          >
            <a href={PROOF_TRUST.changelogCta.href}>{PROOF_TRUST.changelogCta.label}</a>
          </Button>
        </div>
      </div>

      {/* Single-line handoff (keeps ≤7 sections; no second H3 narrative). */}
      <p className="mx-auto mt-8 max-w-2xl border-t border-border pt-6 text-center text-sm leading-6 text-muted-foreground sm:mt-10">
        {PROOF_DEPLOYERS.body}{' '}
        <a
          href={PROOF_DEPLOYERS.cta.href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
        >
          {PROOF_DEPLOYERS.cta.label}
        </a>
      </p>
    </MarketingSection>
  );
}
