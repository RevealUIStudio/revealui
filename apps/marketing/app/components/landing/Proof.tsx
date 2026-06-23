import { ButtonCVA } from '@revealui/presentation';
import { PROOF_GOVERNANCE } from '../../content/governance';
import {
  PROOF_CI_SIGNALS,
  PROOF_LOCAL_AI,
  PROOF_PORTABILITY,
  PROOF_REPO_SIGNALS,
  PROOF_SECTION,
  PROOF_STACK,
  PROOF_STACK_PANEL,
  PROOF_TRUST,
} from '../../content/proof';
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
        </div>

        {/* Live-metrics snapshot badge (Phase D): gate-pinned counts + validator link. */}
        <div className="mt-16">
          <LiveMetricsBadge />
        </div>

        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Repo signals */}
          <div className="rounded-2xl bg-secondary p-8 ring-1 ring-border">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {PROOF_REPO_SIGNALS.eyebrow}
            </p>
            <h3 className="mt-2 text-xl font-semibold text-foreground">
              {PROOF_REPO_SIGNALS.heading}
            </h3>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href={PROOF_REPO_SIGNALS.repoHref}
                className="inline-flex items-center gap-2 rounded-md bg-card px-3 py-1.5 text-sm font-medium text-foreground ring-1 ring-border hover:ring-border/80 transition"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <title>GitHub</title>
                  <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2c-3.2.7-3.87-1.36-3.87-1.36-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.25 3.34.95.1-.74.4-1.25.72-1.54-2.55-.29-5.24-1.27-5.24-5.66 0-1.25.45-2.27 1.18-3.07-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.17.91-.25 1.89-.38 2.86-.38s1.95.13 2.86.38c2.19-1.48 3.15-1.17 3.15-1.17.62 1.58.23 2.75.11 3.04.74.8 1.18 1.82 1.18 3.07 0 4.4-2.69 5.36-5.25 5.65.41.36.78 1.06.78 2.14v3.18c0 .31.21.67.79.55C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5Z" />
                </svg>
                {/* biome-ignore lint/performance/noImgElement: dynamic shields.io SVG badge, no image optimizer in Vite SPA */}
                <img
                  alt="GitHub stars"
                  src={`https://img.shields.io/github/stars/RevealUIStudio/revealui?style=flat&label=Stars&color=10b981`}
                  className="h-5"
                />
              </a>
              {/* biome-ignore lint/performance/noImgElement: dynamic shields.io SVG badge, no image optimizer in Vite SPA */}
              <img
                alt="Contributors"
                src="https://img.shields.io/github/contributors/RevealUIStudio/revealui?style=flat&label=Contributors&color=10b981"
                className="h-7 rounded-md ring-1 ring-border"
              />
              {/* biome-ignore lint/performance/noImgElement: dynamic shields.io SVG badge, no image optimizer in Vite SPA */}
              <img
                alt="Last commit"
                src="https://img.shields.io/github/last-commit/RevealUIStudio/revealui?style=flat&label=Last%20commit&color=10b981"
                className="h-7 rounded-md ring-1 ring-border"
              />
              {/* biome-ignore lint/performance/noImgElement: dynamic shields.io SVG badge, no image optimizer in Vite SPA */}
              <img
                alt="License"
                src="https://img.shields.io/github/license/RevealUIStudio/revealui?style=flat&color=10b981"
                className="h-7 rounded-md ring-1 ring-border"
              />
            </div>

            <div className="mt-6 border-t border-border pt-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                {PROOF_REPO_SIGNALS.ciLabel}
              </p>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {PROOF_CI_SIGNALS.map((s) => (
                  <li key={s} className="flex items-center gap-2 text-sm text-foreground">
                    <svg
                      className="h-4 w-4 flex-shrink-0 text-primary"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <title>Gate</title>
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Stack standards */}
          <div className="rounded-2xl bg-card p-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">
              {PROOF_STACK_PANEL.eyebrow}
            </p>
            <h3 className="mt-2 text-xl font-semibold text-foreground">
              {PROOF_STACK_PANEL.heading}
            </h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{PROOF_STACK_PANEL.body}</p>

            <ul className="mt-6 grid grid-cols-2 gap-3">
              {PROOF_STACK.map((s) => (
                <li
                  key={s.label}
                  className="rounded-lg bg-secondary px-3 py-2.5 ring-1 ring-border"
                >
                  <div className="text-sm font-semibold text-foreground">{s.label}</div>
                  <div className="text-xs text-muted-foreground">{s.kind}</div>
                </li>
              ))}
            </ul>

            <div className="mt-6 grid grid-cols-1 gap-4 border-t border-border pt-6 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                  {PROOF_PORTABILITY.deployLabel}
                </p>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                  {PROOF_PORTABILITY.deployTargets.join(' · ')}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                  {PROOF_PORTABILITY.dataLabel}
                </p>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                  {PROOF_PORTABILITY.dataNote}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Trust: verifiable in three places */}
        <div className="mx-auto mt-16 max-w-5xl">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              {PROOF_TRUST.eyebrow}
            </p>
            <h3 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {PROOF_TRUST.heading}
            </h3>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {PROOF_TRUST.cards.map((card) => (
              <div
                key={card.title}
                className="flex flex-col rounded-2xl bg-card p-6 ring-1 ring-border"
              >
                <h4 className="text-base font-semibold text-foreground">{card.title}</h4>
                <p className="mt-3 flex-1 text-sm leading-6 text-muted-foreground">{card.body}</p>
                <a
                  href={card.linkHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-block self-start text-sm font-medium text-primary underline decoration-primary/40 underline-offset-4 hover:text-primary/80"
                >
                  {card.linkLabel}
                </a>
              </div>
            ))}
          </div>
        </div>

        {/* Local-AI proof beat: in-boundary by default, dogfooded by RevDev. */}
        <div className="mx-auto mt-16 max-w-5xl">
          <div className="rounded-2xl bg-secondary p-8 ring-1 ring-border">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">
              {PROOF_LOCAL_AI.eyebrow}
            </p>
            <h3 className="mt-2 text-xl font-semibold text-foreground">{PROOF_LOCAL_AI.heading}</h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{PROOF_LOCAL_AI.body}</p>
            <a
              href={PROOF_LOCAL_AI.linkHref}
              className="mt-4 inline-block text-sm font-medium text-primary underline decoration-primary/40 underline-offset-4 hover:text-primary/80"
            >
              {PROOF_LOCAL_AI.linkLabel}
            </a>
          </div>
        </div>

        {/* Governance proof beat (Phase F): read every line + prove what agents did. */}
        <div className="mx-auto mt-6 max-w-5xl">
          <div className="rounded-2xl bg-primary/5 p-8 ring-1 ring-primary/20">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">
              {PROOF_GOVERNANCE.eyebrow}
            </p>
            <h3 className="mt-2 text-xl font-semibold text-foreground">
              {PROOF_GOVERNANCE.heading}
            </h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{PROOF_GOVERNANCE.body}</p>
            <a
              href={PROOF_GOVERNANCE.linkHref}
              className="mt-4 inline-block text-sm font-medium text-primary underline decoration-primary/40 underline-offset-4 hover:text-primary/80"
            >
              {PROOF_GOVERNANCE.linkLabel}
            </a>
          </div>
        </div>

        <div className="mt-12 text-center">
          <ButtonCVA
            asChild
            variant="link"
            size="default"
            className="items-center justify-center text-sm font-medium"
          >
            <a href={PROOF_TRUST.changelogCta.href}>{PROOF_TRUST.changelogCta.label}</a>
          </ButtonCVA>
        </div>
      </div>
    </section>
  );
}
