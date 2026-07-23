import { Button, GitHubIcon, IconArrowRight, ReceiptCard } from '@revealui/presentation';
import { Link, useLocation } from '@revealui/router';
import { FOR_OPERATORS_HERO } from '../../content/for-operators';
import {
  RECEIPT_HERO_CAPTION,
  RECEIPT_HERO_INTEGRITY,
  RECEIPT_HERO_LINES,
  RECEIPT_HERO_TITLE,
} from '../../content/receipt';
import { selectAudience } from '../../lib/audience';
import { selectHomeHero } from '../../lib/hero-variant';
import { AudienceToggle } from './AudienceToggle';

// Shared trust strip (the signals the retired eyebrow pill used to carry).
// Rendered above BOTH hero H1 variants and for both audiences, so the
// "Local-first AI" chip lands without forking the ?hero=foundation A/B or
// adding a third hero variant (positioning decision d).
const TRUST_SIGNALS = ['Open source', 'Self-hostable', 'Local-first AI'] as const;

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
        {hero.subtitle.sentence1} {hero.subtitle.sentence2} {hero.subtitle.support}
      </p>

      <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
        <Button asChild size="lg" className="w-full sm:w-auto gap-2">
          <a href={hero.cta.primary.href}>
            {hero.cta.primary.label}
            <IconArrowRight size="sm" />
          </a>
        </Button>
        <Button
          asChild
          appearance="outline"
          variant="neutral"
          size="lg"
          className="w-full sm:w-auto gap-2"
        >
          <a href={hero.cta.secondary.href} target="_blank" rel="noopener noreferrer">
            <GitHubIcon className="size-4" />
            {hero.cta.secondary.label}
          </a>
        </Button>
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
        <Button asChild size="lg" className="w-full sm:w-auto gap-2">
          <a href={hero.primaryCta.href} target="_blank" rel="noopener noreferrer">
            {hero.primaryCta.label}
            <IconArrowRight size="sm" />
          </a>
        </Button>
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

        {/* Receipt-motif moment (frontend-excellence Phase 5): one orchestrated
            print entrance, shared verbatim by both audience variants. */}
        <div className="mt-12 w-full max-w-md min-w-0 mx-auto text-left">
          <ReceiptCard
            title={RECEIPT_HERO_TITLE}
            lines={[...RECEIPT_HERO_LINES]}
            integrity={RECEIPT_HERO_INTEGRITY}
            animate="print"
          />
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {RECEIPT_HERO_CAPTION.text}{' '}
            <Link
              to={RECEIPT_HERO_CAPTION.link.href}
              className="text-foreground underline underline-offset-4 hover:text-primary"
            >
              {RECEIPT_HERO_CAPTION.link.label}
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
