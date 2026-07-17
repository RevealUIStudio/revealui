import { findAdrCiteInBlock, getProseContainers, type MarketingBlock } from './blocks.js';
import {
  isDollarShape,
  isDollarShapeAdjacent,
  isEngagementUnit,
  isPercentShape,
  isPositiveIntegerToken,
  isPricingTierSourceBlock,
  isUsdShape,
} from './predicates.js';
import type {
  H2ShapePredicate,
  PredicateName,
  Rule,
  ValidationResult,
  Violation,
} from './rules.js';
import { type Token, tokenize } from './tokenize.js';

export interface CheckContext {
  blockType?: string;
  field?: string;
  /** Current prose container's node type (e.g. `heading`, `paragraph`). */
  nodeType?: string;
  /** Heading tag (`h1`..`h6`) when `nodeType === 'heading'`. */
  headingTag?: string;
  /** Whether the block carries an ADR-cite link — computed once per block. */
  adrCitePresent?: boolean;
  /** Whether the block is a pricing-tier source — computed once per block. */
  pricingTierSource?: boolean;
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
      return checkH2Shape(rule, tokens, ctx);
    case 'fake-trust':
      return checkFakeTrust(rule, tokens, ctx);
    case 'pricing-proximity':
      return checkPricingProximity(rule, tokens, ctx);
    case 'rvc-pricing-proximity':
      return checkRvcPricingProximity(rule, tokens, ctx);
    case 'unicode-range-tokens':
      return checkUnicodeRangeTokens(rule, tokens, ctx);
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

// ---------------------------------------------------------------------------
// Proximity scanner (shared by pricing-proximity + rvc-pricing-proximity).
//
// Distance is measured in WORD-KIND token distance; the pricing PREDICATES are
// evaluated against the FULL token stream so a `$`-split price (`$` + `0.10`)
// or a two-token percent (`5` + `%`) is recognized rather than dropped.
// ---------------------------------------------------------------------------

/** `wordIndex[i]` = number of word-kind tokens in `tokens[0..i)`. */
function wordIndexPrefix(tokens: Token[]): number[] {
  const prefix: number[] = new Array(tokens.length);
  let count = 0;
  for (let i = 0; i < tokens.length; i++) {
    prefix[i] = count;
    if (tokens[i]?.kind === 'word') count++;
  }
  return prefix;
}

type StreamPredicate = (tokens: Token[], i: number) => boolean;

function matchesDollar(tokens: Token[], i: number): boolean {
  const cur = tokens[i];
  if (cur === undefined) return false;
  if (cur.text.length > 1 && isDollarShape(cur)) return true; // whole `$100` token
  return isDollarShapeAdjacent(tokens[i - 1], cur); // `$` + `0.10`
}

function resolveStreamPredicate(name: PredicateName): StreamPredicate {
  switch (name) {
    case 'isDollarShape':
      return matchesDollar;
    case 'isPercentShape':
      return (t, i) => {
        const c = t[i];
        return c !== undefined && isPercentShape(c, t[i + 1]);
      };
    case 'isUsdShape':
      return (t, i) => {
        const c = t[i];
        return c !== undefined && isUsdShape(c, t[i + 1]);
      };
    case 'isEngagementUnit':
      return (t, i) => {
        const c = t[i];
        return c !== undefined && isEngagementUnit(c);
      };
    case 'isPositiveIntegerToken':
      return (t, i) => {
        const c = t[i];
        return c !== undefined && isPositiveIntegerToken(c);
      };
  }
}

function checkRvcPricingProximity(
  rule: Extract<Rule, { kind: 'rvc-pricing-proximity' }>,
  tokens: Token[],
  ctx: CheckContext,
): Violation[] {
  if (rule.unless === 'adr-cite-in-block' && ctx.adrCitePresent) return [];
  const matchers = rule.proximityPredicates.map(resolveStreamPredicate);
  const prefix = wordIndexPrefix(tokens);
  const violations: Violation[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const anchor = tokens[i];
    if (anchor === undefined || anchor.kind !== 'word') continue;
    if (anchor.text.toLowerCase() !== rule.anchorTokenLowercase) continue;
    const anchorWord = prefix[i] ?? 0;
    let hit = false;
    for (let j = 0; j < tokens.length && !hit; j++) {
      if (j === i) continue;
      if (Math.abs((prefix[j] ?? 0) - anchorWord) > rule.withinTokens) continue;
      for (const match of matchers) {
        if (match(tokens, j)) {
          hit = true;
          break;
        }
      }
    }
    if (hit) {
      violations.push(makeViolation(rule, ctx, 'RVC pricing claim without an ADR cite', anchor));
    }
  }
  return violations;
}

function checkPricingProximity(
  rule: Extract<Rule, { kind: 'pricing-proximity' }>,
  tokens: Token[],
  ctx: CheckContext,
): Violation[] {
  const exonerated =
    (rule.unless.includes('adr-cite-in-block') && ctx.adrCitePresent === true) ||
    (rule.unless.includes('pricing-tier-source') && ctx.pricingTierSource === true);
  if (exonerated) return [];
  const anchorMatch = resolveStreamPredicate(rule.anchorPredicate);
  const proximityMatch = resolveStreamPredicate(rule.proximityPredicate);
  const prefix = wordIndexPrefix(tokens);
  for (let i = 0; i < tokens.length; i++) {
    if (!anchorMatch(tokens, i)) continue;
    const anchorWord = prefix[i] ?? 0;
    for (let j = 0; j < tokens.length; j++) {
      if (j === i) continue;
      if (Math.abs((prefix[j] ?? 0) - anchorWord) > rule.withinTokens) continue;
      if (proximityMatch(tokens, j)) {
        const anchor = tokens[i];
        return anchor !== undefined
          ? [makeViolation(rule, ctx, `Pricing figure near "${anchor.text}"`, anchor)]
          : [];
      }
    }
  }
  return [];
}

function checkFakeTrust(
  rule: Extract<Rule, { kind: 'fake-trust' }>,
  tokens: Token[],
  ctx: CheckContext,
): Violation[] {
  if (rule.unless === 'adr-cite-in-block' && ctx.adrCitePresent) return [];
  const words = wordTokens(tokens);
  const seq = rule.anchor.tokenSequence;
  if (seq.length === 0) return [];
  const violations: Violation[] = [];
  for (let i = 0; i + seq.length <= words.length; i++) {
    let match = true;
    for (let k = 0; k < seq.length; k++) {
      const w = words[i + k];
      const s = seq[k];
      if (w === undefined || s === undefined) {
        match = false;
        break;
      }
      const a = rule.anchor.caseInsensitive ? w.text.toLowerCase() : w.text;
      const b = rule.anchor.caseInsensitive ? s.toLowerCase() : s;
      if (a !== b) {
        match = false;
        break;
      }
    }
    if (!match) continue;
    const start = i + seq.length;
    let found = false;
    for (let j = start; j < Math.min(words.length, start + rule.withinTokens); j++) {
      const w = words[j];
      if (w !== undefined && isPositiveIntegerToken(w)) {
        found = true;
        break;
      }
    }
    const anchor = words[i];
    if (found && anchor !== undefined) {
      violations.push(
        makeViolation(
          rule,
          ctx,
          `Unsupported "${seq.join(' ')}" claim without an ADR cite`,
          anchor,
        ),
      );
    }
  }
  return violations;
}

function matchesH2Predicate(predicate: H2ShapePredicate, words: Token[]): boolean {
  if (predicate.kind === 'startsWithToken') {
    const first = words[0];
    return first !== undefined && first.text.toLowerCase() === predicate.token.toLowerCase();
  }
  for (let k = 0; k < predicate.tokens.length; k++) {
    const w = words[k];
    const s = predicate.tokens[k];
    if (w === undefined || s === undefined) return false;
    if (w.text.toLowerCase() !== s.toLowerCase()) return false;
  }
  return true;
}

function lastNonWhitespaceToken(tokens: Token[]): Token | undefined {
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i];
    if (t !== undefined && t.kind !== 'whitespace') return t;
  }
  return undefined;
}

