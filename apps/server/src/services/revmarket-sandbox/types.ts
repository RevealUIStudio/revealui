/**
 * RevMarket sandbox provider interface (GAP-161 Phase B).
 *
 * The sandbox layer is the boundary between the trusted executor and untrusted
 * agent code. Today the only provider is `forkProvider()` (Node `child_process.fork`
 * per task — Option A in GAP-161), but the interface accepts future providers
 * (containerized — Docker / Podman / Firecracker; isolated-vm; WASM) without
 * touching the executor.
 *
 * Inspiration: `mattpocock/sandcastle` provider pattern, slimmed for one-shot
 * task execution (no worktree / branch / shell-exec semantics — those are
 * sandcastle's domain, not ours).
 */

export interface SandboxProvider {
  /** Stable variant tag — distinguishes provider families for routing logic. */
  readonly tag: 'fork' | 'no-sandbox' | string;
  /** Display name for logs / observability. */
  readonly name: string;
  /**
   * Execute a single task in the sandbox.
   *
   * Implementations are responsible for:
   *   1. Honoring the abort signal — SIGTERM grace + SIGKILL escalation, or
   *      cooperative cancellation depending on provider semantics.
   *   2. Memory enforcement up to `maxMemoryMb` (best-effort per provider —
   *      `forkProvider` uses `--max-old-space-size`; container providers will
   *      use cgroup limits).
   *   3. Filesystem isolation appropriate to the provider's threat model.
   *   4. Cleanup of any per-task state (tmpdirs, containers, etc.).
   *
   * Must NOT throw on sandbox-internal failures — those should surface as
   * `{ success: false, error }` so the executor can transition the task to
   * `failed` cleanly and write the audit trail.
   *
   * MAY throw only on provider-misconfiguration errors (e.g. fork target
   * script missing, container daemon unreachable) since those represent
   * operator bugs, not agent failures.
   */
  run(opts: SandboxRunOptions): Promise<SandboxResult>;
}

export interface SandboxRunOptions {
  /** Marketplace task ID (used for tmpdir naming, log correlation). */
  readonly taskId: string;
  /** Marketplace agent ID — surfaced to the runner so the agent can self-identify. */
  readonly agentId: string;
  /** Skill name within the agent — selects which entrypoint runs. */
  readonly skillName: string;
  /** Caller-supplied input payload (already validated against skill input schema). */
  readonly input: Record<string, unknown>;
  /** Aborted by the executor on timeout, user cancel, or executor shutdown. */
  readonly signal: AbortSignal;
  /** Per-task memory cap in MB. Honored best-effort. */
  readonly maxMemoryMb: number;
  /**
   * Maximum execution time in ms. Sandbox should escalate (SIGTERM → grace →
   * SIGKILL) at this boundary. Caller's `signal` will fire at the same time
   * but the sandbox is responsible for actually killing the process.
   */
  readonly maxExecMs: number;
}

export interface SandboxResult {
  readonly success: boolean;
  readonly output: Record<string, unknown> | null;
  readonly artifacts: ReadonlyArray<{ name: string; url: string; mimeType: string }>;
  readonly tokensUsed: number;
  readonly error?: string;
}

/**
 * Wire-format messages over the provider's IPC / IO channel. Stable so the
 * fork-target script can be a plain `.mjs` file independent of TS types here.
 */
export type RunnerInboundMessage = {
  readonly type: 'task';
  readonly taskId: string;
  readonly agentId: string;
  readonly skillName: string;
  readonly input: Record<string, unknown>;
};

export type RunnerOutboundMessage = {
  readonly type: 'result';
  readonly success: boolean;
  readonly output: Record<string, unknown> | null;
  readonly artifacts: ReadonlyArray<{ name: string; url: string; mimeType: string }>;
  readonly tokensUsed: number;
  readonly error?: string;
};
