import type { MarketingBlock } from './blocks.js';
import { runTier1, runTier2 } from './check-rule.js';
import { type Rule, RVC_PRICING_WITHIN_TOKENS, type ValidationResult } from './rules.js';
import type { Tier3Judge, Tier3Report } from './tier3.js';

/** A voice rule with its tier + human description (spec §5.5 ports model). */
export interface VoiceRuleEntry {
  id: string;
  tier: 1 | 2 | 3;
  description: string;
  severity: 'high' | 'low';
  rule: Rule;
}

/**
 * Tier-1 rule set — structural, un-overridable anti-patterns. These are the
 * rules `runTier1(block, FLEET_VOICE_RULES)` enforces at admin save, the VES
 * `session.patch` gate, and CI over repo-committed block content.
 *
 * Tier-2 banned-word DATA (`FLEET_VOICE_RULES_TIER_2`) is Phase B admin scope;
 * GAP-332 ships the ENGINE that evaluates tier-2 rule kinds, with an empty
 * tier-2 set until Phase B populates it.
 */
export const FLEET_VOICE_RULES_TIER_1: VoiceRuleEntry[] = [
  {
    id: 'tier1.codename-leak.rvui',
    tier: 1,
    description: 'RVUI codename in customer copy',
    severity: 'high',
    rule: {
      kind: 'banned-tokens',
      ruleId: 'tier1.codename-leak.rvui',
      tokens: ['RVUI'],
      caseInsensitive: false,
    },
  },
  {
    id: 'tier1.rvc-pricing-without-adr',
    tier: 1,
    description: 'RVC (cancelled token) near a pricing figure without an ADR cite',
    severity: 'high',
    rule: {
      kind: 'rvc-pricing-proximity',
      ruleId: 'tier1.rvc-pricing-without-adr',
      anchorTokenLowercase: 'rvc',
      proximityPredicates: ['isDollarShape', 'isPercentShape', 'isUsdShape'],
      withinTokens: RVC_PRICING_WITHIN_TOKENS,
      unless: 'adr-cite-in-block',
    },
  },
  {
    id: 'tier1.rhetorical-question-heading',
    tier: 1,
    description: 'Rhetorical-question heading (interrogative opener + trailing ?)',
    severity: 'low',
    rule: {
      kind: 'h2-shape',
      ruleId: 'tier1.rhetorical-question-heading',
      predicates: [
        { kind: 'startsWithToken', token: 'why' },
        { kind: 'startsWithToken', token: 'what' },
        { kind: 'startsWithToken', token: 'how' },
        { kind: 'startsWithToken', token: 'is' },
        { kind: 'startsWithToken', token: 'are' },
        { kind: 'startsWithToken', token: 'can' },
        { kind: 'startsWithToken', token: 'should' },
        { kind: 'startsWithToken', token: 'do' },
        { kind: 'startsWithToken', token: 'does' },
        { kind: 'startsWithToken', token: 'will' },
        { kind: 'startsWithToken', token: 'ready' },
      ],
      requiresSuffixToken: '?',
    },
  },
  {
    id: 'tier1.fake-trust',
    tier: 1,
    description: 'Unsupported "Trusted by N" claim without an ADR cite',
    severity: 'high',
    rule: {
      kind: 'fake-trust',
      ruleId: 'tier1.fake-trust',
      anchor: { tokenSequence: ['trusted', 'by'], caseInsensitive: true },
      requiresProximity: 'positive-integer-token',
      withinTokens: 4,
      unless: 'adr-cite-in-block',
    },
  },
  {
    id: 'tier1.pricing-proximity',
    tier: 1,
    description: 'A dollar figure next to an engagement unit outside a pricing-tier source',
    severity: 'high',
    rule: {
      kind: 'pricing-proximity',
      ruleId: 'tier1.pricing-proximity',
      anchorPredicate: 'isDollarShape',
      proximityPredicate: 'isEngagementUnit',
      withinTokens: 6,
      unless: ['adr-cite-in-block', 'pricing-tier-source'],
    },
  },
  {
    id: 'tier1.em-dash',
    tier: 1,
    description: 'Em dash (U+2014) in customer copy',
    severity: 'low',
    rule: {
      kind: 'unicode-range-tokens',
      ruleId: 'tier1.em-dash',
      codepointRanges: [{ startInclusive: 0x2014, endInclusive: 0x2014 }],
    },
  },
];

/** Tier-2 banned-word rules — Phase B admin scope; empty until then. */
export const FLEET_VOICE_RULES_TIER_2: VoiceRuleEntry[] = [];

/** Flat rule list (tier-1 + tier-2), per spec §5.5. Used by `runTier1` + CI. */
export const FLEET_VOICE_RULES: Rule[] = [
  ...FLEET_VOICE_RULES_TIER_1.map((e) => e.rule),
  ...FLEET_VOICE_RULES_TIER_2.map((e) => e.rule),
];

/**
 * Tier-1 and tier-2 rules kept separate so a consumer (VES, the AI generate
 * flow) can gate tier-1 hard and tier-2 soft. A flat `Rule[]` cannot be
 * partitioned by tier (the engine dispatches by `kind`, not tier), so the
 * pipeline seam takes this structured set.
 */
export interface MarketingVoiceRules {
  tier1: Rule[];
  tier2: Rule[];
}

export const FLEET_MARKETING_VOICE_RULES: MarketingVoiceRules = {
  tier1: FLEET_VOICE_RULES_TIER_1.map((e) => e.rule),
  tier2: FLEET_VOICE_RULES_TIER_2.map((e) => e.rule),
};

export interface MarketingValidationReport {
  tier1: ValidationResult;
  tier2: ValidationResult;
  /** Null unless a Tier-3 judge is injected. Advisory only — never gates here. */
  tier3: Tier3Report | null;
  /** Tier 1 AND Tier 2 pass. Tier 3 is advisory and excluded from `passed`. */
  passed: boolean;
}

/**
 * The single validation seam CI, admin save, and the VES `session.patch` gate
 * all consume. Pure and synchronous when no Tier-3 judge is injected. Runs
 * `runTier1` then `runTier2` over the same engine; calls the judge only if
 * supplied.
 */
export function validateMarketingBlock(
  block: MarketingBlock,
  rules: MarketingVoiceRules,
  opts?: { tier3?: Tier3Judge },
): MarketingValidationReport {
  const tier1 = runTier1(block, rules.tier1);
  const tier2 = runTier2(block, rules.tier2);
  const tier3 = opts?.tier3 ? opts.tier3(block) : null;
  return { tier1, tier2, tier3, passed: tier1.passed && tier2.passed };
}
