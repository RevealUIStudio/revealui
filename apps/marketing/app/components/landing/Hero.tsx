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
// Rendered for both audiences. Separators (not brand dots) keep chrome quiet —
// Linear craft: limit decoration; hierarchy from type weight and spacing.
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
      <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.04] via-background to-background" />
      <div className="absolute -top-32 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,var(--color-primary),transparent_70%)] opacity-[0.12] blur-3xl" />
    </div>
  );
}

/** Trust strip: vertical rules between labels, no brand-dot decoration. */
function TrustStrip() {
  return (
    <ul className="mt-8 flex flex-wrap items-center justify-center gap-y-2 text-sm text-body list-none p-0">
      {TRUST_SIGNALS.map((signal, index) => (
        <li key={signal} className="flex items-center">
          {index > 0 ? (
            <span aria-hidden="true" className="mx-3 h-3 w-px bg-border-strong sm:mx-4" />
          ) : null}
          <span>{signal}</span>
        </li>
      ))}
    </ul>
  );
}

/** Technical hero: the canonical developer-facing pitch (CLI, GitHub, positioning). */
function TechnicalHero({ hero }: { hero: ReturnType<typeof selectHomeHero> }) {
  return (
    <>
      {/*
        Type ladder (P0 craft):
        - H1 = text-foreground (ink, max contrast)
        - subtitle = text-body (rvui-text-1) for long reading, not muted
        - trust / captions = muted only when meta
        SwipePages/SaaS LPs fail when body is grey-on-paper; text-body clears AA.
      */}
      <h1 className="font-display text-[2.75rem] font-extrabold leading-[1.05] tracking-tighter text-foreground text-balance sm:text-6xl lg:text-7xl">
        {hero.h1}
      </h1>

      <p className="mx-auto mt-7 max-w-2xl text-lg leading-8 text-body sm:mt-8 sm:text-xl">
        {hero.subtitle.sentence1} {hero.subtitle.sentence2} {hero.subtitle.support}
      </p>

      <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3 sm:mt-10 sm:gap-4">
        <Button asChild size="lg" glow className="w-full sm:w-auto gap-2">
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

      <TrustStrip />
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
      <h1 className="font-display text-[2.75rem] font-extrabold leading-[1.05] tracking-tighter text-foreground text-balance sm:text-6xl lg:text-7xl">
        {hero.h1Lines.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </h1>

      <p className="mx-auto mt-7 max-w-2xl text-lg leading-8 text-body sm:mt-8 sm:text-xl">
        {hero.subtitle}
      </p>

      <div className="mt-9 flex justify-center sm:mt-10">
        <Button asChild size="lg" glow className="w-full sm:w-auto gap-2">
          <a href={hero.primaryCta.href} target="_blank" rel="noopener noreferrer">
            {hero.primaryCta.label}
            <IconArrowRight size="sm" />
          </a>
        </Button>
      </div>

      <TrustStrip />
    </>
  );
}

export function Hero() {
  const { search } = useLocation();
  const audience = selectAudience(search);
  const hero = selectHomeHero(search);

  return (
    <section className="relative isolate overflow-hidden bg-background px-6 pt-16 pb-16 sm:px-6 sm:pt-24 sm:pb-20 lg:px-8">
      <HeroBackground />

      <div className="relative mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center">
          {/* Audience switch: replaces the former eyebrow pill. */}
          <div className="mb-7 flex justify-center sm:mb-8">
            <AudienceToggle current={audience} />
          </div>

          {audience === 'technical' ? <TechnicalHero hero={hero} /> : <NonTechnicalHero />}
        </div>

        {/* Receipt-motif moment (frontend-excellence Phase 5): one orchestrated
            print entrance, shared verbatim by both audience variants. */}
        <div className="mt-12 w-full max-w-md min-w-0 mx-auto text-left sm:mt-14 sm:max-w-lg">
          <ReceiptCard
            title={RECEIPT_HERO_TITLE}
            lines={[...RECEIPT_HERO_LINES]}
            integrity={RECEIPT_HERO_INTEGRITY}
            animate="print"
          />
          <p className="mt-4 text-center text-sm text-body">
            {RECEIPT_HERO_CAPTION.text}{' '}
            <Link
              to={RECEIPT_HERO_CAPTION.link.href}
              className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
            >
              {RECEIPT_HERO_CAPTION.link.label}
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
