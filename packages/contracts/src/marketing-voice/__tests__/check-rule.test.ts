import { describe, expect, it } from 'vitest';
import type { CheckContext } from '../check-rule.js';
import { checkRule } from '../check-rule.js';
import type { Rule } from '../rules.js';
import { tokenize } from '../tokenize.js';

describe('checkRule — banned-tokens', () => {
  it('flags a banned word (case-sensitive match)', () => {
    const rule: Rule = {
      kind: 'banned-tokens',
      ruleId: 'test.rvui',
      tokens: ['RVUI'],
      caseInsensitive: false,
    };
    const tokens = tokenize('Do not use RVUI in copy');
    const violations = checkRule(rule, tokens, { field: 'body' });
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe('test.rvui');
    expect(violations[0].field).toBe('body');
    expect(violations[0].message).toContain('RVUI');
  });

  it('does not flag if case does not match (case-sensitive)', () => {
    const rule: Rule = {
      kind: 'banned-tokens',
      ruleId: 'test.rvui',
      tokens: ['RVUI'],
      caseInsensitive: false,
    };
    const tokens = tokenize('rvui is fine here');
    expect(checkRule(rule, tokens, {})).toHaveLength(0);
  });

  it('flags case-insensitively when caseInsensitive is true', () => {
    const rule: Rule = {
      kind: 'banned-tokens',
      ruleId: 'test.rvui',
      tokens: ['rvui'],
      caseInsensitive: true,
    };
    const tokens = tokenize('Do not use RVUI in copy');
    expect(checkRule(rule, tokens, {})).toHaveLength(1);
  });

  it('flags multiple occurrences', () => {
    const rule: Rule = {
      kind: 'banned-tokens',
      ruleId: 'test.sla',
      tokens: ['SLA'],
      caseInsensitive: false,
    };
    const tokens = tokenize('SLA and then another SLA mention');
    expect(checkRule(rule, tokens, {})).toHaveLength(2);
  });

  it('includes span on violation', () => {
    const rule: Rule = {
      kind: 'banned-tokens',
      ruleId: 'test.t',
      tokens: ['bad'],
      caseInsensitive: false,
    };
    const tokens = tokenize('this is bad');
    const violations = checkRule(rule, tokens, {});
    expect(violations[0].span).toBeDefined();
    expect(violations[0].span?.start).toBeGreaterThanOrEqual(0);
  });

  it('returns empty field string when ctx.field not provided', () => {
    const rule: Rule = {
      kind: 'banned-tokens',
      ruleId: 'r',
      tokens: ['x'],
      caseInsensitive: false,
    };
    const tokens = tokenize('x');
    expect(checkRule(rule, tokens, {})[0].field).toBe('');
  });
});

