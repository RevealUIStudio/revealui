export type Rule =
  | { kind: 'banned-tokens'; ruleId: string; tokens: string[]; caseInsensitive: boolean }
  | {
      kind: 'banned-tokens-with-context';
      ruleId: string;
      tokens: string[];
      unlessFollowedBy?: string[];
      unlessPrecededByContiguous?: string[];
    }
  | {
      kind: 'banned-token-sequences';
      ruleId: string;
      sequences: string[][];
      caseInsensitive: boolean;
    }
  | {
      kind: 'banned-token-near';
      ruleId: string;
      anchor: { tokens: string[]; caseInsensitive: boolean };
      near: { tokens: string[] };
      withinTokens: number;
    }
  | {
      kind: 'h2-shape';
      ruleId: string;
      predicates: H2ShapePredicate[];
      requiresSuffixToken?: string;
    }
  | {
      kind: 'fake-trust';
      ruleId: string;
      anchor: { tokenSequence: string[]; caseInsensitive: boolean };
      requiresProximity: 'positive-integer-token';
      withinTokens: number;
      unless: 'adr-cite-in-block';
    }
  | {
      kind: 'pricing-proximity';
      ruleId: string;
      anchorPredicate: PredicateName;
      proximityPredicate: PredicateName;
      withinTokens: number;
      unless: ProximityException[];
    }
  | {
      kind: 'rvc-pricing-proximity';
      ruleId: string;
      anchorTokenLowercase: string;
      proximityPredicates: PredicateName[];
      withinTokens: number;
      unless: 'adr-cite-in-block';
    }
  | {
      kind: 'unicode-range-tokens';
      ruleId: string;
      codepointRanges: Array<{ startInclusive: number; endInclusive: number }>;
    };

export type H2ShapePredicate =
  | { kind: 'startsWithToken'; token: string }
  | { kind: 'startsWithTokenSequence'; tokens: string[] };

export type PredicateName =
  | 'isDollarShape'
  | 'isPercentShape'
  | 'isUsdShape'
  | 'isEngagementUnit'
  | 'isPositiveIntegerToken';

export type ProximityException = 'adr-cite-in-block' | 'pricing-tier-source';

export interface Violation {
  rule: string;
  field: string;
  message: string;
  span?: { start: number; end: number };
}

export interface ValidationResult {
  passed: boolean;
  violations: Violation[];
}

/**
 * Proximity window, in WORD-KIND token distance, for the `rvc-pricing-proximity`
 * rule (spec §5.2 Rule T1.N). An `rvc` anchor with a pricing figure this many
 * word tokens away (in either direction, within one prose container) is a
 * pricing claim about the cancelled RevealCoin token and must cite an ADR.
 *
 * The unit is word-token distance, NOT characters: the proximity scanner
 * windows over word tokens, and symbol tokens (`$`, `%`) are matched adjacently
 * rather than counted in the window.
 *
 * Calibrated by __tests__/proximity-calibration.test.ts against a 60+ sample
 * corpus (≥30 known-bad that must block, ≥30 known-good that must not). This is
 * the smallest value in the sweep [20,30,40,50,60,80] that catches every
 * known-bad without flagging any known-good — a tighter window is the lower
 * false-positive risk when several pass. See that test for the reproducible
 * sweep. Not a magic number.
 */
export const RVC_PRICING_WITHIN_TOKENS = 30;
