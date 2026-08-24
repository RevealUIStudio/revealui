import { Button, GitHubIcon, IconArrowRight, MarketingSection } from '@revealui/presentation';
import { useLocation } from '@revealui/router';
import { HOME_GET_STARTED } from '../../content/home';
import { selectHomeHero } from '../../lib/hero-variant';

/**
 * Full-bleed hero stage paint (viewport-stage, not content-boxed).
 * Founder weekend spec: one headline, one continuity sentence, Start free, GitHub.
 */
function HeroBackground() {
  return (
    <div
      data-slot="hero-background"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.07] via-background to-background" />
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

export function Hero() {
  const { search } = useLocation();
  const hero = selectHomeHero(search);

  return (
    <MarketingSection
      tone="background"
      density="spacious"
      width="default"
      backdrop={<HeroBackground />}
      className={[
        'min-h-[calc(100svh-var(--marketing-nav-h,4rem))]',
        'flex flex-col justify-center overflow-hidden',
      ].join(' ')}
    >
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-balance font-display text-[2.5rem] font-extrabold leading-[1.05] tracking-tighter text-foreground sm:text-6xl lg:text-7xl">
          {hero.h1}
        </h1>

        <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-body sm:mt-7 sm:text-xl sm:leading-8">
          {hero.subtitle.sentence1}
        </p>

        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:mt-9 sm:flex-row sm:gap-4">
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

        <div className="mt-8 inline-flex items-center gap-3 rounded-xl bg-foreground px-5 py-3 font-mono text-sm shadow-lg ring-1 ring-background/10">
          <span className="select-none text-background/50">$</span>
          {HOME_GET_STARTED.cli.command.map((token, index) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: static, order-fixed command tokens
              key={index}
              className={
                index === 0
                  ? 'text-primary-foreground'
                  : index === HOME_GET_STARTED.cli.command.length - 1
                    ? 'text-background/80'
                    : 'text-background'
              }
            >
              {token}
            </span>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{HOME_GET_STARTED.cli.caption}</p>
      </div>
    </MarketingSection>
  );
}
