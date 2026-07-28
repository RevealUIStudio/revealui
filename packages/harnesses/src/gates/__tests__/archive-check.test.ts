import { describe, expect, it } from 'vitest';
import {
  ARCHIVE_URL_PREFIX,
  countOccurrences,
  isHistoricalPath,
  JV_HISTORICAL_MARKERS,
  REVEALUI_HISTORICAL_MARKERS,
  scanInboundLinks,
} from '../archive-check.js';

const ORIGIN = 'docs/decisions/2026-01-01-some-ruling.md';

function scan(files: { path: string; content: string }[], repo = 'revealui') {
  return scanInboundLinks({
    repoFolderName: repo,
    originPaths: [ORIGIN],
    files,
    historicalMarkers: repo === 'revealui' ? REVEALUI_HISTORICAL_MARKERS : JV_HISTORICAL_MARKERS,
  });
}

describe('countOccurrences', () => {
  it('counts non-overlapping matches', () => {
    expect(countOccurrences('a-b-a-b-a', 'a')).toBe(3);
    expect(countOccurrences('aaaa', 'aa')).toBe(2);
  });

  it('returns 0 for an empty needle rather than looping forever', () => {
    expect(countOccurrences('anything', '')).toBe(0);
  });
});

describe('isHistoricalPath', () => {
  it('recognizes each repo’s own historical locations', () => {
    expect(isHistoricalPath('docs/archive/old.md', REVEALUI_HISTORICAL_MARKERS)).toBe(true);
    expect(isHistoricalPath('docs/guides/live.md', REVEALUI_HISTORICAL_MARKERS)).toBe(false);

    expect(isHistoricalPath('docs/lanes/_closed/x/plan.md', JV_HISTORICAL_MARKERS)).toBe(true);
    expect(isHistoricalPath('docs/audits/2026-05-29-audit.md', JV_HISTORICAL_MARKERS)).toBe(true);
    expect(isHistoricalPath('docs/gaps/GAP-451.yml', JV_HISTORICAL_MARKERS)).toBe(false);
  });

  it('keeps the two repos’ marker sets distinct', () => {
    // docs/audits/ is historical in the coordination repo but not a declared
    // historical location in the public one. Merging the sets would silently
    // widen behavior in whichever repo did not ask for it.
    expect(isHistoricalPath('docs/audits/x.md', REVEALUI_HISTORICAL_MARKERS)).toBe(false);
  });
});

describe('scanInboundLinks', () => {
  it('flags a live doc that still links an archived path', () => {
    const found = scan([{ path: 'docs/guides/setup.md', content: `see [ruling](${ORIGIN})` }]);
    expect(found).toHaveLength(1);
    expect(found[0]?.origin).toBe(ORIGIN);
    expect(found[0]?.file).toBe('docs/guides/setup.md');
    expect(found[0]?.detail).toContain(ARCHIVE_URL_PREFIX);
  });

  // The subtlety that makes a naive substring match wrong: the correct pointer
  // CONTAINS the origin path, so matching the origin alone would flag a
  // properly-repointed doc and make repointing impossible.
  it('does NOT flag a correctly repointed link', () => {
    const repointed = `https://github.com/RevealUIStudio/${ARCHIVE_URL_PREFIX}revealui/${ORIGIN}`;
    expect(scan([{ path: 'docs/guides/setup.md', content: `see [ruling](${repointed})` }])).toEqual(
      [],
    );
  });

  it('flags only the excess when a file has both a repointed and a stale link', () => {
    const repointed = `https://github.com/RevealUIStudio/${ARCHIVE_URL_PREFIX}revealui/${ORIGIN}`;
    const found = scan([
      { path: 'docs/guides/setup.md', content: `fixed: ${repointed}\nstale: ${ORIGIN}\n` },
    ]);
    expect(found).toHaveLength(1);
  });

  it('skips historical records, which correctly describe the past', () => {
    expect(scan([{ path: 'docs/archive/2026-03-28-old.md', content: `links ${ORIGIN}` }])).toEqual(
      [],
    );
  });

  it('returns nothing when no paths have been archived', () => {
    expect(
      scanInboundLinks({
        repoFolderName: 'revealui',
        originPaths: [],
        files: [{ path: 'docs/a.md', content: 'anything at all' }],
        historicalMarkers: REVEALUI_HISTORICAL_MARKERS,
      }),
    ).toEqual([]);
  });

  it('ignores an empty origin entry instead of matching every file', () => {
    const found = scanInboundLinks({
      repoFolderName: 'revealui',
      originPaths: [''],
      files: [{ path: 'docs/a.md', content: 'unrelated' }],
      historicalMarkers: REVEALUI_HISTORICAL_MARKERS,
    });
    expect(found).toEqual([]);
  });

  it('scopes the repointed form to the right repo folder', () => {
    // A pointer at the WRONG repo folder is still a dead link for this repo.
    const wrongRepo = `${ARCHIVE_URL_PREFIX}revealui-jv/${ORIGIN}`;
    expect(scan([{ path: 'docs/a.md', content: wrongRepo }], 'revealui')).toHaveLength(1);
  });
});
