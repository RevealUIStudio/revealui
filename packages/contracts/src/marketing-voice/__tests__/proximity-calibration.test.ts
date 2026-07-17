import { describe, expect, it } from 'vitest';
import type { MarketingBlock } from '../blocks.js';
import { runTier1 } from '../check-rule.js';
import { type Rule, RVC_PRICING_WITHIN_TOKENS } from '../rules.js';
import { code, contentBlock, link, paragraph, prose, text } from './helpers.js';

// Calibration corpus for RVC_PRICING_WITHIN_TOKENS (spec §9 B3b / design §4.3).
// The window unit is WORD-KIND token distance. Two boundary samples make the
// sweep decisive: a "stress" BAD with RVC ~24 word tokens from a price (so a
// 20 window misses it), and a "far" GOOD with RVC ~45 word tokens from an
// unrelated price (so a 50+ window false-positives on it). Everything between
// is caught by the smallest window that clears both.

const filler = (n: number): string => Array(n).fill('word').join(' ');

/** RVC ~24 word tokens before a price — a genuine claim a tight window misses. */
const stressBad = contentBlock(prose(`RVC ${filler(23)} $5`));
/** RVC ~45 word tokens from an unrelated price — not a claim; a wide window over-flags. */
const goodFar = contentBlock(prose(`RVC ${filler(44)} $5`));

const BAD_BLOCKS: MarketingBlock[] = [
  contentBlock(prose('Buy RVC at $0.10 per token')),
  contentBlock(prose('RVC vesting unlocks 5% per quarter')),
  contentBlock(prose('Stake rvc and earn 5% APY')),
  contentBlock(prose('RVC is priced at 100 usd today')),
  contentBlock(prose('Get RVC for $1,000 in the presale')),
  contentBlock(prose('The RVC token now trades at $0.42')),
  contentBlock(prose('Earn 12% staking rewards on your RVC')),
  contentBlock(prose('RVC airdrop worth $500 for early holders')),
  contentBlock(prose('Each RVC costs $2.50 at launch')),
  contentBlock(prose('RVC yields 8% annually')),
  contentBlock(prose('rvc is available for 250 usd')),
  contentBlock(prose('Hold RVC and unlock 3% monthly bonuses')),
  contentBlock(prose('RVC presale price is $0.05')),
  contentBlock(prose('Trade RVC at $3.14 per coin')),
  contentBlock(prose('RVC rewards you 15% back')),
  contentBlock(prose('Buy 1000 RVC for $99')),
  contentBlock(prose('RVC staking returns 6% APY')),
  contentBlock(prose('The price of RVC hit $12,000 this year')),
  contentBlock(prose('Claim RVC worth 400 usd')),
  contentBlock(prose('RVC now at $0.001 per token')),
  contentBlock(prose('RVC bonus of $50 for referrals')),
  contentBlock(prose('rvc trades near $7 today')),
  contentBlock(prose('RVC APY is 9% this month')),
  contentBlock(prose('Purchase RVC at $250 each')),
  contentBlock(prose('RVC pays 5% quarterly')),
  contentBlock(prose('Lock RVC for $1,500 rewards')),
  contentBlock(prose('RVC valued at 30 usd')),
  contentBlock(prose('Stake RVC for 11% returns')),
  contentBlock(prose('RVC costs only $0.99')),
  contentBlock(prose('RVC drop worth $2,000 announced')),
  stressBad,
];

const GOOD_BLOCKS: MarketingBlock[] = [
  contentBlock(prose('RVC is our community governance token')),
  contentBlock(prose('The RVC roadmap ships next quarter')),
  contentBlock(prose('Join the RVC community on Discord')),
  contentBlock(prose('RVC holders vote on proposals')),
  contentBlock(prose('Learn how RVC governance works')),
  contentBlock(prose('The RVC whitepaper explains the design')),
  contentBlock(prose('RVC powers on-chain coordination')),
  contentBlock(prose('Our pricing starts at $99 monthly')),
  contentBlock(prose('Enterprise plans are $5,000 per year')),
  contentBlock(prose('Save 20% with annual billing')),
  contentBlock(prose('The Pro tier costs $49 a month')),
  contentBlock(prose('Get 30% off during launch week')),
  contentBlock(prose('Plans range from $0 to $499')),
  contentBlock(prose('Teams pay 100 usd per seat')),
  contentBlock(prose('The runtime is free and open source')),
  contentBlock(prose('RVC is a cancelled project token')),
  contentBlock(prose('RVC was retired in 2026')),
  contentBlock(prose('Read about the RVC governance model')),
  contentBlock(prose('RVC community calls happen weekly')),
  contentBlock(prose('The RVC token has no listed figure today')),
  contentBlock(prose('Our agents run on your infrastructure')),
  contentBlock(prose('Every agent leaves a receipt you can check')),
  contentBlock(prose('Deploy RevealUI in minutes')),
  contentBlock(prose('The marketplace charges a 20% commission')),
  contentBlock(prose('RVC documentation lives in the wiki')),
  contentBlock(prose('RVC contributors meet monthly')),
  contentBlock(prose('The RVC brand guidelines are internal')),
  contentBlock(prose('RVC is discussed in the forum')),
  contentBlock(prose('Annual plans cost $1,200 upfront')),
  contentBlock(prose('RVC governance is fully on-chain')),
  // Exoneration cases — window-independent:
  contentBlock(
    paragraph(
      text('RVC at $0.10 '),
      link('../docs/decisions/2026-05-12-rvc-pricing.md', 'per ADR'),
    ),
  ),
  contentBlock(code('RVC priced at $0.001')),
  goodFar,
];

const SWEEP = [20, 30, 40, 50, 60, 80];

function rvcRule(withinTokens: number): Rule {
  return {
    kind: 'rvc-pricing-proximity',
    ruleId: 'tier1.rvc-pricing-without-adr',
    anchorTokenLowercase: 'rvc',
    proximityPredicates: ['isDollarShape', 'isPercentShape', 'isUsdShape'],
    withinTokens,
    unless: 'adr-cite-in-block',
  };
}

function fires(block: MarketingBlock, withinTokens: number): boolean {
  return runTier1(block, [rvcRule(withinTokens)]).violations.length > 0;
}

function falseNegatives(withinTokens: number): number {
  return BAD_BLOCKS.filter((b) => !fires(b, withinTokens)).length;
}

function falsePositives(withinTokens: number): number {
  return GOOD_BLOCKS.filter((b) => fires(b, withinTokens)).length;
}

describe('RVC_PRICING_WITHIN_TOKENS calibration', () => {
  it('has a corpus of at least 30 known-bad and 30 known-good samples', () => {
    expect(BAD_BLOCKS.length).toBeGreaterThanOrEqual(30);
    expect(GOOD_BLOCKS.length).toBeGreaterThanOrEqual(30);
  });

  it('the pinned window catches every known-bad and flags no known-good', () => {
    expect(falseNegatives(RVC_PRICING_WITHIN_TOKENS)).toBe(0);
    expect(falsePositives(RVC_PRICING_WITHIN_TOKENS)).toBe(0);
  });

  it('the pinned window is the SMALLEST value in the sweep with zero FN and zero FP', () => {
    const valid = SWEEP.filter((w) => falseNegatives(w) === 0 && falsePositives(w) === 0);
    expect(valid.length).toBeGreaterThan(0);
    expect(Math.min(...valid)).toBe(RVC_PRICING_WITHIN_TOKENS);
  });
});
