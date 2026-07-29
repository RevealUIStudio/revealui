import { describe, expect, it } from 'vitest';
import { HOME_HERO, HOME_HERO_FOUNDATION, HOME_HERO_OWNERSHIP } from '../content/home';
import { selectHomeHero } from '../lib/hero-variant';

describe('selectHomeHero', () => {
  it('serves the Foundation variant for ?hero=foundation', () => {
    expect(selectHomeHero('?hero=foundation')).toBe(HOME_HERO_FOUNDATION);
  });

  it('serves the ownership rollback for ?hero=ownership', () => {
    expect(selectHomeHero('?hero=ownership')).toBe(HOME_HERO_OWNERSHIP);
  });

  it('serves the L1 default hero by default (no query)', () => {
    expect(selectHomeHero('')).toBe(HOME_HERO);
    expect(HOME_HERO.h1).toBe('Build it once. Every product after starts ahead.');
  });

  it('serves the L1 default for unknown hero values', () => {
    expect(selectHomeHero('?hero=runtime')).toBe(HOME_HERO);
    expect(selectHomeHero('?other=1')).toBe(HOME_HERO);
  });

  it('isolates the H1 only across variants (subtitle unchanged)', () => {
    expect(HOME_HERO_FOUNDATION.h1).not.toBe(HOME_HERO.h1);
    expect(HOME_HERO_OWNERSHIP.h1).not.toBe(HOME_HERO.h1);
    expect(HOME_HERO_FOUNDATION.subtitle).toEqual(HOME_HERO.subtitle);
    expect(HOME_HERO_OWNERSHIP.subtitle).toEqual(HOME_HERO.subtitle);
    expect(HOME_HERO_FOUNDATION.eyebrow).toBe(HOME_HERO.eyebrow);
    expect(HOME_HERO_FOUNDATION.cta).toEqual(HOME_HERO.cta);
  });

  it('matches the Foundation A/B H1 lock verbatim', () => {
    expect(HOME_HERO_FOUNDATION.h1).toBe('The foundation your business runs on.');
  });

  it('keeps the full locked positioning form on all hero variants', () => {
    expect(HOME_HERO.subtitle.sentence1).toContain('under one roof');
    expect(HOME_HERO.subtitle.sentence2).toBe(
      'Every agent is a governed and audited user that lives on your infrastructure.',
    );
    expect(HOME_HERO.subtitle.support).toBe('It runs on any AI provider you choose.');
    expect(HOME_HERO_FOUNDATION.subtitle.sentence2).toBe(HOME_HERO.subtitle.sentence2);
    expect(HOME_HERO_OWNERSHIP.subtitle.sentence2).toBe(HOME_HERO.subtitle.sentence2);
  });
});
