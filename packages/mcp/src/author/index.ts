/**
 * `@revealui/mcp/author` — MCP server author SDK.
 *
 * Author tooling for building, testing, and publishing MCP servers. Sub-export
 * of `@revealui/mcp` per ADR `2026-05-18-marketplace-home.md` L2 lock — the
 * author SDK stays inside the protocol package because it serves any venue,
 * not just Studio's revmarket, and bundling it with the protocol preserves
 * the agnosticism principle.
 *
 * ## Status
 *
 * **Phase 1.6 (stubs only).** This module ships the namespace + interfaces
 * + an explicit `AuthorSdkNotImplementedError` per function. The concrete
 * implementation lands after the first external venue requirement surfaces
 * (per `docs/lanes/marketplace-extraction/plan.md` Risk R8 — "Phase 1.6
 * author SDK design constrains future venue plugins; ship stubs only,
 * flesh out API in a follow-up ADR after first external venue interest").
 *
 * ## Subpath imports (preferred)
 *
 * Per memory `reference_mcp_barrel_subpath_imports`, prefer the deep
 * subpaths over this barrel — the top-level `@revealui/mcp` barrel has
 * launcher side effects; the `/author` barrel does NOT (this file pulls
 * in pure types + stub functions, no `fs`/`net`/`process` work), but
 * deep-imports are still tighter for tree-shaking:
 *
 * ```ts
 * import { scaffold } from '@revealui/mcp/author/scaffold';
 * import { runTestHarness } from '@revealui/mcp/author/test';
 * import { publish } from '@revealui/mcp/author/publish';
 * ```
 *
 * Barrel form (this file) is provided for ergonomic single-import:
 *
 * ```ts
 * import { scaffold, runTestHarness, publish } from '@revealui/mcp/author';
 * ```
 *
 * ## License
 *
 * Same as the parent package (`FSL-1.1-MIT`, converts to MIT after 2 years).
 * The author SDK serves third-party MCP authors targeting any venue and
 * intentionally carries the protocol package's license rather than being
 * gated separately.
 */

export {
  AUTHOR_SDK_TRACKING_ISSUE,
  AuthorSdkNotImplementedError,
} from './errors.js';
export type { PublishOptions, PublishResult, PublishVenue } from './publish.js';
export { publish } from './publish.js';
export type { ScaffoldOptions, ScaffoldResult, ScaffoldTemplate } from './scaffold.js';
export { scaffold } from './scaffold.js';
export type { TestHarnessOptions, TestHarnessResult, ToolCallSpec } from './test.js';
export { runTestHarness } from './test.js';
