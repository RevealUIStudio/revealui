import type { Rule, ValidationResult, Violation } from './rules.js';
import type { Token } from './tokenize.js';

export interface CheckContext {
  blockType?: string;
  field?: string;
}

export function checkRule(rule: Rule, tokens: Token[], ctx: CheckContext): Violation[] {
  switch (rule.kind) {
    case 'banned-tokens':
      return checkBannedTokens(rule, tokens, ctx);
    case 'banned-tokens-with-context':
      return checkBannedTokensWithContext(rule, tokens, ctx);
    case 'banned-token-sequences':
      return checkBannedTokenSequences(rule, tokens, ctx);
    case 'banned-token-near':
      return checkBannedTokenNear(rule, tokens, ctx);
    case 'h2-shape':
    case 'fake-trust':
    case 'pricing-proximity':
    case 'rvc-pricing-proximity':
    case 'unicode-range-tokens':
      throw new Error(
        `Rule kind '${rule.kind}' is not yet implemented — deferred to CMS-spec Phase B (see docs/spec-2026-05-08-marketing-content-cms.md §5.2.1)`,
      );
  }
}

function makeViolation(rule: Rule, ctx: CheckContext, message: string, token?: Token): Violation {
  return {
    rule: rule.ruleId,
    field: ctx.field ?? '',
    message,
    ...(token !== undefined
      ? { span: { start: token.offset, end: token.offset + token.text.length } }
      : {}),
  };
}

function wordTokens(tokens: Token[]): Token[] {
  return tokens.filter((t) => t.kind === 'word');
}

function checkBannedTokens(
  rule: Extract<Rule, { kind: 'banned-tokens' }>,
  tokens: Token[],
  ctx: CheckContext,
): Violation[] {
  const violations: Violation[] = [];
  const banned = new Set(
    rule.caseInsensitive ? rule.tokens.map((t) => t.toLowerCase()) : rule.tokens,
  );
  for (const token of tokens) {
    if (token.kind !== 'word') continue;
    const candidate = rule.caseInsensitive ? token.text.toLowerCase() : token.text;
    if (banned.has(candidate)) {
      violations.push(makeViolation(rule, ctx, `Banned token: "${token.text}"`, token));
    }
  }
  return violations;
}

function prevWordToken(tokens: Token[], idx: number): Token | undefined {
  for (let i = idx - 1; i >= 0; i--) {
    const t = tokens[i];
    if (t !== undefined && t.kind === 'word') return t;
  }
  return undefined;
}

function nextWordToken(tokens: Token[], idx: number): Token | undefined {
  for (let i = idx + 1; i < tokens.length; i++) {
    const t = tokens[i];
    if (t !== undefined && t.kind === 'word') return t;
  }
  return undefined;
}

function checkBannedTokensWithContext(
  rule: Extract<Rule, { kind: 'banned-tokens-with-context' }>,
  tokens: Token[],
  ctx: CheckContext,
): Violation[] {
  const violations: Violation[] = [];
  const bannedSet = new Set(rule.tokens.map((t) => t.toLowerCase()));

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === undefined) continue;
    if (token.kind !== 'word') continue;
    if (!bannedSet.has(token.text.toLowerCase())) continue;

    if (rule.unlessFollowedBy !== undefined) {
      const next = nextWordToken(tokens, i);
      if (
        next !== undefined &&
        rule.unlessFollowedBy.some((u) => u.toLowerCase() === next.text.toLowerCase())
      ) {
        continue;
      }
    }

    if (rule.unlessPrecededByContiguous !== undefined) {
      const prev = prevWordToken(tokens, i);
      if (prev !== undefined && rule.unlessPrecededByContiguous.includes(prev.text)) {
        continue;
      }
    }

    violations.push(makeViolation(rule, ctx, `Banned token: "${token.text}"`, token));
  }
  return violations;
}

function checkBannedTokenSequences(
  rule: Extract<Rule, { kind: 'banned-token-sequences' }>,
  tokens: Token[],
  ctx: CheckContext,
): Violation[] {
  const violations: Violation[] = [];
  const words = wordTokens(tokens);

  for (const seq of rule.sequences) {
    if (seq.length === 0) continue;
    for (let i = 0; i <= words.length - seq.length; i++) {
      let match = true;
      for (let j = 0; j < seq.length; j++) {
        const w = words[i + j];
        const s = seq[j];
        if (w === undefined || s === undefined) {
          match = false;
          break;
        }
        const wordText = rule.caseInsensitive ? w.text.toLowerCase() : w.text;
        const seqText = rule.caseInsensitive ? s.toLowerCase() : s;
        if (wordText !== seqText) {
          match = false;
          break;
        }
      }
      if (match) {
        const anchor = words[i];
        if (anchor !== undefined) {
          violations.push(
            makeViolation(rule, ctx, `Banned token sequence: "${seq.join(' ')}"`, anchor),
          );
        }
      }
    }
  }
  return violations;
}

function checkBannedTokenNear(
  rule: Extract<Rule, { kind: 'banned-token-near' }>,
  tokens: Token[],
  ctx: CheckContext,
): Violation[] {
  const violations: Violation[] = [];
  const words = wordTokens(tokens);
  const anchorSet = new Set(
    rule.anchor.caseInsensitive
      ? rule.anchor.tokens.map((t) => t.toLowerCase())
      : rule.anchor.tokens,
  );
  const nearSet = new Set(rule.near.tokens.map((t) => t.toLowerCase()));

  for (let i = 0; i < words.length; i++) {
    const anchorWord = words[i];
    if (anchorWord === undefined) continue;
    const candidate = rule.anchor.caseInsensitive ? anchorWord.text.toLowerCase() : anchorWord.text;
    if (!anchorSet.has(candidate)) continue;

    const lo = Math.max(0, i - rule.withinTokens);
    const hi = Math.min(words.length - 1, i + rule.withinTokens);
    for (let j = lo; j <= hi; j++) {
      if (j === i) continue;
      const nearWord = words[j];
      if (nearWord === undefined) continue;
      if (nearSet.has(nearWord.text.toLowerCase())) {
        violations.push(
          makeViolation(
            rule,
            ctx,
            `Banned token "${anchorWord.text}" near "${nearWord.text}"`,
            anchorWord,
          ),
        );
        break;
      }
    }
  }
  return violations;
}

export function runTier1(_block: unknown, _rules: Rule[]): ValidationResult {
  throw new Error(
    'runTier1 is not yet implemented — deferred to CMS-spec Phase B (see docs/spec-2026-05-08-marketing-content-cms.md §5.2.1)',
  );
}

export function walkLexicalAst(_block: unknown): IterableIterator<unknown> {
  throw new Error(
    'walkLexicalAst is not yet implemented — deferred to CMS-spec Phase B (see docs/spec-2026-05-08-marketing-content-cms.md §5.2.1)',
  );
}
