/**
 * secret-path live-drift checker (P0-8). Pure-function tests against a synthetic
 * `revvault sync ... --json` fixture — no revvault, no network, no secret values.
 */
import { describe, expect, it } from 'vitest';
import { collectVercelProjects } from '../parse-manifests.js';
import {
  classifyVercelDrift,
  classifyVercelNameDrift,
  type DriftFinding,
  KNOWN_DRIFT,
  knownKey,
  liveVercelSkipReason,
  parseSyncDiffJsonl,
  parseVercelNamesJson,
  partitionFindings,
} from '../secret-path-drift.js';

// Models the real shape: JSONL, one object per project, actions
// Match/Update/Skip (in-sync) + Orphan/Add/DropShape (drift). Trailing line is
// shell/Nix banner noise the parser must skip. No secret VALUES — names only.
const FIXTURE = [
  JSON.stringify({
    diff: [
      { action: 'Match', key: 'IN_SYNC', reason: null },
      { action: 'Update', key: 'VALUE_DRIFT', reason: null },
      { action: 'Skip', key: 'SKIPPED', reason: null },
      { action: 'Orphan', key: 'REVEALUI_BUNDLE_PRO', reason: 'in Vercel but not in vault' },
      { action: 'DropShape', key: 'ELECTRIC_SECRET', reason: 'shape violation: value is empty' },
      { action: 'Orphan', key: 'BRAND_NEW_ORPHAN', reason: 'in Vercel but not in vault' },
      { action: 'Add', key: 'EXPECTED_BUT_ABSENT', reason: null },
    ],
    dry_run: true,
    mode: 'push',
    project: 'revealui-api',
  }),
  '  ◈ loading Nix environment…',
].join('\n');

const NO_PATHS = new Map<string, Map<string, string>>();

describe('parseSyncDiffJsonl', () => {
  it('parses one DiffDoc per project line and skips banner noise', () => {
    const docs = parseSyncDiffJsonl(FIXTURE);
    expect(docs).toHaveLength(1);
    expect(docs[0]?.project).toBe('revealui-api');
    expect(docs[0]?.diff).toHaveLength(7);
  });
});

describe('classifyVercelDrift', () => {
  const findings = classifyVercelDrift(parseSyncDiffJsonl(FIXTURE), NO_PATHS);

  it('maps Orphan→orphan, Add→missing, DropShape→shape-violation; ignores Match/Update/Skip', () => {
    // 2 Orphan + 1 Add + 1 DropShape = 4; Match/Update/Skip produce nothing.
    expect(findings).toHaveLength(4);
    const byCat = (c: string) =>
      findings
        .filter((f) => f.category === c)
        .map((f) => f.key)
        .sort();
    expect(byCat('orphan')).toEqual(['BRAND_NEW_ORPHAN', 'REVEALUI_BUNDLE_PRO']);
    expect(byCat('missing')).toEqual(['EXPECTED_BUT_ABSENT']);
    expect(byCat('shape-violation')).toEqual(['ELECTRIC_SECRET']);
  });

  it('never emits a finding for an in-sync (Match/Update/Skip) key', () => {
    for (const k of ['IN_SYNC', 'VALUE_DRIFT', 'SKIPPED']) {
      expect(findings.find((f) => f.key === k)).toBeUndefined();
    }
  });
});

describe('partitionFindings — known (tracked) vs new (fails)', () => {
  const findings = classifyVercelDrift(parseSyncDiffJsonl(FIXTURE), NO_PATHS);
  const { fresh, known } = partitionFindings(findings);

  it('routes the tracked orphan + ELECTRIC shape-violation to KNOWN', () => {
    expect(known.map((f) => f.key).sort()).toEqual(['ELECTRIC_SECRET', 'REVEALUI_BUNDLE_PRO']);
  });

  it('routes a brand-new orphan + a missing var to NEW (would fail the run)', () => {
    expect(fresh.map((f) => f.key).sort()).toEqual(['BRAND_NEW_ORPHAN', 'EXPECTED_BUT_ABSENT']);
  });
});

