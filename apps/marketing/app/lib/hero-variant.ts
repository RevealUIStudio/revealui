import {
  HOME_HERO,
  HOME_HERO_FOUNDATION,
  HOME_HERO_L2,
  HOME_HERO_OWNERSHIP,
} from '../content/home';

/**
 * Homepage-hero A/B variant selector.
 *
 * Default: current benefits-first headline (`HOME_HERO`).
 * `?hero=foundation`, `?hero=ownership`, and `?hero=l2` select explicit previews.
 * Each retains the same setup, license, and cost disclosures as the default.
 *
 * An automatic traffic split + conversion measurement is deliberately out of
 * scope here: the marketing app has no analytics sink yet, so a real experiment
 * (cohort assignment + event logging + a winner readout) is its own piece of
 * work. This selector is the seam that work plugs into.
 */
export type HomeHeroVariant =
  | typeof HOME_HERO
  | typeof HOME_HERO_FOUNDATION
  | typeof HOME_HERO_OWNERSHIP
  | typeof HOME_HERO_L2;

export function selectHomeHero(search: string): HomeHeroVariant {
  const hero = new URLSearchParams(search).get('hero');
  if (hero === 'foundation') return HOME_HERO_FOUNDATION;
  if (hero === 'ownership') return HOME_HERO_OWNERSHIP;
  if (hero === 'l2') return HOME_HERO_L2;
  return HOME_HERO;
}
