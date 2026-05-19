/**
 * `@revealui/mcp/author/publish` — publish an MCP server to a venue.
 *
 * Phase 1.6 stub. The final shape:
 *
 * 1. Caller supplies a built package directory (with `package.json` + `dist/`)
 *    and a venue tag.
 * 2. Publish validates the package against the venue's manifest rules
 *    (e.g. revmarket requires a `mcp.json` with declared tool list + auth scopes;
 *    npm requires only npm's own publish rules).
 * 3. On a `dryRun: true` call, no upload happens — the call returns the manifest
 *    that WOULD be sent. On a real call, the package is published and the venue
 *    returns a URL + ID.
 *
 * Venue support is intentionally pluggable. Adding a venue means: extend
 * `PublishVenue`, add a manifest validator, add an upload adapter. Each venue
 * gets its own boundary; revmarket-specific KYC / payout-account-linking flows
 * stay venue-side, not in this generic publisher.
 */

import { AuthorSdkNotImplementedError } from './errors.js';

/**
 * Discriminant for the publish target. Add new venues here as adapters land.
 * - `revmarket` — Studio's MCP marketplace (per ADR `2026-05-18-marketplace-home`).
 * - `npm` — public npm registry (server is consumed as a library, not via venue).
 */
export type PublishVenue = 'revmarket' | 'npm';

export interface PublishOptions {
  /** Absolute path to the built package directory (must contain `package.json`). */
  packageDir: string;

  /** Which venue to publish to. See `PublishVenue` discriminant. */
  venue: PublishVenue;

  /**
   * When `true`, validate + manifest-build only; do not upload. Returns a
   * `PublishResult` with `dryRun: true` and a synthetic `url` / `venueId`
   * marker so consumers can inspect what the live call would do.
   */
  dryRun?: boolean;

  /**
   * Optional version override. When omitted, the version in the package's
   * `package.json` is used. Pre-release suffixes (e.g. `0.1.0-rc.1`) are
   * honored verbatim.
   */
  version?: string;
}

export interface PublishResult {
  /** ISO timestamp the publish landed (or would land, for a dry run). */
  publishedAt: Date;

  /** Venue-assigned identifier for the published artifact. */
  venueId: string;

  /** Canonical URL the artifact is reachable at. */
  url: string;

  /** Mirrors the caller's `dryRun` flag. */
  dryRun: boolean;

  /** The venue the artifact was published to (mirrors `PublishOptions.venue`). */
  venue: PublishVenue;
}

/**
 * Phase 1.6 stub — throws `AuthorSdkNotImplementedError`. See module JSDoc
 * for the concrete-implementation contract.
 */
export async function publish(_opts: PublishOptions): Promise<PublishResult> {
  throw new AuthorSdkNotImplementedError('publish', '@revealui/mcp/author/publish');
}
