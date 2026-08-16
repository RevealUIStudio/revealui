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
import { checkPublicSecurityComment } from '../gates/public-security-comment-gate.js';
import type {
  HarnessHookEvent,
  HarnessHookEventKind,
  HarnessHookSource,
} from '../types/hook-event.js';
import { emitMasterSpecCouplingWarnings } from './master-spec-coupling.js';
import type { ImplementedHookSource } from './normalizers/index.js';
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
  /**
   * False when the receipt could not be written to the local spool (unwritable
   * data dir, disk full, read-only fs, rotate error). The decision is still
   * delivered regardless -- see the fail-closed note in `runHookCommand`.
   */
  readonly spooled: boolean;
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

/**
 * Build the Grok-native PreToolUse permission response
 * (Grok hooks guide: allow | deny + optional reason).
 */
function buildGrokResponse(decision: PolicyDecision): Record<string, unknown> {
  if (decision.permission === 'deny') {
    return {
      decision: 'deny',
      reason: decision.reason ?? 'Denied by RevealUI policy',
    };
  }
  if (decision.permission === 'ask') {
    // Grok has no documented ask; surface as deny with reason so policy floors hold.
    return {
      decision: 'deny',
      reason: decision.reason ?? 'Requires confirmation per RevealUI policy',
    };
  }
  return { decision: 'allow' };
}

/** Event kinds that correspond to VS Code's `PreToolUse` hook. */
const VSCODE_PRE_TOOL_KINDS: ReadonlySet<HarnessHookEventKind> = new Set([
  'pre-tool',
  'pre-shell',
  'pre-mcp',
]);

/**
 * Build the VS Code-native hook response (code.visualstudio.com/docs/agents/reference/hooks-reference,
 * verified 2026-07-17). `PreToolUse` is the only VS Code hook event with a
 * documented nested `hookSpecificOutput.permissionDecision` contract
 * (`allow`/`deny`/`ask`, plus `permissionDecisionReason`); every other event
 * -- including `PostToolUse`, whose response the same reference documents as
 * a flat `decision` field -- uses the flat `decision`/`reason` shape, which
 * matches Claude Code's own convention. VS Code's hooks system reads as a
 * deliberate wire-format convergence with Claude Code's (see the module doc
 * in `./normalizers/vscode.ts`), so `buildClaudeCodeResponse`'s shape is
 * reused for the non-`PreToolUse` case rather than re-deriving an equivalent
 * shape from scratch.
 */
function buildVSCodeResponse(
  kind: HarnessHookEventKind,
  decision: PolicyDecision,
): Record<string, unknown> {
  if (VSCODE_PRE_TOOL_KINDS.has(kind)) {
    return {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: decision.permission,
        ...(decision.reason ? { permissionDecisionReason: decision.reason } : {}),
      },
    };
  }
  return buildClaudeCodeResponse(decision);
}

function buildEditorResponse(
  source: HarnessHookSource,
  decision: PolicyDecision,
  kind: HarnessHookEventKind,
): Record<string, unknown> {
  if (source === 'cursor') return buildCursorResponse(decision);
  if (source === 'vscode') return buildVSCodeResponse(kind, decision);
  if (source === 'grok') return buildGrokResponse(decision);
  return buildClaudeCodeResponse(decision);
}

/**
 * Run one hook invocation end to end: load the policy snapshot, normalize
 * `rawInput` for `source`, evaluate policy, spool the decision, and build
 * the editor-native response. Caller (the CLI) owns writing the response
 * and setting `process.exitCode`.
 */
export async function runHookCommand(
  source: ImplementedHookSource,
  rawInput: unknown,
  options: HookRunOptions = defaultHookRunOptions(),
): Promise<HookRunResult> {
  if (!isImplementedHookSource(source)) {
    throw new Error(`No normalizer implemented for hook source "${source}"`);
  }

  const snapshotResult = await loadPolicySnapshot(options.snapshotPath);
  // Honest enforcement tier (design invariant I-5): a receipt may claim
  // `enforced` ONLY when the policy signature cryptographically verifies
  // (`cryptoVerified`). Structurally valid / unsigned snapshots still apply
  // deny/ask rules below (they can only tighten), but the receipt stays
  // `advisory` so we never overclaim enforcement. Org/team hook-config
  // pinning is a separate future signal and is not claimed here.
  const enforcementTier =
    snapshotResult.valid && snapshotResult.cryptoVerified
      ? ('enforced' as const)
      : ('advisory' as const);

  const event = normalizeHookEvent(source, rawInput, enforcementTier);
  let decision = evaluatePolicy(snapshotResult, event);

  // Safety floor (not snapshot-optional): public GitHub must not receive
  // adversarial security-review writeups. Tightens only.
  if (decision.permission !== 'deny' && event.command) {
    const commentGate = checkPublicSecurityComment(event.command);
    if (commentGate.block) {
      decision = {
        permission: 'deny',
        reason: commentGate.reason ?? 'Denied by public-security-comment gate',
      };
    }
  }

  // GAP-199 native twin: warn-only when file-edit (or post-tool with paths)
  // touches contract/schema/app code without the product canon doc dirty.
  // Never changes the permission decision — advisory only. Claude-side adapter
  // invokes the same evaluatePolicy path via runHookCommand (no twin script).
  if (
    (event.kind === 'file-edit' || event.kind === 'post-tool') &&
    event.filePaths &&
    event.filePaths.length > 0
  ) {
    emitMasterSpecCouplingWarnings(event.filePaths);
  }

  // Fail CLOSED on a spool-write failure. If appendToSpool throws (unwritable
  // data dir on first run, disk full, read-only fs, or a non-ENOENT rotate
  // error) the policy DECISION must still reach the editor: were the throw to
  // propagate, the CLI would exit without writing a response and the editor's
  // default (allow) would win -- turning a spool-write failure into a silent
  // enforcement bypass of a computed `deny`. Warn so the dropped receipt is
  // visible (availability/audit-completeness cost), but never drop the decision.
  let spooled = true;
  try {
    await appendToSpool(
      { event, decision, spooledAt: new Date().toISOString() },
      options.spoolPath,
    );
  } catch (err) {
    spooled = false;
    const reason = err instanceof Error ? err.message : String(err);
    process.stderr.write(
      `revealui-harnesses hook: receipt spool write failed (${reason}); decision still enforced, receipt dropped\n`,
    );
  }

  return {
    event,
    decision,
    snapshotResult,
    responseJson: buildEditorResponse(source, decision, event.kind),
    exitCode: decision.permission === 'deny' ? 2 : 0,
    spooled,
  };
}
