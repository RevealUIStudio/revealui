import { Button, GitHubIcon } from '@revealui/presentation';
import { PROOF_SECTION, PROOF_TRUST } from '../../content/proof';
import { SITE } from '../../content/site';
import { LiveMetricsBadge } from './LiveMetricsBadge';

export function Proof() {
  return (
    <section className="bg-background py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            {PROOF_SECTION.eyebrow}
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {PROOF_SECTION.heading}
          </h2>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">{PROOF_SECTION.body}</p>

          <div className="mt-6 flex justify-center">
            <a
              href={SITE.urls.repo}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md bg-card px-3 py-1.5 text-sm font-medium text-foreground ring-1 ring-border hover:ring-border/80 transition"
            >
              <GitHubIcon className="size-4" />
              {PROOF_SECTION.repoLinkLabel}
            </a>
          </div>
        </div>

        <div className="mt-16">
          <LiveMetricsBadge />
        </div>

        <div className="mx-auto mt-16 max-w-2xl text-center">
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

        <div className="mt-12 text-center">
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
    </section>
  );
}
