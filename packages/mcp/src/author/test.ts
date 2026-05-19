/**
 * `@revealui/mcp/author/test` — testing harness for in-development MCP servers.
 *
 * Phase 1.6 stub. The final shape:
 *
 * 1. Caller points at an MCP-server entry file (typically `dist/index.js`
 *    from a `scaffold`-generated project).
 * 2. The harness spawns the server over stdio, runs the supplied tool calls,
 *    and returns per-call pass/fail with the underlying MCP error payload
 *    when a call fails.
 * 3. Authoring loop: `pnpm build && pnpm exec mcp-author test` → fast feedback
 *    without standing up a real Claude / Cursor client.
 *
 * The harness deliberately stays MCP-protocol-shaped (no Studio-specific
 * assumptions, no revmarket-specific manifest validation) so that authors
 * targeting any venue can use it. Venue-specific compliance checks live in
 * the publish step, not here.
 */

import { AuthorSdkNotImplementedError } from './errors.js';

export interface ToolCallSpec {
  /** Tool name registered by the server under test. */
  name: string;

  /** Arguments to send. Validated by the server's Zod schema on receipt. */
  args: unknown;

  /**
   * Optional assertion on the call's return value. The harness invokes this
   * after the server responds; throwing inside `expect` records the test as
   * failed. If omitted, the call counts as passing whenever the server
   * doesn't return an error.
   */
  expect?: (result: unknown) => void | Promise<void>;
}

export interface TestHarnessOptions {
  /** Absolute path to the server entry file (usually `dist/index.js`). */
  serverPath: string;

  /** Tool calls to run, in order, against a single long-lived server process. */
  toolCalls: ToolCallSpec[];

  /**
   * Per-call timeout in milliseconds. Defaults to 5000. A call that exceeds
   * this fails with `{ ok: false, error: 'timeout' }` and the harness moves on.
   */
  timeoutMs?: number;
}

export interface ToolCallResult {
  tool: string;
  ok: boolean;
  /** Populated when `ok` is `false`; either the MCP error payload or a harness reason. */
  error?: string;
  /** Populated when `ok` is `true`; the raw return value the server produced. */
  result?: unknown;
}

export interface TestHarnessResult {
  passed: number;
  failed: number;
  results: ToolCallResult[];
}

/**
 * Phase 1.6 stub — throws `AuthorSdkNotImplementedError`. See module JSDoc
 * for the concrete-implementation contract.
 */
export async function runTestHarness(_opts: TestHarnessOptions): Promise<TestHarnessResult> {
  throw new AuthorSdkNotImplementedError('runTestHarness', '@revealui/mcp/author/test');
}
