import { HOME_HERO, HOME_HERO_FOUNDATION } from '../content/home';

/**
 * Homepage-hero A/B variant selector.
 *
 * Serves the "Foundation" hero variant when the URL carries `?hero=foundation`,
 * else the canonical `HOME_HERO`. This is the manual / preview serving seam for
 * the hero-noun A/B: visit `/?hero=foundation` to see the variant. "runtime"
 * stays the canonical noun on every other surface.
 *
 * An automatic traffic split + conversion measurement is deliberately out of
 * scope here: the marketing app has no analytics sink yet, so a real experiment
 * (cohort assignment + event logging + a winner readout) is its own piece of
 * work. This selector is the seam that work plugs into.
 */
export function selectHomeHero(search: string): typeof HOME_HERO | typeof HOME_HERO_FOUNDATION {
  return new URLSearchParams(search).get('hero') === 'foundation'
    ? HOME_HERO_FOUNDATION
    : HOME_HERO;
}
