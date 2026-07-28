/**
 * Archive-check — shared inbound-link scanning for the central fleet archive.
 *
 * GAP-451. When a stale document is moved to the central archive
 * (`RevealUIStudio/revfleet-archive`), every LIVE inbound link to its old path
 * must be repointed at the archive URL. A link left behind is a dead link that
 * looks alive — the failure class this gate exists to catch.
 *
 * ## Why this lives in the control layer
 *
 * The checker began life as a single script in the private coordination repo,
 * which meant the PUBLIC repo had no enforcement at all: docs could be archived
 * out of `revealui` and their inbound links rot unnoticed, in the one repo
 * where a broken link is externally visible. Copying the script across would
 * have created the dual-home mirror `parallel-native-implementation.md`
 * forbids, and mirrors drift (the same lesson as GAP-408's doc-currency and
 * guardrail2-verdict extractions, which is why those already live here).
 *
 * So the matching logic has ONE home — this module — and each repo keeps only
 * a thin adapter that supplies the filesystem side.
 *
 * ## Why the public repo does not need archive access
 *
 * The archive repo is PRIVATE and `revealui` is PUBLIC. A public repo cannot
 * safely hold a token to a private one: fork PRs receive no secrets, so the
 * gate would silently no-op on exactly the outside contributions most worth
 * checking, and private archive content could surface in public CI logs.
 *
 * The scan does not actually need the archive. It needs only the LIST OF
 * ARCHIVED ORIGIN PATHS for the repo being scanned — and for `revealui` those
 * are paths in `revealui` itself, carrying no private information. The public
 * adapter therefore reads a committed paths-only manifest, and the private
 * adapter derives the same list from the real archive (where it also validates
 * headers and INDEX rows, which the manifest cannot).
 */

/** Prefix of a correctly-repointed archive link. */
export const ARCHIVE_URL_PREFIX = 'revfleet-archive/blob/main/';

/**
 * Relative-path substrings marking a file as itself a historical record.
 *
 * A doc under one of these correctly DESCRIBES the past, so it referencing an
 * archived path is not drift — rewriting it would make the record lie about
 * its own moment. Mirrors the skip-list philosophy in `master-handoff.md` and
 * `jv-doc-locations.md`.
 *
 * These are per-repo because the two repos organize history differently, and
 * they are deliberately NOT merged into one broad `/archive/` pattern: that
 * would silently widen the private repo's existing behavior during what is
 * meant to be a behavior-preserving extraction.
 */
export const JV_HISTORICAL_MARKERS: readonly string[] = [
  'docs/handoffs/archive/',
  '.claude/archive/',
  'docs/audits/',
  'docs/lanes/_closed/',
];

/** Historical-record paths in the public framework repo. */
export const REVEALUI_HISTORICAL_MARKERS: readonly string[] = ['docs/archive/'];

/** True when `relPath` is itself a historical record and must not be rewritten. */
export function isHistoricalPath(relPath: string, markers: readonly string[]): boolean {
  return markers.some((marker) => relPath.includes(marker));
}

/** Count non-overlapping occurrences of `needle`. Substring only, no regex. */
export function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let idx = haystack.indexOf(needle);
  while (idx !== -1) {
    count++;
    idx = haystack.indexOf(needle, idx + needle.length);
  }
  return count;
}

/** One live file to scan. Adapters supply these; this module never touches fs. */
export interface ScannedFile {
  /** Repo-relative path, forward-slashed. */
  readonly path: string;
  readonly content: string;
}

export interface DeadInboundLink {
  readonly kind: 'dead-inbound-link';
  readonly repo: string;
  /** Repo-relative path of the file still carrying the stale link. */
  readonly file: string;
  /** The archived origin path it still points at. */
  readonly origin: string;
  readonly detail: string;
}

export interface ScanInboundLinksInput {
  /** Archive folder name for the repo, e.g. 'revealui' or 'revealui-jv'. */
  readonly repoFolderName: string;
  /** Origin paths that have been archived out of this repo. */
  readonly originPaths: readonly string[];
  readonly files: readonly ScannedFile[];
  readonly historicalMarkers: readonly string[];
}

/**
 * Find live files still linking an archived path.
 *
 * The subtlety that makes a naive substring match wrong: a CORRECTLY repointed
 * link necessarily contains the origin path, because the archive mirrors each
 * repo's relative paths — the right pointer
 * `revfleet-archive/blob/main/<repo>/<origin>` embeds `<origin>` verbatim. So
 * matching on the origin alone flags a fixed doc exactly like a broken one,
 * and repointing would be impossible without gaming the string. Both forms are
 * counted and only the EXCESS is reported.
 */
export function scanInboundLinks(input: ScanInboundLinksInput): DeadInboundLink[] {
  const { repoFolderName, originPaths, files, historicalMarkers } = input;
  const violations: DeadInboundLink[] = [];

  const liveFiles = files.filter((f) => !isHistoricalPath(f.path, historicalMarkers));

  for (const origin of originPaths) {
    if (!origin) continue;
    const repointed = `${ARCHIVE_URL_PREFIX}${repoFolderName}/${origin}`;

    for (const file of liveFiles) {
      const total = countOccurrences(file.content, origin);
      if (total === 0) continue;
      if (total > countOccurrences(file.content, repointed)) {
        violations.push({
          kind: 'dead-inbound-link',
          repo: repoFolderName,
          file: file.path,
          origin,
          detail: `${file.path} still links archived path "${origin}" (repo: ${repoFolderName}) — repoint it at ${repointed}`,
        });
      }
    }
  }

  return violations;
}
