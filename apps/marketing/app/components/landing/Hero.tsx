import { ButtonCVA } from '@revealui/presentation';
import { useLocation } from '@revealui/router';
import { FOR_OPERATORS_HERO } from '../../content/for-operators';
import { selectAudience } from '../../lib/audience';
import { selectHomeHero } from '../../lib/hero-variant';
import { AudienceToggle } from './AudienceToggle';

// Shared trust strip (the signals the retired eyebrow pill used to carry).
// Rendered above BOTH hero H1 variants and for both audiences, so the
// "Local-first AI" chip lands without forking the ?hero=foundation A/B or
// adding a third hero variant (positioning decision d).
const TRUST_SIGNALS = ['Open source', 'Self-hostable', 'Local-first AI'] as const;

const ArrowIcon = () => (
  <svg
    className="h-4 w-4"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
    aria-hidden="true"
  >
    <title>Arrow</title>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
  </svg>
);

/**
 * Hero background: one quiet signature background (frontend-excellence Phase 1;
 * ADR 2026-07-10-frontend-design-direction hard rule "kill the 5-blob gradient
 * stack"). A top-down token wash plus a single subtle radial glow, both keyed
 * to `--color-primary` rather than a literal color. Lives inside an
 * overflow-hidden box so the off-canvas offset never creates a scrollbar.
 * Reads in both light and dark.
 */
function HeroBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background" />
      <div className="absolute -top-40 left-1/2 h-[700px] w-[1100px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,var(--color-primary),transparent_70%)] opacity-10 blur-3xl" />
    </div>
  );
}

/** Technical hero: the canonical developer-facing pitch (CLI, GitHub, positioning). */
function TechnicalHero({ hero }: { hero: ReturnType<typeof selectHomeHero> }) {
  return (
    <>
      <h1 className="font-display text-5xl font-extrabold tracking-tighter text-foreground sm:text-6xl lg:text-7xl">
        {hero.h1}
      </h1>

      <p className="mx-auto mt-8 max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
        {hero.subtitle.sentence1} {hero.subtitle.support}
      </p>

      <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
        <ButtonCVA asChild size="lg" className="w-full sm:w-auto gap-2">
          <a href={hero.cta.primary.href}>
            {hero.cta.primary.label}
            <ArrowIcon />
          </a>
        </ButtonCVA>
        <ButtonCVA
          asChild
          appearance="outline"
          variant="neutral"
          size="lg"
          className="w-full sm:w-auto gap-2"
        >
          <a href={hero.cta.secondary.href} target="_blank" rel="noopener noreferrer">
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <title>GitHub</title>
              <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2c-3.2.7-3.87-1.36-3.87-1.36-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.25 3.34.95.1-.74.4-1.25.72-1.54-2.55-.29-5.24-1.27-5.24-5.66 0-1.25.45-2.27 1.18-3.07-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.17.91-.25 1.89-.38 2.86-.38s1.95.13 2.86.38c2.19-1.48 3.15-1.17 3.15-1.17.62 1.58.23 2.75.11 3.04.74.8 1.18 1.82 1.18 3.07 0 4.4-2.69 5.36-5.25 5.65.41.36.78 1.06.78 2.14v3.18c0 .31.21.67.79.55C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5Z" />
            </svg>
            {hero.cta.secondary.label}
          </a>
        </ButtonCVA>
      </div>

      {/* Trust strip: the signals the retired eyebrow pill used to carry. */}
      <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground list-none p-0">
        {TRUST_SIGNALS.map((signal) => (
          <li key={signal} className="flex items-center gap-2">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-primary" />
            {signal}
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * Non-technical hero: the operator-facing pitch. Reuses the /for-operators hero
 * copy and deliberately omits the developer-only surfaces (CLI block, GitHub
 * CTA, ships-today).
 */
function NonTechnicalHero() {
  const hero = FOR_OPERATORS_HERO;
  return (
    <>
      <h1 className="font-display text-5xl font-extrabold tracking-tighter text-foreground sm:text-6xl lg:text-7xl">
        {hero.h1Lines.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </h1>

      <p className="mx-auto mt-8 max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
        {hero.subtitle}
      </p>

      <div className="mt-10 flex justify-center">
        <ButtonCVA asChild size="lg" className="w-full sm:w-auto gap-2">
          <a href={hero.primaryCta.href} target="_blank" rel="noopener noreferrer">
            {hero.primaryCta.label}
            <ArrowIcon />
          </a>
        </ButtonCVA>
      </div>

      {/* Trust strip: mirror of TechnicalHero; same signals for the operator view. */}
      <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground list-none p-0">
        {TRUST_SIGNALS.map((signal) => (
          <li key={signal} className="flex items-center gap-2">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-primary" />
            {signal}
          </li>
        ))}
      </ul>
    </>
  );
}

export function Hero() {
  const { search } = useLocation();
  const audience = selectAudience(search);
  const hero = selectHomeHero(search);

  return (
    <section className="relative isolate overflow-hidden bg-background px-6 pt-20 pb-20 sm:px-6 sm:pt-28 sm:pb-28 lg:px-8">
      <HeroBackground />

      <div className="relative mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center">
          {/* Audience switch: replaces the former eyebrow pill. */}
          <div className="mb-8 flex justify-center">
            <AudienceToggle current={audience} />
          </div>

          {audience === 'technical' ? <TechnicalHero hero={hero} /> : <NonTechnicalHero />}
        </div>
      </div>
    </section>
  );
}
