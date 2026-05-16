import { describe, expect, it } from 'vitest';
import {
  ENGAGEMENT_UNITS,
  isAdrCitePath,
  isAdrFilename,
  isDollarShape,
  isEngagementUnit,
  isIntegerWithCommas,
  isPercentShape,
  isPositiveIntegerToken,
  isPricingTierSourceBlock,
  isRepoLinkToken,
  isTrackerToken,
  isUsdShape,
  PRICING_TIER_BLOCK_KINDS,
  stripCommas,
} from '../predicates.js';
import type { Token } from '../tokenize.js';

function word(text: string, offset = 0): Token {
  return { text, kind: 'word', offset };
}

function sym(text: string, offset = 0): Token {
  return { text, kind: 'symbol', offset };
}

describe('stripCommas', () => {
  it('removes all commas', () => {
    expect(stripCommas('1,676')).toBe('1676');
  });
  it('handles string without commas', () => {
    expect(stripCommas('1000')).toBe('1000');
  });
  it('handles empty string', () => {
    expect(stripCommas('')).toBe('');
  });
});

describe('isDollarShape', () => {
  it('accepts $100', () => expect(isDollarShape(sym('$100'))).toBe(true));
  it('accepts $0.10', () => expect(isDollarShape(sym('$0.10'))).toBe(true));
  it('accepts $1,000', () => expect(isDollarShape(sym('$1,000'))).toBe(true));
  it('rejects plain number', () => expect(isDollarShape(word('100'))).toBe(false));
  it('rejects $abc', () => expect(isDollarShape(sym('$abc'))).toBe(false));
  it('rejects empty string', () => expect(isDollarShape(sym(''))).toBe(false));
});

describe('isPercentShape', () => {
  it('accepts "5%"', () => expect(isPercentShape(word('5%'), undefined)).toBe(true));
  it('accepts number followed by "%" token', () => {
    expect(isPercentShape(word('5'), sym('%'))).toBe(true);
  });
  it('rejects word followed by non-% token', () => {
    expect(isPercentShape(word('5'), word('percent'))).toBe(false);
  });
  it('rejects "abc%"', () => expect(isPercentShape(word('abc%'), undefined)).toBe(false));
});

describe('isUsdShape', () => {
  it('accepts number followed by "usd"', () => {
    expect(isUsdShape(word('100'), word('usd'))).toBe(true);
  });
  it('accepts number followed by "USD"', () => {
    expect(isUsdShape(word('100'), word('USD'))).toBe(true);
  });
  it('rejects word token', () => {
    expect(isUsdShape(word('price'), word('usd'))).toBe(false);
  });
  it('rejects number without following usd', () => {
    expect(isUsdShape(word('100'), undefined)).toBe(false);
  });
});

describe('isEngagementUnit', () => {
  it('accepts "engagement"', () => expect(isEngagementUnit(word('engagement'))).toBe(true));
  it('accepts "project"', () => expect(isEngagementUnit(word('project'))).toBe(true));
  it('accepts "mo"', () => expect(isEngagementUnit(word('mo'))).toBe(true));
  it('accepts "week"', () => expect(isEngagementUnit(word('week'))).toBe(true));
  it('accepts uppercase "WEEK"', () => expect(isEngagementUnit(word('WEEK'))).toBe(true));
  it('rejects "month"', () => expect(isEngagementUnit(word('month'))).toBe(false));
});

describe('ENGAGEMENT_UNITS constant', () => {
  it('is a Set', () => expect(ENGAGEMENT_UNITS).toBeInstanceOf(Set));
});

describe('PRICING_TIER_BLOCK_KINDS constant', () => {
  it('contains PricingTracks', () =>
    expect(PRICING_TIER_BLOCK_KINDS.has('PricingTracks')).toBe(true));
});

describe('isPositiveIntegerToken', () => {
  it('accepts "1"', () => expect(isPositiveIntegerToken(word('1'))).toBe(true));
  it('accepts "99"', () => expect(isPositiveIntegerToken(word('99'))).toBe(true));
  it('rejects "0"', () => expect(isPositiveIntegerToken(word('0'))).toBe(false));
  it('rejects negative', () => expect(isPositiveIntegerToken(word('-1'))).toBe(false));
  it('rejects float', () => expect(isPositiveIntegerToken(word('1.5'))).toBe(false));
  it('rejects word', () => expect(isPositiveIntegerToken(word('abc'))).toBe(false));
});