describe('checkRule — banned-tokens-with-context', () => {
  it('flags "Studio" alone (no preceding word)', () => {
    const rule: Rule = {
      kind: 'banned-tokens-with-context',
      ruleId: 'test.studio',
      tokens: ['Studio'],
      unlessPrecededByContiguous: ['RevealUI'],
    };
    const tokens = tokenize('We are Studio');
    expect(checkRule(rule, tokens, {})).toHaveLength(1);
  });

  it('does not flag "RevealUI Studio" (preceded by RevealUI)', () => {
    const rule: Rule = {
      kind: 'banned-tokens-with-context',
      ruleId: 'test.studio',
      tokens: ['Studio'],
      unlessPrecededByContiguous: ['RevealUI'],
    };
    const tokens = tokenize('RevealUI Studio');
    expect(checkRule(rule, tokens, {})).toHaveLength(0);
  });

  it('flags "the Studio" (preceded by "the", not RevealUI)', () => {
    const rule: Rule = {
      kind: 'banned-tokens-with-context',
      ruleId: 'test.studio',
      tokens: ['Studio'],
      unlessPrecededByContiguous: ['RevealUI'],
    };
    const tokens = tokenize('the Studio is great');
    expect(checkRule(rule, tokens, {})).toHaveLength(1);
  });

  it('does not flag when unlessFollowedBy matches next word', () => {
    const rule: Rule = {
      kind: 'banned-tokens-with-context',
      ruleId: 'test.coming',
      tokens: ['coming'],
      unlessFollowedBy: ['soon'],
    };
    const tokens = tokenize('coming soon');
    expect(checkRule(rule, tokens, {})).toHaveLength(0);
  });

  it('flags when unlessFollowedBy does not match next word', () => {
    const rule: Rule = {
      kind: 'banned-tokens-with-context',
      ruleId: 'test.coming',
      tokens: ['coming'],
      unlessFollowedBy: ['soon'],
    };
    const tokens = tokenize('coming later');
    expect(checkRule(rule, tokens, {})).toHaveLength(1);
  });

  it('is case-insensitive on the banned token itself', () => {
    const rule: Rule = {
      kind: 'banned-tokens-with-context',
      ruleId: 'test.studio',
      tokens: ['Studio'],
      unlessPrecededByContiguous: ['RevealUI'],
    };
    const tokens = tokenize('We are studio');
    expect(checkRule(rule, tokens, {})).toHaveLength(1);
  });
});

describe('checkRule — banned-token-sequences', () => {
  it('flags "managed hosting" sequence', () => {
    const rule: Rule = {
      kind: 'banned-token-sequences',
      ruleId: 'test.managed-hosting',
      sequences: [['managed', 'hosting']],
      caseInsensitive: true,
    };
    const tokens = tokenize('We offer managed hosting for everyone');
    expect(checkRule(rule, tokens, {})).toHaveLength(1);
  });

  it('does not flag "hosting management" (wrong order)', () => {
    const rule: Rule = {
      kind: 'banned-token-sequences',
      ruleId: 'test.managed-hosting',
      sequences: [['managed', 'hosting']],
      caseInsensitive: true,
    };
    const tokens = tokenize('hosting management services');
    expect(checkRule(rule, tokens, {})).toHaveLength(0);
  });

  it('flags case-insensitively when caseInsensitive is true', () => {
    const rule: Rule = {
      kind: 'banned-token-sequences',
      ruleId: 'test.mh',
      sequences: [['managed', 'hosting']],
      caseInsensitive: true,
    };
    const tokens = tokenize('MANAGED HOSTING');
    expect(checkRule(rule, tokens, {})).toHaveLength(1);
  });

  it('does not flag when caseInsensitive is false and case differs', () => {
    const rule: Rule = {
      kind: 'banned-token-sequences',
      ruleId: 'test.mh',
      sequences: [['managed', 'hosting']],
      caseInsensitive: false,
    };
    const tokens = tokenize('MANAGED HOSTING');
    expect(checkRule(rule, tokens, {})).toHaveLength(0);
  });

  it('handles multi-word sequences with intervening non-word tokens skipped (word-only window)', () => {
    const rule: Rule = {
      kind: 'banned-token-sequences',
      ruleId: 'test.sso',
      sequences: [['single', 'sign', 'on']],
      caseInsensitive: true,
    };
    const tokens = tokenize('single sign-on authentication');
    const wordTexts = tokens.filter((t) => t.kind === 'word').map((t) => t.text.toLowerCase());
    expect(wordTexts).toContain('single');
    expect(wordTexts).toContain('sign');
    expect(wordTexts).toContain('on');
    const violations = checkRule(rule, tokens, {});
    expect(violations).toHaveLength(1);
  });
});

