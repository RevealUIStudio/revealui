/**
 * Claims-evidence extractor (GAP-462 Phase 3): AST parse of CLAIMS + documents edges.
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  CLAIMS_EVIDENCE_REL,
  claimsExtractor,
  evidencePathFromRef,
  isPathEvidence,
  missingEvidencePaths,
  parseClaimsEvidenceSource,
} from '../claims.ts';
import { claimKey, fileKey } from '../shared.ts';

const tempDirs: string[] = [];

async function makeTempRepo(files: Record<string, string>): Promise<string> {
  const root = mkdtempSync(join(tmpdir(), 'revkg-claims-'));
  tempDirs.push(root);
  for (const [relPath, content] of Object.entries(files)) {
    const full = join(root, relPath);
    await mkdir(dirname(full), { recursive: true });
    writeFileSync(full, content, 'utf-8');
  }
  return root;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

const FIXTURE_SOURCE = `
export type EvidenceKind = 'code' | 'command' | 'url' | 'metric' | 'test';
export interface EvidenceRef {
  readonly kind: EvidenceKind;
  readonly ref: string;
  readonly note?: string;
}

const AUTH: EvidenceRef = {
  kind: 'code',
  ref: 'packages/auth/src/server/auth.ts',
  note: 'sessions',
};

const CMD: EvidenceRef = {
  kind: 'command',
  ref: 'pnpm validate:claims',
};

export const CLAIMS: readonly ClaimEntry[] = [
  {
    file: 'home.ts',
    exportPath: 'HOME_HERO.h1',
    text: 'Run your whole business on one runtime you own.',
    evidence: [
      AUTH,
      {
        kind: 'test',
        ref: 'packages/auth/src/__tests__/sign-in.test.ts#signs in',
        note: 'proof obligation',
      },
      CMD,
    ],
  },
  {
    file: 'site.ts',
    exportPath: 'SITE.brandTagline',
    text: 'The open runtime.',
    evidence: [
      {
        kind: 'code',
        ref: 'LICENSE',
      },
    ],
  },
];

interface ClaimEntry {
  file: string;
  exportPath: string;
  text: string;
  evidence: readonly EvidenceRef[];
}
`;

describe('parseClaimsEvidenceSource', () => {
  it('resolves const evidence refs and inline objects', () => {
    const claims = parseClaimsEvidenceSource(FIXTURE_SOURCE);
    expect(claims).toHaveLength(2);
    expect(claims[0]?.exportPath).toBe('HOME_HERO.h1');
    expect(claims[0]?.evidence).toEqual([
      { kind: 'code', ref: 'packages/auth/src/server/auth.ts', note: 'sessions' },
      {
        kind: 'test',
        ref: 'packages/auth/src/__tests__/sign-in.test.ts#signs in',
        note: 'proof obligation',
      },
      { kind: 'command', ref: 'pnpm validate:claims' },
    ]);
    expect(claims[1]?.file).toBe('site.ts');
    expect(claims[1]?.evidence[0]?.ref).toBe('LICENSE');
  });

  it('returns empty when CLAIMS is absent', () => {
    expect(parseClaimsEvidenceSource('export const x = 1;\n')).toEqual([]);
  });
});

describe('evidencePathFromRef / isPathEvidence', () => {
  it('strips test title fragments', () => {
    expect(evidencePathFromRef('packages/a/b.test.ts#title here')).toBe('packages/a/b.test.ts');
  });

  it('accepts code/test/metric paths and rejects urls and commands', () => {
    expect(isPathEvidence('code', 'packages/auth/src/x.ts')).toBe(true);
    expect(isPathEvidence('test', 'a.test.ts#t')).toBe(true);
    expect(isPathEvidence('command', 'pnpm test')).toBe(false);
    expect(isPathEvidence('url', 'https://example.com')).toBe(false);
    expect(isPathEvidence('code', 'https://example.com/x')).toBe(false);
  });
});

describe('claimsExtractor', () => {
  it('emits claim concepts and documents edges (claim → code)', async () => {
    const root = await makeTempRepo({
      [CLAIMS_EVIDENCE_REL]: FIXTURE_SOURCE,
      'packages/auth/src/server/auth.ts': 'export {};\n',
      'packages/auth/src/__tests__/sign-in.test.ts': "it('signs in', () => {});\n",
      LICENSE: 'MIT\n',
      'apps/marketing/app/content/home.ts': 'export {};\n',
      'apps/marketing/app/content/site.ts': 'export {};\n',
    });

    const products = await claimsExtractor.extract({
      repoRoot: root,
      repo: 'revealui',
      siteId: 'test',
      now: new Date('2026-07-29T00:00:00Z'),
    });
    expect(products).toHaveLength(1);
    const product = products[0];
    if (!product) throw new Error('expected product');

    expect(product.scope).toEqual({ repo: 'revealui', extractor: 'claims' });
    expect(product.episode.source).toBe('revealui:claims');

    const claimNk = claimKey('revealui', 'home.ts', 'HOME_HERO.h1');
    const claimNode = product.nodes.find((n) => n.naturalKey === claimNk);
    expect(claimNode?.kind).toBe('concept');
    expect(claimNode?.attributes?.proposedKind).toBe('claim');

    const docs = product.edges.filter((e) => e.relation === 'documents');
    // AUTH + test path + LICENSE = 3 documents edges (command skipped)
    expect(docs).toHaveLength(3);
    for (const e of docs) {
      expect(e.source.kind).toBe('concept');
      expect(e.target.kind).toBe('file');
    }

    const authEdge = docs.find(
      (e) => e.target.naturalKey === fileKey('revealui', 'packages/auth/src/server/auth.ts'),
    );
    expect(authEdge?.source.naturalKey).toBe(claimNk);
  });

  it('is deterministic across two runs', async () => {
    const root = await makeTempRepo({
      [CLAIMS_EVIDENCE_REL]: FIXTURE_SOURCE,
      LICENSE: 'MIT\n',
    });
    const ctx = {
      repoRoot: root,
      repo: 'revealui',
      siteId: 'test',
      now: new Date('2026-07-29T00:00:00Z'),
    };
    const a = await claimsExtractor.extract(ctx);
    const b = await claimsExtractor.extract(ctx);
    const edgeKeys = (p: typeof a) =>
      p
        .flatMap((x) => x.edges)
        .map(
          (e) =>
            `${e.source.kind}:${e.source.naturalKey}|${e.target.kind}:${e.target.naturalKey}|${e.relation}`,
        )
        .sort();
    const nodeKeys = (p: typeof a) =>
      p
        .flatMap((x) => x.nodes)
        .map((n) => `${n.kind}:${n.naturalKey}`)
        .sort();
    expect(edgeKeys(a)).toEqual(edgeKeys(b));
    expect(nodeKeys(a)).toEqual(nodeKeys(b));
  });

  it('returns empty when the index is absent', async () => {
    const root = await makeTempRepo({ 'README.md': '# hi\n' });
    const products = await claimsExtractor.extract({
      repoRoot: root,
      repo: 'agency',
      siteId: 'test',
      now: new Date(),
    });
    expect(products).toEqual([]);
  });
});

describe('missingEvidencePaths', () => {
  it('reports path-shaped evidence that is not on disk', async () => {
    const root = await makeTempRepo({
      [CLAIMS_EVIDENCE_REL]: FIXTURE_SOURCE,
      // LICENSE present so only auth + test are missing
      LICENSE: 'MIT\n',
    });
    const claims = parseClaimsEvidenceSource(FIXTURE_SOURCE);
    const issues = missingEvidencePaths(root, claims, 'revealui');
    expect(issues.some((i) => i.evidenceRef.includes('auth.ts'))).toBe(true);
    expect(issues.some((i) => i.evidenceRef === 'LICENSE')).toBe(false);
  });
});
