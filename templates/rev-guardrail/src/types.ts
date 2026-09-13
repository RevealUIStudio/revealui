/**
 * Shared REV Guardrail types. Lock policy is file/config, never chat.
 */

export const ENFORCEMENT_VERBS = [
  'block_publish',
  'require_snapshot',
  'refuse_overclaim',
  'needs_human',
] as const;

export type EnforcementVerb = (typeof ENFORCEMENT_VERBS)[number];

export const RECEIPT_OUTCOMES = ['blocked', 'required', 'needs_human', 'override'] as const;

export type ReceiptOutcome = (typeof RECEIPT_OUTCOMES)[number];

export type ArtifactIntent = 'draft' | 'checkpoint' | 'publish';

export type UntrustedSource = 'tool_result' | 'sibling' | 'web' | 'chat';

export interface CashLadderOffer {
  label: string;
  price_usd: number;
}

export interface GuardrailLocks {
  version: string;
  note: string;
  lanes: {
    one_owner_per_ship: boolean;
    ships: ReadonlyArray<{ id: string; owner: string }>;
  };
  cash_ladder: {
    consultation: CashLadderOffer;
    launch: CashLadderOffer;
    pilot: CashLadderOffer;
  };
  snapshot_before_checkpoint: 'required' | 'optional';
  overclaim: {
    deny_patterns: string[];
    vendor_soc2_allow_patterns: string[];
    empty_deny_list: 'warn';
  };
  banned_icp_phrases: {
    mode: 'optional' | 'enforced';
    soft_list: string[];
  };
  enforcement_verbs: EnforcementVerb[];
}

export interface GuardrailReceipt {
  lockId: string;
  matchedString: string;
  pathOrUrl: string;
  actor: string;
  timestamp: string;
  outcome: ReceiptOutcome;
  contentHash: string;
}

export interface ArtifactInput {
  text: string;
  pathOrUrl: string;
  intent: ArtifactIntent;
  hasSnapshot?: boolean;
}

export interface UntrustedInput {
  source: UntrustedSource;
  text: string;
}

export interface ReceiptWriter {
  readonly entries: readonly GuardrailReceipt[];
  append(receipt: GuardrailReceipt): void;
}

export interface EnforceInput {
  locks: GuardrailLocks;
  artifact: ArtifactInput;
  actor: string;
  receipts: ReceiptWriter;
  untrustedInputs?: readonly UntrustedInput[];
  now?: () => string;
}

export interface EnforceResult {
  allowed: boolean;
  verb: EnforcementVerb | null;
  lockId: string | null;
  warnings: string[];
  /** True only when every applicable lock passed with no warning. Empty deny-list is never silent. */
  silentPass: boolean;
}
