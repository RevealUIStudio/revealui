/**
 * `@revealui/mcp/author/scaffold` — generate an MCP-server project skeleton.
 *
 * Phase 1.6 stub. The final shape:
 *
 * 1. Caller supplies a target directory, a server name, and a template.
 * 2. Scaffold writes a `package.json` + `src/index.ts` + `README.md` + a
 *    `tsconfig.json`, all pre-wired to consume `@modelcontextprotocol/sdk`
 *    and `@revealui/mcp/contracts` for tool-arg validation.
 * 3. The generated server is runnable via `pnpm tsx src/index.ts` and
 *    speaks stdio-MCP out of the box.
 *
 * Templates intentionally start small. `minimal` = the smallest runnable
 * server. `with-auth` = adds JWT-claim plumbing from `@revealui/mcp/auth`.
 * `with-tools` = sample tools registered via `@revealui/mcp/contracts`.
 *
 * Templates do NOT include venue-specific publish manifests — those are the
 * scope of `@revealui/mcp/author/publish`, which is the per-venue boundary.
 */

import { AuthorSdkNotImplementedError } from './errors.js';

export type ScaffoldTemplate = 'minimal' | 'with-auth' | 'with-tools';

export interface ScaffoldOptions {
  /** Server name (becomes `package.json#name` + the MCP server's announced name). */
  name: string;

  /** Absolute path to the directory the project should be scaffolded into. */
  targetDir: string;

  /**
   * Which template to materialize. Defaults to `'minimal'`.
   * - `minimal` — bare-bones runnable server, no tools registered.
   * - `with-auth` — adds JWT-claim middleware wiring per `@revealui/mcp/auth`.
   * - `with-tools` — registers two sample tools (`echo`, `add`) with Zod schemas.
   */
  template?: ScaffoldTemplate;

  /**
   * If `true`, overwrite existing files in `targetDir`. Defaults to `false`
   * (the call throws if any target path already exists).
   */
  overwrite?: boolean;
}

export interface ScaffoldResult {
  /** Absolute paths of every file the scaffold wrote, in deterministic order. */
  createdPaths: string[];

  /** The template that was materialized. */
  template: ScaffoldTemplate;
}

/**
 * Phase 1.6 stub — throws `AuthorSdkNotImplementedError`. See module JSDoc
 * for the concrete-implementation contract.
 */
export async function scaffold(_opts: ScaffoldOptions): Promise<ScaffoldResult> {
  throw new AuthorSdkNotImplementedError('scaffold', '@revealui/mcp/author/scaffold');
}