describe('checkRule — banned-token-near', () => {
  it('flags RVC near a numeric token within 3 tokens', () => {
    const rule: Rule = {
      kind: 'banned-token-near',
      ruleId: 'test.rvc-price',
      anchor: { tokens: ['RVC'], caseInsensitive: false },
      near: { tokens: ['0.10'] },
      withinTokens: 3,
    };
    const tokens = tokenize('Buy RVC at 0.10');
    expect(checkRule(rule, tokens, {})).toHaveLength(1);
  });

  it('does not flag when tokens are too far apart', () => {
    const rule: Rule = {
      kind: 'banned-token-near',
      ruleId: 'test.rvc-price',
      anchor: { tokens: ['RVC'], caseInsensitive: false },
      near: { tokens: ['cheap'] },
      withinTokens: 2,
    };
    const tokens = tokenize('RVC is a great way to access cheap services eventually');
    const violations = checkRule(rule, tokens, {});
    expect(violations).toHaveLength(0);
  });

  it('is bidirectional — near token can precede anchor', () => {
    const rule: Rule = {
      kind: 'banned-token-near',
      ruleId: 'test.rvc-price',
      anchor: { tokens: ['RVC'], caseInsensitive: false },
      near: { tokens: ['cheap'] },
      withinTokens: 2,
    };
    const tokens = tokenize('cheap RVC here');
    expect(checkRule(rule, tokens, {})).toHaveLength(1);
  });

  it('respects caseInsensitive on anchor', () => {
    const rule: Rule = {
      kind: 'banned-token-near',
      ruleId: 'test.rvc-near',
      anchor: { tokens: ['rvc'], caseInsensitive: true },
      near: { tokens: ['cheap'] },
      withinTokens: 3,
    };
    const tokens = tokenize('buy RVC cheap');
    expect(checkRule(rule, tokens, {})).toHaveLength(1);
  });
});

describe('checkRule — rvc-pricing-proximity + the $-split fix', () => {
  const rule: Extract<Rule, { kind: 'rvc-pricing-proximity' }> = {
    kind: 'rvc-pricing-proximity',
    ruleId: 'tier1.rvc-pricing-without-adr',
    anchorTokenLowercase: 'rvc',
    proximityPredicates: ['isDollarShape', 'isPercentShape', 'isUsdShape'],
    withinTokens: 30,
    unless: 'adr-cite-in-block',
  };

  it('the tokenizer splits "$0.10" into a separate "$" symbol token (the boundary this fix handles)', () => {
    const tokens = tokenize('RVC at $0.10');
    const dollar = tokens.find((t) => t.text === '$');
    expect(dollar?.kind).toBe('symbol');
    // The number arrives as its own word token, so a naive word-only window
    // would drop the "$" and miss the price.
    expect(tokens.some((t) => t.kind === 'word' && t.text === '0.10')).toBe(true);
  });

  it('STILL fires on the $-split form (RVC near "$" + "0.10")', () => {
    expect(checkRule(rule, tokenize('RVC at $0.10'), {})).toHaveLength(1);
  });

  it('fires on the two-token percent form (RVC near "5" + "%")', () => {
    expect(checkRule(rule, tokenize('RVC vesting unlocks 5% per quarter'), {})).toHaveLength(1);
  });

  it('is bidirectional — a price preceding the anchor fires', () => {
    expect(checkRule(rule, tokenize('$0.10 for RVC'), {})).toHaveLength(1);
  });

  it('is exonerated when ctx.adrCitePresent is true', () => {
    expect(checkRule(rule, tokenize('RVC at $0.10'), { adrCitePresent: true })).toHaveLength(0);
  });

  it('respects the window boundary — fires at the edge, not past it', () => {
    const tight = { ...rule, withinTokens: 3 };
    expect(checkRule(tight, tokenize('RVC a b $5'), {})).toHaveLength(1); // distance 3
    expect(checkRule(tight, tokenize('RVC a b c $5'), {})).toHaveLength(0); // distance 4
  });
});

