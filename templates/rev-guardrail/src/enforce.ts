import { emptyDenyListWarning } from './locks.js';
import { containsPhrase, firstMatchingPhrase } from './match.js';
import { createReceipt } from './receipt.js';
import type { EnforceInput, EnforcementVerb, EnforceResult, ReceiptOutcome } from './types.js';

const WAIVER_PHRASES = [
  'waive snapshot',
  'waive Snapshot',
  'snapshot_before_checkpoint=optional',
  'snapshot_before_checkpoint: optional',
  'snapshot_before_checkpoint = optional',
] as const;

function writeReceipt(
  input: EnforceInput,
  details: {
    lockId: string;
    matchedString: string;
    outcome: ReceiptOutcome;
    verb: EnforcementVerb;
  },
): EnforceResult {
  input.receipts.append(
    createReceipt({
      actor: input.actor,
      artifactText: input.artifact.text,
      lockId: details.lockId,
      matchedString: details.matchedString,
      outcome: details.outcome,
      pathOrUrl: input.artifact.pathOrUrl,
      timestamp: (input.now ?? (() => new Date().toISOString()))(),
    }),
  );
  return {
    allowed: false,
    lockId: details.lockId,
    silentPass: false,
    verb: details.verb,
    warnings: [],
  };
}

function untrustedTriesWaiver(untrustedInputs: EnforceInput['untrustedInputs']): string | null {
  for (const item of untrustedInputs ?? []) {
    const hit = firstMatchingPhrase(item.text, WAIVER_PHRASES);
    if (hit) {
      return hit;
    }
  }
  return null;
}

function denyListIsEmpty(denyPatterns: readonly string[]): boolean {
  return denyPatterns.every((pattern) => pattern.trim().length === 0);
}

/**
 * Evaluate an artifact against file-backed locks.
 * Tool results, sibling text, web, and chat never rewrite locks.
 */
export function enforce(input: EnforceInput): EnforceResult {
  const warnings: string[] = [];
  const verbs = new Set(input.locks.enforcement_verbs);

  if (denyListIsEmpty(input.locks.overclaim.deny_patterns)) {
    warnings.push(emptyDenyListWarning());
  }

  const snapshotRequired = input.locks.snapshot_before_checkpoint === 'required';
  const needsSnapshot =
    snapshotRequired &&
    input.artifact.intent === 'checkpoint' &&
    input.artifact.hasSnapshot !== true;

  if (needsSnapshot && verbs.has('require_snapshot')) {
    const waiver = untrustedTriesWaiver(input.untrustedInputs);
    return writeReceipt(input, {
      lockId: 'snapshot_before_checkpoint',
      matchedString: waiver ?? 'checkpoint without snapshot',
      outcome: 'required',
      verb: 'require_snapshot',
    });
  }

  const denyHit = firstMatchingPhrase(input.artifact.text, input.locks.overclaim.deny_patterns);
  const allowHit = firstMatchingPhrase(
    input.artifact.text,
    input.locks.overclaim.vendor_soc2_allow_patterns,
  );

  if (denyHit && !allowHit && verbs.has('refuse_overclaim')) {
    return writeReceipt(input, {
      lockId: 'overclaim',
      matchedString: denyHit,
      outcome: 'blocked',
      verb: 'refuse_overclaim',
    });
  }

  if (input.locks.banned_icp_phrases.mode === 'enforced') {
    const icpHit = firstMatchingPhrase(
      input.artifact.text,
      input.locks.banned_icp_phrases.soft_list,
    );
    if (icpHit && verbs.has('needs_human')) {
      return writeReceipt(input, {
        lockId: 'banned_icp_phrases',
        matchedString: icpHit,
        outcome: 'needs_human',
        verb: 'needs_human',
      });
    }
  }

  if (input.locks.banned_icp_phrases.mode === 'optional') {
    const icpHit = firstMatchingPhrase(
      input.artifact.text,
      input.locks.banned_icp_phrases.soft_list,
    );
    if (icpHit) {
      warnings.push(`optional ICP phrase flagged: ${icpHit}`);
    }
  }

  const silentPass = warnings.length === 0;
  return {
    allowed: true,
    lockId: null,
    silentPass,
    verb: null,
    warnings,
  };
}

/** Untrusted text is never applied to locks. Exported for tests and operator docs. */
export function locksFromUntrustedText(_text: string): null {
  return null;
}

export function looksLikeWaiver(text: string): boolean {
  return WAIVER_PHRASES.some((phrase) => containsPhrase(text, phrase));
}
