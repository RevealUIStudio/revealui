/**
 * Local Hook Policy Evaluation
 *
 * Implements multi-editor harness design doc §3-B "availability-first
 * delivery" + design invariant I-5: policy DENIES are evaluated locally and
 * synchronously against a cached, signed policy snapshot, so enforcement
 * works offline and adds no per-event network hop. A missing or invalid
 * snapshot degrades to advisory mode and SAYS SO -- it never silently
 * claims enforcement it cannot back up.
 *
 * Cryptographic verification (GAP-381 residual, 2026-08-07): uses
 * `@revealui/security/server` Ed25519 (same wire format as audit Stage 3).
 * A structurally valid but unsigned / unverified snapshot still evaluates
 * rules (denies can only tighten) but reports `cryptoVerified: false` so
 * receipts stay `advisory`. Only a verified signature yields
 * `cryptoVerified: true` and allows an `enforced` receipt tier.
 */

import { readFile } from 'node:fs/promises';
import {
  createPolicySnapshotSignerFromEnv,
  UNSIGNED_POLICY_KEY_ID,
  UNSIGNED_POLICY_SIGNATURE,
  verifyPolicySnapshot,
} from '@revealui/security/server';
import { z } from 'zod';
import type {
  HarnessHookEvent,
  HarnessHookEventKind,
  HarnessHookSource,
} from '../types/hook-event.js';

/** One rule in a policy snapshot: matches on any combination of scope fields. */
export interface PolicySnapshotRule {
  readonly source?: HarnessHookSource;
  readonly kind?: HarnessHookEventKind;
  readonly toolName?: string;
  readonly permission: 'deny' | 'ask';
  readonly reason: string;
}

/**
 * A policy snapshot as read from disk. `signature` + `keyId` are required
 * fields; cryptographic validity is reported via `cryptoVerified` on the
 * load result, not by inventing a second document shape.
 */
export interface PolicySnapshot {
  readonly version: number;
  readonly keyId: string;
  readonly signature: string;
  readonly issuedAt: string;
  readonly rules: readonly PolicySnapshotRule[];
}

const PolicySnapshotRuleSchema = z.object({
  source: z.enum(['cursor', 'claude-code', 'vscode', 'opencode', 'grok']).optional(),
  kind: z
    .enum([
      'session-start',
      'session-end',
      'pre-tool',
      'post-tool',
      'pre-shell',
      'post-shell',
      'pre-mcp',
      'post-mcp',
      'file-edit',
      'prompt-submit',
      'stop',
    ])
    .optional(),
  toolName: z.string().min(1).optional(),
  permission: z.enum(['deny', 'ask']),
  reason: z.string().min(1),
});

const PolicySnapshotSchema = z.object({
  version: z.number().int().positive(),
  keyId: z.string().min(1),
  signature: z.string().min(1),
  issuedAt: z.string().min(1),
  rules: z.array(PolicySnapshotRuleSchema),
});

/** Why a snapshot load did not produce a usable, valid snapshot. */
export type PolicySnapshotInvalidReason =
  | 'missing'
  | 'unreadable'
  | 'invalid-json'
  | 'invalid-shape'
  | 'invalid-signature';

export type PolicySnapshotLoadResult =
  | {
      readonly valid: true;
      readonly snapshot: PolicySnapshot;
      /**
       * True only when the Ed25519 signature verified against a known public
       * key. Receipts may claim `enforced` only when this is true (I-5).
       */
      readonly cryptoVerified: boolean;
    }
  | { readonly valid: false; readonly reason: PolicySnapshotInvalidReason };

/**
 * Load + validate a policy snapshot from `path`. Never throws: every
 * failure mode collapses to `{ valid: false, reason }` so the caller's
 * advisory fallback (design invariant I-5) is unconditional.
 *
 * When a public key is available (env), cryptographic verification is
 * required for non-placeholder signatures: a bad signature is
 * `invalid-signature` (not a silent valid document).
 */
export async function loadPolicySnapshot(path: string): Promise<PolicySnapshotLoadResult> {
  let contents: string;
  try {
    contents = await readFile(path, 'utf8');
  } catch (err) {
    const code =
      err && typeof err === 'object' && 'code' in err ? (err as { code?: string }).code : undefined;
    return { valid: false, reason: code === 'ENOENT' ? 'missing' : 'unreadable' };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(contents);
  } catch {
    return { valid: false, reason: 'invalid-json' };
  }

  const result = PolicySnapshotSchema.safeParse(parsedJson);
  if (!result.success) {
    return { valid: false, reason: 'invalid-shape' };
  }

  const snapshot = result.data;
  const isPlaceholder =
    snapshot.signature === UNSIGNED_POLICY_SIGNATURE || snapshot.keyId === UNSIGNED_POLICY_KEY_ID;

  if (isPlaceholder) {
    return { valid: true, snapshot, cryptoVerified: false };
  }

  const { resolvePublicKey, mode } = createPolicySnapshotSignerFromEnv(process.env);
  if (mode === 'unsigned') {
    // Structurally valid signed-looking document but no local public key:
    // apply rules defensively, never claim enforced (I-5).
    return { valid: true, snapshot, cryptoVerified: false };
  }

  const verified = verifyPolicySnapshot(snapshot, resolvePublicKey);
  if (!verified.valid) {
    return { valid: false, reason: 'invalid-signature' };
  }

  return { valid: true, snapshot, cryptoVerified: true };
}

/** The local policy decision for one hook event. */
export interface PolicyDecision {
  readonly permission: 'allow' | 'deny' | 'ask';
  readonly reason?: string;
  /** The rule (if any) that produced a non-allow decision. */
  readonly matchedRule?: PolicySnapshotRule;
}

function ruleMatches(rule: PolicySnapshotRule, event: HarnessHookEvent): boolean {
  if (rule.source && rule.source !== event.source) return false;
  if (rule.kind && rule.kind !== event.kind) return false;
  if (rule.toolName && rule.toolName !== event.toolName) return false;
  return true;
}

/**
 * Evaluate `event` against a snapshot load result. An invalid/missing
 * snapshot always allows (advisory mode allows everything -- design
 * invariant I-5); a valid snapshot evaluates its rules in order and returns
 * the first match.
 */
export function evaluatePolicy(
  loadResult: PolicySnapshotLoadResult,
  event: HarnessHookEvent,
): PolicyDecision {
  if (!loadResult.valid) {
    return { permission: 'allow' };
  }

  for (const rule of loadResult.snapshot.rules) {
    if (ruleMatches(rule, event)) {
      return { permission: rule.permission, reason: rule.reason, matchedRule: rule };
    }
  }

  return { permission: 'allow' };
}
