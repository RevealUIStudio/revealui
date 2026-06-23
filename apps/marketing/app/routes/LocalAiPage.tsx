import { ButtonCVA } from '@revealui/presentation';
import { Footer } from '../components/Footer';
import { FrontierPathway } from '../components/landing/FrontierPathway';
import { ProviderSwitch } from '../components/landing/ProviderSwitch';
import { LOCAL_AI_PAGE, LOCAL_AI_SECTION } from '../content/local-ai';

/**
 * Standalone /local-ai page (positioning decision c: standalone, not folded in).
 * Consolidates the economics, in-boundary sovereignty, and frontier-pathway
 * lines, the §4(c) named-adopter MARKET proof (industry adopters of open/local
 * models, not RevealUI customers), and the air-gap roadmap. The opencode pathway
 * is gated to Phase E (corpus §4.13) and ships there, not here. One primary CTA.
 * Guardrail: ownership stays the lead; local AI is its proof, not a reordering of
 * the locked positioning stack.
 */
export function LocalAiPage() {
  return (
    <div className="min-h-screen bg-background">
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-violet-500/10 px-6 py-24 sm:px-6 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            {LOCAL_AI_PAGE.eyebrow}
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            {LOCAL_AI_PAGE.h1}
          </h1>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">{LOCAL_AI_PAGE.lead}</p>
        </div>
      </section>

      {/* Three pillars: sovereignty, economics, pathway. */}
      <section className="px-6 py-16 sm:py-20 lg:px-8">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-3">
          {LOCAL_AI_PAGE.pillars.map((pillar) => (
            <div key={pillar.title} className="rounded-2xl bg-card p-6 ring-1 ring-border">
              <h2 className="text-lg font-semibold text-foreground">{pillar.title}</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{pillar.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* One-config-line provider snippet, shared with the home section. */}
      <section className="px-6 pb-8 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-2xl bg-foreground p-6 ring-1 ring-background/10">
            <ul className="space-y-2 font-mono text-sm list-none p-0">
              {LOCAL_AI_SECTION.snippet.lines.map((line) => (
                <li
                  key={line.code}
                  className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3"
                >
                  <code className="text-emerald-400">{line.code}</code>
                  <span className="text-background/60"># {line.note}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{LOCAL_AI_SECTION.snippet.caption}</p>
        </div>
      </section>

      {/* Provider-switch interactive + frontier-pathway visual (Phase D). */}
      <section className="px-6 pb-8 lg:px-8">
        <ProviderSwitch />
        <FrontierPathway />
      </section>

      {/* §4(c) market proof: industry adopters of open/local models, not customers. */}
      <section className="px-6 py-16 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">
            {LOCAL_AI_PAGE.marketProof.eyebrow}
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {LOCAL_AI_PAGE.marketProof.heading}
          </h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            {LOCAL_AI_PAGE.marketProof.body}
          </p>
          <ul className="mt-8 space-y-4 list-none p-0">
            {LOCAL_AI_PAGE.marketProof.adopters.map((adopter) => (
              <li key={adopter.name} className="rounded-xl bg-secondary p-5 ring-1 ring-border">
                <p className="text-base text-foreground">
                  <span className="font-semibold">{adopter.name}</span> {adopter.detail}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{adopter.source}</p>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm italic leading-6 text-muted-foreground">
            {LOCAL_AI_PAGE.marketProof.disclaimer}
          </p>
        </div>
      </section>

      {/* Dogfood proof + honesty qualification + air-gap roadmap. */}
      <section className="px-6 pb-16 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-6">
          <p className="text-base leading-7 text-muted-foreground">{LOCAL_AI_SECTION.dogfood}</p>
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              {LOCAL_AI_PAGE.roadmap.heading}
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {LOCAL_AI_PAGE.roadmap.body}{' '}
              <a
                href={LOCAL_AI_PAGE.roadmap.href}
                className="font-medium text-primary hover:underline"
              >
                See the roadmap
              </a>
              .
            </p>
          </div>
          <p className="border-t border-border pt-6 text-sm leading-6 text-muted-foreground">
            {LOCAL_AI_PAGE.honesty}
          </p>
        </div>
      </section>

      <section className="px-6 pb-24 sm:pb-32 lg:px-8">
        <div className="mx-auto flex max-w-3xl flex-col items-start gap-4 sm:flex-row">
          <ButtonCVA asChild size="lg" variant="primary">
            <a href={LOCAL_AI_PAGE.cta.primary.href}>{LOCAL_AI_PAGE.cta.primary.label}</a>
          </ButtonCVA>
          <ButtonCVA asChild size="lg" variant="outline">
            <a href={LOCAL_AI_PAGE.cta.secondary.href} target="_blank" rel="noopener noreferrer">
              {LOCAL_AI_PAGE.cta.secondary.label}
            </a>
          </ButtonCVA>
        </div>
      </section>

      <Footer />
    </div>
  );
}