describe('KNOWN_DRIFT allowlist explicitly tracks the 2026-07-11 live findings', () => {
  const expectKnown = (f: DriftFinding) => expect(knownKey(f) in KNOWN_DRIFT).toBe(true);

  it('covers both orphan flags (BUNDLE_PRO on api, SIGNUP_OPEN on admin)', () => {
    expectKnown({
      surface: 'vercel:revealui-api',
      key: 'REVEALUI_BUNDLE_PRO',
      category: 'orphan',
      reason: null,
    });
    expectKnown({
      surface: 'vercel:revealui-admin',
      key: 'REVEALUI_SIGNUP_OPEN',
      category: 'orphan',
      reason: null,
    });
  });

  it('covers the ELECTRIC shape violations (SECRET empty + SERVICE_URL ciphertext) on both projects', () => {
    for (const project of ['revealui-api', 'revealui-admin']) {
      expectKnown({
        surface: `vercel:${project}`,
        key: 'ELECTRIC_SECRET',
        category: 'shape-violation',
        reason: null,
      });
      expectKnown({
        surface: `vercel:${project}`,
        key: 'ELECTRIC_SERVICE_URL',
        category: 'shape-violation',
        reason: null,
      });
    }
  });
});

describe('classifyVercelNameDrift (CI name-diff path)', () => {
  const projects = collectVercelProjects(`
[projects.demo]
project_id = "prj_demo"
skip = ["NODE_ENV", "STRIPE_LIVE_MODE"]

[projects.demo.vars]
STRIPE_SECRET_KEY = { path = "revealui/prod/stripe/secret-key", sensitive = true }
POSTGRES_URL = "revealui/prod/db/postgres-url"
`);

  it('parses project_id, skip, and vars from the manifest', () => {
    expect(projects).toHaveLength(1);
    expect(projects[0]?.slug).toBe('demo');
    expect(projects[0]?.projectId).toBe('prj_demo');
    expect(projects[0]?.skip).toEqual(['NODE_ENV', 'STRIPE_LIVE_MODE']);
    expect(projects[0]?.vars.get('POSTGRES_URL')).toBe('revealui/prod/db/postgres-url');
  });

  it('reports orphan + missing; never orphans skip names', () => {
    const live = new Map<string, string[]>([
      ['demo', ['STRIPE_SECRET_KEY', 'BRAND_NEW', 'NODE_ENV']],
    ]);
    const findings = classifyVercelNameDrift(projects, live);
    const byCat = (c: string) =>
      findings
        .filter((f) => f.category === c)
        .map((f) => f.key)
        .sort();
    expect(byCat('orphan')).toEqual(['BRAND_NEW']);
    expect(byCat('missing')).toEqual(['POSTGRES_URL']);
    expect(findings.find((f) => f.key === 'NODE_ENV')).toBeUndefined();
    expect(findings.find((f) => f.category === 'shape-violation')).toBeUndefined();
  });

  it('parseVercelNamesJson builds the live map', () => {
    const map = parseVercelNamesJson(
      JSON.stringify({
        projects: [{ project: 'demo', names: ['A', 'B'] }],
      }),
    );
    expect(map.get('demo')).toEqual(['A', 'B']);
  });
});

describe('liveVercelSkipReason (public CI no-op)', () => {
  it('skips when VERCEL_TOKEN is unset (same message as the workflow bash guard)', () => {
    expect(liveVercelSkipReason(undefined, '/ops/sync')).toMatch(/VERCEL_TOKEN not set/);
    expect(liveVercelSkipReason('', '/ops/sync')).toMatch(/VERCEL_TOKEN not set/);
  });

  it('skips when the private inventory is not on disk even if VERCEL_TOKEN is set', () => {
    const reason = liveVercelSkipReason('vercel_token_present', null);
    expect(reason).toMatch(/Private sync manifest not available/);
    expect(reason).toMatch(/no-op pass/);
  });

  it('does not skip when both the token and the inventory directory are present', () => {
    expect(liveVercelSkipReason('vercel_token_present', '/ops/sync')).toBeNull();
  });
});