describe('checkRule — pricing-proximity', () => {
  const rule: Extract<Rule, { kind: 'pricing-proximity' }> = {
    kind: 'pricing-proximity',
    ruleId: 'tier1.pricing-proximity',
    anchorPredicate: 'isDollarShape',
    proximityPredicate: 'isEngagementUnit',
    withinTokens: 6,
    unless: ['adr-cite-in-block', 'pricing-tier-source'],
  };

  it('flags a $ figure next to an engagement unit', () => {
    expect(checkRule(rule, tokenize('$5,000 per engagement'), {})).toHaveLength(1);
  });

  it('is exonerated on a pricing-tier source block', () => {
    const ctx: CheckContext = { pricingTierSource: true };
    expect(checkRule(rule, tokenize('$5,000 per engagement'), ctx)).toHaveLength(0);
  });

  it('does not flag a $ figure with no engagement unit nearby', () => {
    expect(checkRule(rule, tokenize('a donation of $5,000 helps'), {})).toHaveLength(0);
  });
});

describe('checkRule — fake-trust', () => {
  const rule: Extract<Rule, { kind: 'fake-trust' }> = {
    kind: 'fake-trust',
    ruleId: 'tier1.fake-trust',
    anchor: { tokenSequence: ['trusted', 'by'], caseInsensitive: true },
    requiresProximity: 'positive-integer-token',
    withinTokens: 4,
    unless: 'adr-cite-in-block',
  };

  it('flags "Trusted by 400 teams"', () => {
    expect(checkRule(rule, tokenize('Trusted by 400 teams'), {})).toHaveLength(1);
  });

  it('does not flag "Trusted by developers" (no integer)', () => {
    expect(checkRule(rule, tokenize('Trusted by developers everywhere'), {})).toHaveLength(0);
  });

  it('is exonerated when ctx.adrCitePresent is true', () => {
    expect(
      checkRule(rule, tokenize('Trusted by 400 teams'), { adrCitePresent: true }),
    ).toHaveLength(0);
  });
});

describe('checkRule — h2-shape', () => {
  const rule: Extract<Rule, { kind: 'h2-shape' }> = {
    kind: 'h2-shape',
    ruleId: 'tier1.rhetorical-question-heading',
    predicates: [{ kind: 'startsWithToken', token: 'why' }],
    requiresSuffixToken: '?',
  };

  it('flags an interrogative heading ending in ? (node-scoped to headings)', () => {
    expect(checkRule(rule, tokenize('Why RevealUI?'), { nodeType: 'heading' })).toHaveLength(1);
  });

  it('does not flag the same text in a paragraph', () => {
    expect(checkRule(rule, tokenize('Why RevealUI?'), { nodeType: 'paragraph' })).toHaveLength(0);
  });

  it('does not flag an interrogative opener without the ? suffix', () => {
    expect(checkRule(rule, tokenize('Why RevealUI works'), { nodeType: 'heading' })).toHaveLength(
      0,
    );
  });
});

describe('checkRule — unicode-range-tokens', () => {
  const emDash: Extract<Rule, { kind: 'unicode-range-tokens' }> = {
    kind: 'unicode-range-tokens',
    ruleId: 'tier1.em-dash',
    codepointRanges: [{ startInclusive: 0x2014, endInclusive: 0x2014 }],
  };

  it('flags an em dash', () => {
    const text = `agents ${String.fromCodePoint(0x2014)} pre-wired`;
    expect(checkRule(emDash, tokenize(text), {})).toHaveLength(1);
  });

  it('does not flag prose without the target codepoint', () => {
    expect(checkRule(emDash, tokenize('agents, pre-wired'), {})).toHaveLength(0);
  });

  it('flags an emoji via its codepoint range', () => {
    const emoji: Extract<Rule, { kind: 'unicode-range-tokens' }> = {
      kind: 'unicode-range-tokens',
      ruleId: 'tier2.emoji',
      codepointRanges: [{ startInclusive: 0x1f300, endInclusive: 0x1faff }],
    };
    expect(checkRule(emoji, tokenize('ship it 🚀 today'), {}).length).toBeGreaterThan(0);
  });
});
