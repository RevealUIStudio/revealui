import { describe, expect, it } from 'vitest';
import {
  HOME_HERO,
  HOME_HERO_FOUNDATION,
  HOME_HERO_L2,
  HOME_HERO_OWNERSHIP,
} from '../content/home';
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
    expect(HOME_HERO.h1).toBe('The agentic business runtime startups operate on their own domain.');
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
    expect(HOME_HERO_FOUNDATION.h1).toBe('Existing tools report in. You keep the stack.');
  });

  it('keeps the full locked positioning form on all hero variants', () => {
    expect(HOME_HERO.subtitle.sentence1).toContain('existing tools report in, you keep the stack');
    expect(HOME_HERO.subtitle.sentence2).toBe(
      'Powerful and safe: PROOF is a receipted action when it matters, and the catalog matches checkout (Free / Pro $49 / Max $99/mo · $799/yr).',
    );
    expect(HOME_HERO.subtitle.support).toBe(
      'BYOK / open-weight default. Same plan rules for humans and agents.',
    );
    expect(HOME_HERO_FOUNDATION.subtitle.sentence2).toBe(HOME_HERO.subtitle.sentence2);
    expect(HOME_HERO_OWNERSHIP.subtitle.sentence2).toBe(HOME_HERO.subtitle.sentence2);
  });

  it('serves the L2 leverage-frame for ?hero=l2', () => {
    expect(selectHomeHero('?hero=l2')).toBe(HOME_HERO_L2);
    expect(HOME_HERO_L2.h1).toBe(
      'Your secrets stay on infra you own. Agents use the same plan rules.',
    );
    expect(HOME_HERO_L2.subtitle).toEqual(HOME_HERO.subtitle);
  });
});
