import { describe, expect, it } from 'vitest';
import { HOME_HERO, HOME_HERO_FOUNDATION } from '../content/home';
import { selectHomeHero } from '../lib/hero-variant';

describe('selectHomeHero', () => {
  it('serves the Foundation variant for ?hero=foundation', () => {
    expect(selectHomeHero('?hero=foundation')).toBe(HOME_HERO_FOUNDATION);
  });

  it('serves the canonical hero by default (no query)', () => {
    expect(selectHomeHero('')).toBe(HOME_HERO);
  });

  it('serves the canonical hero for any non-foundation value', () => {
    expect(selectHomeHero('?hero=runtime')).toBe(HOME_HERO);
    expect(selectHomeHero('?other=1')).toBe(HOME_HERO);
  });

  it('isolates the noun in the H1 only (corpus §4.1 lock: Sub unchanged)', () => {
    expect(HOME_HERO_FOUNDATION.h1).not.toBe(HOME_HERO.h1);
    expect(HOME_HERO_FOUNDATION.subtitle).toEqual(HOME_HERO.subtitle);
    expect(HOME_HERO_FOUNDATION.eyebrow).toBe(HOME_HERO.eyebrow);
    expect(HOME_HERO_FOUNDATION.cta).toEqual(HOME_HERO.cta);
  });

  it('matches the corpus §4.1 H1 lock verbatim', () => {
    expect(HOME_HERO_FOUNDATION.h1).toBe('The foundation your business runs on.');
  });
});