function checkH2Shape(
  rule: Extract<Rule, { kind: 'h2-shape' }>,
  tokens: Token[],
  ctx: CheckContext,
): Violation[] {
  // Node-scoped: the anti-pattern is a rhetorical-question heading, so a body
  // paragraph that happens to start with an interrogative does not fire.
  if (ctx.nodeType !== 'heading') return [];
  const words = wordTokens(tokens);
  if (words.length === 0) return [];
  if (!rule.predicates.some((p) => matchesH2Predicate(p, words))) return [];
  if (rule.requiresSuffixToken !== undefined) {
    const last = lastNonWhitespaceToken(tokens);
    if (last?.text !== rule.requiresSuffixToken) return [];
  }
  const anchor = words[0];
  return anchor !== undefined
    ? [makeViolation(rule, ctx, 'Rhetorical-question heading', anchor)]
    : [];
}

function checkUnicodeRangeTokens(
  rule: Extract<Rule, { kind: 'unicode-range-tokens' }>,
  tokens: Token[],
  ctx: CheckContext,
): Violation[] {
  const violations: Violation[] = [];
  for (const token of tokens) {
    if (token.kind === 'whitespace') continue;
    let hit = false;
    for (const ch of token.text) {
      const cp = ch.codePointAt(0);
      if (cp === undefined) continue;
      for (const range of rule.codepointRanges) {
        if (cp >= range.startInclusive && cp <= range.endInclusive) {
          hit = true;
          break;
        }
      }
      if (hit) break;
    }
    if (hit) {
      violations.push(makeViolation(rule, ctx, `Disallowed character in "${token.text}"`, token));
    }
  }
  return violations;
}

// ---------------------------------------------------------------------------
// Engine — compose tokenize + checkRule over a block's enumerated prose slots.
// ---------------------------------------------------------------------------

function runRules(block: MarketingBlock, rules: Rule[]): ValidationResult {
  const adrCitePresent = findAdrCiteInBlock(block) !== null;
  const pricingTierSource = isPricingTierSourceBlock({ type: block.blockType });
  const violations: Violation[] = [];
  for (const container of getProseContainers(block)) {
    const tokens = tokenize(container.text);
    const ctx: CheckContext = {
      blockType: block.blockType,
      field: container.field,
      nodeType: container.nodeType,
      ...(container.tag !== undefined ? { headingTag: container.tag } : {}),
      adrCitePresent,
      pricingTierSource,
    };
    for (const rule of rules) {
      violations.push(...checkRule(rule, tokens, ctx));
    }
  }
  return { passed: violations.length === 0, violations };
}

/** Tier-1 (structural, un-overridable) voice validation over a block. */
export function runTier1(block: MarketingBlock, rules: Rule[]): ValidationResult {
  return runRules(block, rules);
}

/** Tier-2 (banned words / AI flow) voice validation — same engine, tier-2 rules. */
export function runTier2(block: MarketingBlock, rules: Rule[]): ValidationResult {
  return runRules(block, rules);
}
