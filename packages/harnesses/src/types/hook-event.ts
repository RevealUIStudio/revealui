/**
 * Normalized Hook Event Schema
 *
 * The three editor hook schemas this package normalizes (Claude Code, Cursor,
 * and -- once a VS Code agent-plugin adapter ships -- VS Code agent hooks)
 * have converged on the same lifecycle-callback shape: a JSON payload over
 * stdin, a JSON permission decision over stdout, canonical lifecycle names.
 * `HarnessHookEvent` is the one internal shape every per-editor normalizer
 * (`../hooks/normalizers/`) maps its native payload onto, so the CLI's
 * `hook <source>` subcommand, the local policy evaluator, and the receipt
 * spool all operate on a single schema regardless of which editor emitted
 * the event.
 *
 * Trust boundary (multi-editor harness design invariant I-1): every editor
 * client is untrusted. Editor-supplied identity strings -- Cursor's
 * `user_email`, an ACP `clientInfo` block, any other human-readable field a
 * hook payload carries -- are NEVER promoted to a normalized identity field
 * here. `HarnessHookIdentity` carries only session/generation-scoped
 * correlation ids (conversation id, generation id, model id), which are
 * request-shaped metadata, not authorization identity. Authorization
 * identity is derived exclusively from the device token on the request that
 * eventually flushes a receipt (the receipts-ingest server surface, a
 * separate build phase) -- never from anything inside `raw`. Human-readable
 * identity strings may still be READ off the raw payload for display
 * purposes; they must stay under `raw` and must never be copied onto
 * `HarnessHookIdentity` or any other normalized field.
 */

/** The eleven canonical lifecycle points every editor hook schema maps onto. */
export type HarnessHookEventKind =
  | 'session-start'
  | 'session-end'
  | 'pre-tool'
  | 'post-tool'
  | 'pre-shell'
  | 'post-shell'
  | 'pre-mcp'
  | 'post-mcp'
  | 'file-edit'
  | 'prompt-submit'
  | 'stop';

/** All valid event kinds as a readonly array (iteration / membership checks). */
export const HARNESS_HOOK_EVENT_KINDS: readonly HarnessHookEventKind[] = [
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
] as const;

/** Editors this package can normalize a hook payload from. */
export type HarnessHookSource = 'cursor' | 'claude-code' | 'vscode' | 'opencode' | 'grok';

/** All valid sources as a readonly array (iteration / membership checks). */
export const HARNESS_HOOK_SOURCES: readonly HarnessHookSource[] = [
  'cursor',
  'claude-code',
  'vscode',
  'opencode',
  'grok',
] as const;

/**
 * Honest enforcement signal (design invariant I-5): `'enforced'` only when a
 * signed, structurally valid policy snapshot governed the decision;
 * `'advisory'` whenever no snapshot, an unparseable snapshot, or an
 * unsigned/unverifiable one was in effect. A receipt must never claim
 * `'enforced'` it cannot back up -- user-level hook config is user-removable
 * unless pinned by a Cursor Team/Enterprise tier or a VS Code org policy, and
 * the receipt's `enforcementTier` is the honest record of which was true for
 * this specific decision, not an aspiration.
 *
 * Implementation status: `run-hook.ts` emits `'advisory'` for every decision
 * today, because policy-snapshot signature verification is not yet implemented
 * (`policy.ts` does structure validation only). The `'enforced'` value stays in
 * the type for the moment real verification (or org/team config-pinning
 * detection) lands; until then no code path may produce it. A structurally
 * valid snapshot's deny/ask rules are still applied -- only the tier label is
 * held back, so the receipt never overstates the guarantee.
 */
export type HarnessEnforcementTier = 'enforced' | 'advisory';

/**
 * Session/generation-scoped correlation ids carried by the editor's hook
 * payload. Deliberately NOT an identity type -- see the module doc above.
 */
export interface HarnessHookIdentity {
  readonly conversationId?: string;
  readonly generationId?: string;
  readonly modelId?: string;
}

interface HarnessHookEventCommon {
  /** Which editor's hook payload this event was normalized from. */
  readonly source: HarnessHookSource;
  /** Normalize-time timestamp (ISO 8601) -- not all editor payloads carry their own. */
  readonly timestamp: string;
  readonly identity: HarnessHookIdentity;
  /** Tool/command name for pre-tool/post-tool/pre-mcp/post-mcp events. */
  readonly toolName?: string;
  /** Shell command text for pre-shell/post-shell events. */
  readonly command?: string;
  /** Absolute file paths touched, for file-edit (and file-read-shaped) events. */
  readonly filePaths?: readonly string[];
  readonly enforcementTier: HarnessEnforcementTier;
  /** The untouched, editor-native payload this event was normalized from. */
  readonly raw: unknown;
}

/**
 * One normalized hook event. Discriminated on `kind` so a consumer can
 * narrow with a plain switch; every member shares the same normalized field
 * set (`HarnessHookEventCommon`) because the eleven kinds differ in which
 * optional fields are populated, not in shape.
 */
export type HarnessHookEvent =
  | ({ readonly kind: 'session-start' } & HarnessHookEventCommon)
  | ({ readonly kind: 'session-end' } & HarnessHookEventCommon)
  | ({ readonly kind: 'pre-tool' } & HarnessHookEventCommon)
  | ({ readonly kind: 'post-tool' } & HarnessHookEventCommon)
  | ({ readonly kind: 'pre-shell' } & HarnessHookEventCommon)
  | ({ readonly kind: 'post-shell' } & HarnessHookEventCommon)
  | ({ readonly kind: 'pre-mcp' } & HarnessHookEventCommon)
  | ({ readonly kind: 'post-mcp' } & HarnessHookEventCommon)
  | ({ readonly kind: 'file-edit' } & HarnessHookEventCommon)
  | ({ readonly kind: 'prompt-submit' } & HarnessHookEventCommon)
  | ({ readonly kind: 'stop' } & HarnessHookEventCommon);
