import { ButtonCVA } from '@revealui/presentation';
import { HOME_GET_STARTED } from '../content/home';
import { NewsletterSignup } from './NewsletterSignup';

export function GetStarted() {
  return (
    <section className="py-24 bg-card sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {HOME_GET_STARTED.heading}
          </h2>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">{HOME_GET_STARTED.body}</p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <ButtonCVA asChild size="lg" variant="brand">
              <a href={HOME_GET_STARTED.cta.primary.href}>{HOME_GET_STARTED.cta.primary.label}</a>
            </ButtonCVA>
            <ButtonCVA asChild appearance="outline" variant="neutral" size="lg">
              <a href={HOME_GET_STARTED.cta.secondary.href}>
                {HOME_GET_STARTED.cta.secondary.label}
                <svg
                  className="h-4 w-4 ml-1.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <title>Arrow</title>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                  />
                </svg>
              </a>
            </ButtonCVA>
          </div>

          {/* CLI quick-start, moved here from the hero (frontend-excellence
              Phase 1 hero declutter). */}
          <div className="mt-8 inline-flex items-center gap-3 rounded-xl bg-foreground px-5 py-3 font-mono text-sm shadow-lg ring-1 ring-background/10">
            <span className="select-none text-background/50">$</span>
            {HOME_GET_STARTED.cli.command.map((token, index) => (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: static, order-fixed command tokens
                key={index}
                className={
                  index === 0
                    ? 'text-emerald-400' // adherence-ignore: emerald-utility - apps/marketing/app/index.css:80-92 remaps emerald-* to cobalt oklch values (Cobalt v5 palette remap); renders cobalt today, zero visual change
                    : index === HOME_GET_STARTED.cli.command.length - 1
                      ? 'text-blue-300'
                      : 'text-background'
                }
              >
                {token}
              </span>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">{HOME_GET_STARTED.cli.caption}</p>

          {/* Newsletter */}
          <div className="mt-16 pt-10 border-t border-border">
            <p className="text-sm font-medium text-muted-foreground mb-4">
              {HOME_GET_STARTED.newsletter.label}
            </p>
            <NewsletterSignup variant="stacked" />
          </div>
        </div>
      </div>
    </section>
  );
}
