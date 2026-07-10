import { ButtonCVA } from '@revealui/presentation';
import { Footer } from '../components/Footer';
import { GOVERNANCE_PAGE } from '../content/governance';

/**
 * Standalone /governance page (Phase F). Pairs the governance CAPABILITY
 * (tamper-evident audit + unified RBAC/ABAC over humans AND agents) with the
 * §4(c) regulated-adopter proof. Governance is the sharpened expression of the
 * layer-1 ownership lead, NOT a third pillar. Capability, not certification:
 * no SOC2/ISO/SSO/SCIM claims. One primary CTA.
 */
// index.css:80-92 remaps emerald-* to cobalt oklch values (Cobalt v5 palette
// remap); this renders cobalt today, not emerald.
const HERO_SECTION_CLASS_NAME =
  'relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-emerald-500/10 px-6 py-24 sm:px-6 sm:py-32 lg:px-8'; // adherence-ignore: emerald-utility - zero visual change, see comment above

export function GovernancePage() {
  return (
    <div className="min-h-screen bg-background">
      <section className={HERO_SECTION_CLASS_NAME}>
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            {GOVERNANCE_PAGE.eyebrow}
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            {GOVERNANCE_PAGE.h1}
          </h1>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">{GOVERNANCE_PAGE.lead}</p>
        </div>
      </section>

      {/* The two governance capabilities. */}
      <section className="px-6 py-16 sm:py-20 lg:px-8">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-2">
          {GOVERNANCE_PAGE.capabilities.map((cap) => (
            <div
              key={cap.title}
              className="flex flex-col rounded-2xl bg-card p-8 ring-1 ring-border"
            >
              <h2 className="text-lg font-semibold text-foreground">{cap.title}</h2>
              <p className="mt-3 flex-1 text-sm leading-6 text-muted-foreground">{cap.body}</p>
              <a
                href={cap.linkHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-block self-start text-sm font-medium text-primary underline decoration-primary/40 underline-offset-4 hover:text-primary/80"
              >
                {cap.linkLabel}
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* The governance block (sharpened layer-1 expression). */}
      <section className="px-6 pb-16 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <blockquote className="rounded-2xl bg-primary/5 p-8 text-lg font-medium leading-8 text-foreground ring-1 ring-primary/20">
            {GOVERNANCE_PAGE.block}
          </blockquote>
        </div>
      </section>

      {/* §4(c) regulated-adopter proof (industry adopters, not customers). */}
      <section className="px-6 py-16 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">
            {GOVERNANCE_PAGE.proof.eyebrow}
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {GOVERNANCE_PAGE.proof.heading}
          </h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            {GOVERNANCE_PAGE.proof.body}
          </p>
          <ul className="mt-8 space-y-4 list-none p-0">
            {GOVERNANCE_PAGE.proof.adopters.map((adopter) => (
              <li key={adopter.name} className="rounded-xl bg-secondary p-5 ring-1 ring-border">
                <p className="text-base text-foreground">
                  <span className="font-semibold">{adopter.name}</span> {adopter.detail}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{adopter.source}</p>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm italic leading-6 text-muted-foreground">
            {GOVERNANCE_PAGE.proof.disclaimer}
          </p>
        </div>
      </section>

      {/* Capability-not-certification honesty. */}
      <section className="px-6 pb-16 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <p className="border-t border-border pt-6 text-sm leading-6 text-muted-foreground">
            {GOVERNANCE_PAGE.honesty}
          </p>
        </div>
      </section>

      <section className="px-6 pb-24 sm:pb-32 lg:px-8">
        <div className="mx-auto flex max-w-3xl flex-col items-start gap-4 sm:flex-row">
          <ButtonCVA asChild size="lg" variant="primary">
            <a href={GOVERNANCE_PAGE.cta.primary.href}>{GOVERNANCE_PAGE.cta.primary.label}</a>
          </ButtonCVA>
          <ButtonCVA asChild size="lg" variant="outline">
            <a href={GOVERNANCE_PAGE.cta.secondary.href} target="_blank" rel="noopener noreferrer">
              {GOVERNANCE_PAGE.cta.secondary.label}
            </a>
          </ButtonCVA>
        </div>
      </section>

      <Footer />
    </div>
  );
}
