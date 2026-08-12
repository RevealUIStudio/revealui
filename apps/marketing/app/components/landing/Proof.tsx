import { Button, GitHubIcon } from '@revealui/presentation';
import { PROOF_DEPLOYERS, PROOF_SECTION, PROOF_TRUST } from '../../content/proof';
import { SITE } from '../../content/site';
import { LiveMetricsBadge } from './LiveMetricsBadge';

export function Proof() {
  return (
    <section className="bg-background py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {PROOF_SECTION.eyebrow}
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {PROOF_SECTION.heading}
          </h2>
          <p className="mt-5 text-lg leading-8 text-muted-foreground">{PROOF_SECTION.body}</p>

          <div className="mt-6 flex justify-center">
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
        </div>

        <div className="mt-14 sm:mt-16">
          <LiveMetricsBadge />
        </div>

        <div className="mx-auto mt-12 max-w-2xl text-center">
          <p className="text-base leading-7 text-muted-foreground">
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
        <div className="mx-auto mt-16 max-w-2xl border-t border-border pt-14 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {PROOF_DEPLOYERS.eyebrow}
          </p>
          <h3 className="mt-3 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {PROOF_DEPLOYERS.heading}
          </h3>
          <p className="mt-4 text-base leading-7 text-muted-foreground">{PROOF_DEPLOYERS.body}</p>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">{PROOF_DEPLOYERS.foil}</p>
          <div className="mt-8">
            <Button asChild size="default" className="items-center justify-center">
              <a href={PROOF_DEPLOYERS.cta.href} target="_blank" rel="noopener noreferrer">
                {PROOF_DEPLOYERS.cta.label}
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
