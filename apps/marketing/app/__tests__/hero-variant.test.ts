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

  it('isolates the noun: only h1 + subtitle.strong differ from HOME_HERO', () => {
    expect(HOME_HERO_FOUNDATION.h1).not.toBe(HOME_HERO.h1);
    expect(HOME_HERO_FOUNDATION.subtitle.strong).not.toBe(HOME_HERO.subtitle.strong);
    expect(HOME_HERO_FOUNDATION.eyebrow).toBe(HOME_HERO.eyebrow);
    expect(HOME_HERO_FOUNDATION.subtitle.body).toBe(HOME_HERO.subtitle.body);
    expect(HOME_HERO_FOUNDATION.cta).toEqual(HOME_HERO.cta);
    expect(HOME_HERO_FOUNDATION.shipsToday).toEqual(HOME_HERO.shipsToday);
  });
});
