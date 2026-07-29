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
 * SIGNING DEVIATION (recorded per the build brief, do not remove without
 * updating the report this shipped with): design doc §5 says to reuse an
 * existing signing primitive from `@revealui/security`, auditing at build
 * time for the exact fit. That package (`packages/security/src/*`) ships
 * only symmetric AES-GCM encryption (`encryption.ts`) and SHA-256/384/512
 * digests -- no asymmetric sign/verify primitive. The fleet's one Ed25519
 * sign/verify precedent (`packages/core/src/license.ts`, via `jose`) is
 * NOT in `@revealui/security` and pulling `jose` into `@revealui/harnesses`
 * would add a new dependency, which this build is scoped to avoid. Per the
 * documented fallback: this module does STRUCTURE validation only --
 * `PolicySnapshotSchema` requires `signature` and `keyId` fields to be
 * present and well-formed, but never cryptographically verifies them.
 * TODO(security, blocks a real "enforced" claim beyond structural validity):
 * once a signing primitive lands in `@revealui/security` (or `jose` is
 * accepted as a dependency here), replace `parsePolicySnapshot`'s structural
 * check with an actual signature verification before returning `valid: true`.
 */

import { readFile } from 'node:fs/promises';
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
 * A policy snapshot as read from disk. `signature` + `keyId` are present in
 * the schema so the format is ready for real verification (see the TODO
 * above); today they are checked for well-formedness only.
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
  | 'invalid-shape';

export type PolicySnapshotLoadResult =
  | { readonly valid: true; readonly snapshot: PolicySnapshot }
  | { readonly valid: false; readonly reason: PolicySnapshotInvalidReason };

/**
 * Load + structurally validate a policy snapshot from `path`. Never throws:
 * every failure mode (missing file, unreadable, malformed JSON, wrong
 * shape) collapses to `{ valid: false, reason }` so the caller's advisory
 * fallback (design invariant I-5) is unconditional.
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

  return { valid: true, snapshot: result.data };
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
