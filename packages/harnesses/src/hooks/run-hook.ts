/**
 * Hook Command Orchestration
 *
 * Wires together policy evaluation, normalization, and spooling for the
 * `hook <source>` CLI subcommand (multi-editor harness design doc §3-B).
 * Kept separate from `../cli.ts` so it is directly unit-testable without
 * mocking stdin/stdout/process.exit.
 */

import { homedir } from 'node:os';
import { join } from 'node:path';
import type { HarnessHookEvent, HarnessHookSource } from '../types/hook-event.js';
import { isImplementedHookSource, normalizeHookEvent } from './normalizers/index.js';
import type { PolicyDecision, PolicySnapshotLoadResult } from './policy.js';
import { evaluatePolicy, loadPolicySnapshot } from './policy.js';
import { appendToSpool } from './spool.js';

/** `~/.local/share/revealui` -- same data dir `cli.ts` uses for `harness.sock`. */
export function getHarnessDataDir(): string {
  return join(homedir(), '.local', 'share', 'revealui');
}

export function getDefaultSpoolPath(): string {
  return process.env.REVEALUI_HOOK_SPOOL_PATH ?? join(getHarnessDataDir(), 'hook-receipts.jsonl');
}

export function getDefaultPolicySnapshotPath(): string {
  return (
    process.env.REVEALUI_POLICY_SNAPSHOT_PATH ?? join(getHarnessDataDir(), 'policy-snapshot.json')
  );
}

export interface HookRunOptions {
  readonly spoolPath: string;
  readonly snapshotPath: string;
}

export function defaultHookRunOptions(): HookRunOptions {
  return { spoolPath: getDefaultSpoolPath(), snapshotPath: getDefaultPolicySnapshotPath() };
}

export interface HookRunResult {
  readonly event: HarnessHookEvent;
  readonly decision: PolicyDecision;
  readonly snapshotResult: PolicySnapshotLoadResult;
  /** The editor-native JSON body the CLI writes to stdout. */
  readonly responseJson: Record<string, unknown>;
  /** 2 when the decision is `deny` (Cursor + Claude Code both block on exit code 2), 0 otherwise. */
  readonly exitCode: number;
}

/** Build the Cursor-native permission response (cursor.com/docs/agent/hooks, verified 2026-07-17). */
function buildCursorResponse(decision: PolicyDecision): Record<string, unknown> {
  if (decision.permission === 'allow') {
    return { permission: 'allow' };
  }
  return {
    permission: decision.permission,
    user_message: decision.reason ?? 'Denied by RevealUI policy',
    agent_message: decision.reason ?? 'Denied by RevealUI policy',
  };
}

/** Build the Claude Code-native permission response. */
function buildClaudeCodeResponse(decision: PolicyDecision): Record<string, unknown> {
  if (decision.permission === 'deny') {
    return { decision: 'block', reason: decision.reason ?? 'Denied by RevealUI policy' };
  }
  if (decision.permission === 'ask') {
    return {
      decision: 'ask',
      reason: decision.reason ?? 'Requires confirmation per RevealUI policy',
    };
  }
  return { decision: 'approve' };
}

function buildEditorResponse(
  source: HarnessHookSource,
  decision: PolicyDecision,
): Record<string, unknown> {
  return source === 'cursor' ? buildCursorResponse(decision) : buildClaudeCodeResponse(decision);
}

/**
 * Run one hook invocation end to end: load the policy snapshot, normalize
 * `rawInput` for `source`, evaluate policy, spool the decision, and build
 * the editor-native response. Caller (the CLI) owns writing the response
 * and setting `process.exitCode`.
 */
export async function runHookCommand(
  source: Extract<HarnessHookSource, 'cursor' | 'claude-code'>,
  rawInput: unknown,
  options: HookRunOptions = defaultHookRunOptions(),
): Promise<HookRunResult> {
  if (!isImplementedHookSource(source)) {
    throw new Error(`No normalizer implemented for hook source "${source}"`);
  }

  const snapshotResult = await loadPolicySnapshot(options.snapshotPath);
  // Honest enforcement tier (design invariant I-5): a receipt may claim
  // `enforced` ONLY when the policy's authenticity is actually established.
  // `loadPolicySnapshot` does STRUCTURE validation only today -- it does not
  // cryptographically verify the snapshot signature (see policy.ts TODO), and
  // no org/team config-pinning detection exists yet either. Until at least one
  // of those lands, the tier is always `advisory`: a structurally valid
  // snapshot's deny/ask rules are STILL applied by `evaluatePolicy` below (they
  // can only tighten, never weaken -- defense in depth), but the receipt never
  // overclaims enforcement it cannot back up. Flip this to a real conditional
  // the moment signature verification ships.
  const enforcementTier = 'advisory' as const;

  const event = normalizeHookEvent(source, rawInput, enforcementTier);
  const decision = evaluatePolicy(snapshotResult, event);

  await appendToSpool({ event, decision, spooledAt: new Date().toISOString() }, options.spoolPath);

  return {
    event,
    decision,
    snapshotResult,
    responseJson: buildEditorResponse(source, decision),
    exitCode: decision.permission === 'deny' ? 2 : 0,
  };
}
