import {
  Button,
  GitHubIcon,
  IconArrowRight,
  MarketingSection,
  ReceiptCard,
} from '@revealui/presentation';
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
 * Full-bleed hero stage paint (viewport-stage, not content-boxed).
 *
 * Frontend-excellence Phase 1 + ADR 2026-07-10: one quiet signature wash.
 * Painted via MarketingSection `backdrop` so absolute inset-0 is relative to
 * the outer section (full width), not the max-w-7xl content rail.
 *
 * Glow uses svh/vw so it scales phone → ultrawide (no fixed 900×520 halo).
 */
function HeroBackground() {
  return (
    <div
      data-slot="hero-background"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      {/* Edge-to-edge wash across the whole stage */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.07] via-background to-background" />
      {/* Viewport-relative radial — soft top center, not a content-sized blob */}
      <div
        className={[
          'absolute left-1/2 top-0 -translate-x-1/2 -translate-y-[15%]',
          'h-[min(75svh,42rem)] w-[min(140vw,90rem)]',
          'rounded-full',
          'bg-[radial-gradient(closest-side,var(--color-primary),transparent_72%)]',
          'opacity-[0.14] blur-3xl',
        ].join(' ')}
      />
    </div>
  );
}

/** Trust strip: vertical rules between labels, no brand-dot decoration. */
function TrustStrip() {
  return (
    <ul className="mt-8 flex list-none flex-wrap items-center justify-center gap-y-2 p-0 text-sm text-body">
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
      */}
      <h1 className="text-balance font-display text-[2.75rem] font-extrabold leading-[1.05] tracking-tighter text-foreground sm:text-6xl lg:text-7xl">
        {hero.h1}
      </h1>

      <p className="mx-auto mt-7 max-w-2xl text-lg leading-8 text-body sm:mt-8 sm:text-xl">
        {hero.subtitle.sentence1} {hero.subtitle.sentence2} {hero.subtitle.support}
      </p>

      <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:mt-10 sm:flex-row sm:gap-4">
        <Button asChild size="lg" glow className="w-full gap-2 sm:w-auto">
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
          className="w-full gap-2 sm:w-auto"
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
      <h1 className="text-balance font-display text-[2.75rem] font-extrabold leading-[1.05] tracking-tighter text-foreground sm:text-6xl lg:text-7xl">
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
        <Button asChild size="lg" glow className="w-full gap-2 sm:w-auto">
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
    <MarketingSection
      tone="background"
      density="spacious"
      width="default"
      backdrop={<HeroBackground />}
      className={[
        // Viewport stage under sticky nav (see --marketing-nav-h on :root).
        'min-h-[calc(100svh-var(--marketing-nav-h,4rem))]',
        // Center the stack on tall screens; grows past min-h when content is taller.
        'flex flex-col justify-center overflow-hidden',
      ].join(' ')}
    >
      <div className="mx-auto max-w-3xl text-center">
        {/* Audience switch: replaces the former eyebrow pill. */}
        <div className="mb-7 flex justify-center sm:mb-8">
          <AudienceToggle current={audience} />
        </div>

        {audience === 'technical' ? <TechnicalHero hero={hero} /> : <NonTechnicalHero />}
      </div>

      {/* Receipt-motif moment (frontend-excellence Phase 5): one orchestrated
          print entrance, shared verbatim by both audience variants. */}
      <div className="mx-auto mt-12 w-full min-w-0 max-w-md text-left sm:mt-14 sm:max-w-lg">
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
    </MarketingSection>
  );
}
