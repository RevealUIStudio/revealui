import { ButtonCVA } from '@revealui/presentation';
import { LOCAL_AI_SECTION } from '../../content/local-ai';
import { FrontierPathway } from './FrontierPathway';
import { ProviderSwitch } from './ProviderSwitch';

/**
 * Local-first AI home section. Sits between Primitives and Proof in the
 * technical landing. Four beats (sovereignty, economics, pathway, governance),
 * a grep-accurate one-config-line provider snippet, the RevDev dogfood proof,
 * and the required honesty line. Copy is locked to content/local-ai.ts, which
 * tracks the merged Phase B corpus. Ownership stays the lead; this section is
 * its local-AI proof, so it links onward to /local-ai rather than re-leading.
 */
export function LocalAi() {
  return (
    <section className="bg-background py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">
            {LOCAL_AI_SECTION.eyebrow}
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {LOCAL_AI_SECTION.heading}
          </h2>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">{LOCAL_AI_SECTION.body}</p>
        </div>

        <div className="mx-auto mt-16 grid max-w-4xl grid-cols-1 gap-6 sm:grid-cols-2">
          {LOCAL_AI_SECTION.beats.map((beat) => (
            <div key={beat.title} className="rounded-2xl bg-card p-6 ring-1 ring-border">
              <h3 className="text-base font-semibold text-foreground">{beat.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{beat.body}</p>
            </div>
          ))}
        </div>

        {/* Provider-switch interactive + frontier-pathway visual (Phase D). The
            one-config-line snippet itself lives on /local-ai only. */}
        <ProviderSwitch />
        <FrontierPathway />

        <div className="mx-auto mt-10 max-w-3xl space-y-3 text-center">
          <p className="text-sm leading-6 text-muted-foreground">{LOCAL_AI_SECTION.dogfood}</p>
          <p className="text-sm leading-6 text-muted-foreground">{LOCAL_AI_SECTION.honesty}</p>
        </div>

        <div className="mt-10 text-center">
          <ButtonCVA asChild variant="outline" size="lg">
            <a href={LOCAL_AI_SECTION.cta.href}>{LOCAL_AI_SECTION.cta.label}</a>
          </ButtonCVA>
        </div>
      </div>
    </section>
  );
}
