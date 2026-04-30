/**
 * No-sandbox provider (GAP-161).
 *
 * Runs the agent skill IN-PROCESS in the executor — no isolation. Mirrors the
 * pre-GAP-161 behavior of `runAgentTask`.
 *
 * **Only valid for fully-trusted contexts** — typically:
 *   - Forge customer deployments where the operator runs only their own
 *     reviewed agent code (no public marketplace exposure).
 *   - Dev / test environments where fork-overhead is a measurable nuisance.
 *
 * Hosted SaaS deployments (revealui.com) MUST use `forkProvider()` — this
 * provider trades safety for simplicity.
 *
 * Naming follows the sandcastle convention (`noSandbox()`); the explicit
 * "no-sandbox" tag in logs makes the unsafe choice visible at audit time.
 */

import type { SandboxProvider, SandboxResult, SandboxRunOptions } from './types.js';

export interface NoSandboxProviderOptions {
  /**
   * Caller-supplied promise-of-result generator. Tests substitute a function
   * that simulates adversarial behavior; production callers leave this
   * undefined and get the same stub the fork target runs.
   */
  readonly run?: (
    opts: SandboxRunOptions,
  ) => Promise<Omit<SandboxResult, 'success'> & { success: boolean }>;
}

export function noSandboxProvider(options: NoSandboxProviderOptions = {}): SandboxProvider {
  const runner = options.run ?? defaultStub;
  return {
    tag: 'no-sandbox',
    name: 'no-sandbox',
    async run(opts: SandboxRunOptions): Promise<SandboxResult> {
      try {
        return await runner(opts);
      } catch (err) {
        return {
          success: false,
          output: null,
          artifacts: [],
          tokensUsed: 0,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  };
}

async function defaultStub(opts: SandboxRunOptions): Promise<SandboxResult> {
  // Mirror revmarket-task-runner.mjs's stub. When real agent dispatch lands,
  // both providers should call the shared dispatcher.
  return {
    success: true,
    output: {
      taskId: opts.taskId,
      skillName: opts.skillName,
      status: 'executed',
      message: 'Task processed by RevMarket sandbox runner',
    },
    artifacts: [],
    tokensUsed: 0,
  };
}
