import { HOME_HERO, HOME_HERO_FOUNDATION, HOME_HERO_OWNERSHIP } from '../content/home';

/**
 * Homepage-hero A/B variant selector.
 *
 * Default: leverage-frame L1 (`HOME_HERO`, owner ruling 2026-07-29).
 * `?hero=foundation` — Foundation A/B (ADR 2026-06-07 decision 6).
 * `?hero=ownership` — prior default H1, rollback/preview only.
 *
 * An automatic traffic split + conversion measurement is deliberately out of
 * scope here: the marketing app has no analytics sink yet, so a real experiment
 * (cohort assignment + event logging + a winner readout) is its own piece of
 * work. This selector is the seam that work plugs into.
 */
export type HomeHeroVariant =
  | typeof HOME_HERO
  | typeof HOME_HERO_FOUNDATION
  | typeof HOME_HERO_OWNERSHIP;

export function selectHomeHero(search: string): HomeHeroVariant {
  const hero = new URLSearchParams(search).get('hero');
  if (hero === 'foundation') return HOME_HERO_FOUNDATION;
  if (hero === 'ownership') return HOME_HERO_OWNERSHIP;
  return HOME_HERO;
}
