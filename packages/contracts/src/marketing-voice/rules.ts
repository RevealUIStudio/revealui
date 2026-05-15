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