describe('isIntegerWithCommas', () => {
  it('accepts "1,676"', () => expect(isIntegerWithCommas(word('1,676'))).toBe(true));
  it('accepts "10,000"', () => expect(isIntegerWithCommas(word('10,000'))).toBe(true));
  it('accepts plain "1000"', () => expect(isIntegerWithCommas(word('1000'))).toBe(true));
  it('rejects "1,abc"', () => expect(isIntegerWithCommas(word('1,abc'))).toBe(false));
  it('rejects "1,,2"', () => expect(isIntegerWithCommas(word('1,,2'))).toBe(false));
});

describe('isTrackerToken', () => {
  it('accepts "#" when next is digits', () => {
    expect(isTrackerToken(sym('#'), word('123'))).toBe(true);
  });
  it('rejects "#" when next is word', () => {
    expect(isTrackerToken(sym('#'), word('foo'))).toBe(false);
  });
  it('rejects "#" when next is undefined', () => {
    expect(isTrackerToken(sym('#'), undefined)).toBe(false);
  });
  it('accepts "milestone"', () => expect(isTrackerToken(word('milestone'), undefined)).toBe(true));
  it('accepts "milestones"', () =>
    expect(isTrackerToken(word('milestones'), undefined)).toBe(true));
  it('accepts "Milestone" (case insensitive)', () =>
    expect(isTrackerToken(word('Milestone'), undefined)).toBe(true));
  it('accepts token ending in .yml', () =>
    expect(isTrackerToken(word('deploy.yml'), undefined)).toBe(true));
  it('accepts token ending in .yaml', () =>
    expect(isTrackerToken(word('config.yaml'), undefined)).toBe(true));
  it('rejects plain word', () => expect(isTrackerToken(word('roadmap'), undefined)).toBe(false));
});

describe('isRepoLinkToken', () => {
  it('accepts github.com/RevealUIStudio URL', () => {
    expect(isRepoLinkToken('https://github.com/RevealUIStudio/revealui/pull/865')).toBe(true);
  });
  it('accepts issues URL', () => {
    expect(isRepoLinkToken('https://github.com/foo/bar/issues/42')).toBe(true);
  });
  it('accepts pull URL', () => {
    expect(isRepoLinkToken('https://github.com/foo/bar/pull/1')).toBe(true);
  });
  it('accepts pulls URL', () => {
    expect(isRepoLinkToken('https://github.com/foo/bar/pulls/5')).toBe(true);
  });
  it('rejects non-matching URL', () => {
    expect(isRepoLinkToken('https://example.com/foo')).toBe(false);
  });
  it('rejects plain text', () => {
    expect(isRepoLinkToken('not a url')).toBe(false);
  });
});

describe('isAdrFilename', () => {
  it('accepts valid ADR filename', () => {
    expect(isAdrFilename('2026-05-12-rvc-pricing.md')).toBe(true);
  });
  it('accepts multi-word slug', () => {
    expect(isAdrFilename('2026-01-01-some-adr-name.md')).toBe(true);
  });
  it('rejects invalid month (13)', () => {
    expect(isAdrFilename('2026-13-99-bogus.md')).toBe(false);
  });
  it('rejects missing slug', () => {
    expect(isAdrFilename('2026-05-12.md')).toBe(false);
  });
  it('rejects wrong extension', () => {
    expect(isAdrFilename('2026-05-12-foo.txt')).toBe(false);
  });
  it('rejects date with wrong digit counts', () => {
    expect(isAdrFilename('26-5-1-foo.md')).toBe(false);
  });
  it('rejects non-date prefix', () => {
    expect(isAdrFilename('foo-bar-baz-qux.md')).toBe(false);
  });
});

describe('isAdrCitePath', () => {
  it('accepts valid docs/decisions path', () => {
    expect(isAdrCitePath('../docs/decisions/2026-05-12-rvc-pricing.md')).toBe(true);
  });
  it('rejects path without docs/decisions', () => {
    expect(isAdrCitePath('../some-other-doc.md')).toBe(false);
  });
  it('rejects docs/decisions with invalid ADR filename', () => {
    expect(isAdrCitePath('../docs/decisions/2026-13-99-bogus.md')).toBe(false);
  });
  it('rejects plain text', () => {
    expect(isAdrCitePath('not a path')).toBe(false);
  });
});

describe('isPricingTierSourceBlock', () => {
  it('accepts PricingTracks block type', () => {
    expect(isPricingTierSourceBlock({ type: 'PricingTracks' })).toBe(true);
  });
  it('rejects other block types', () => {
    expect(isPricingTierSourceBlock({ type: 'Hero' })).toBe(false);
    expect(isPricingTierSourceBlock({ type: 'ContentSection' })).toBe(false);
  });
});
