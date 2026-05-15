import { describe, expect, it } from 'vitest';
import { checkRule, runTier1, walkLexicalAst } from '../check-rule.js';
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

describe('checkRule — deferred variants throw', () => {
  const deferredKinds: Rule['kind'][] = [
    'h2-shape',
    'fake-trust',
    'pricing-proximity',
    'rvc-pricing-proximity',
    'unicode-range-tokens',
  ];

  it.each(deferredKinds)('"%s" throws with Phase B message', (kind) => {
    const rule = { kind, ruleId: 'test' } as unknown as Rule;
    expect(() => checkRule(rule, [], {})).toThrow('deferred to CMS-spec Phase B');
  });
});

describe('runTier1 — deferred stub', () => {
  it('throws with Phase B message', () => {
    expect(() => runTier1({}, [])).toThrow('deferred to CMS-spec Phase B');
  });
});

describe('walkLexicalAst — deferred stub', () => {
  it('throws with Phase B message', () => {
    expect(() => walkLexicalAst({})).toThrow('deferred to CMS-spec Phase B');
  });
});
