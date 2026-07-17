import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ClaimEntry } from '../../../apps/marketing/app/content/claims-evidence.js';
import {
  analyzeClaimText,
  capabilityClaimKey,
  checkCapabilityClaims,
  computeBaselineKeys,
  importsMockMarker,
  isCapabilityClaim,
  isTitleSkipped,
  validateTestRef,
} from '../capability-claims.js';

// A hermetic fixture repo root holding real test files the validator resolves.
let root: string;
const PROVEN_TEST_REL = 'packages/fixture/__tests__/proven.test.ts';
const SKIPPED_TEST_REL = 'packages/fixture/__tests__/skipped.test.ts';
const MOCKED_TEST_REL = 'packages/fixture/__tests__/mocked.test.ts';

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'cap-claims-'));
  const dir = path.join(root, 'packages/fixture/__tests__');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'proven.test.ts'),
    [
      "import { describe, it, expect } from 'vitest';",
      "describe('rotation', () => {",
      "  it('re-encrypts data from old key to new key', () => {",
      '    expect(true).toBe(true);',
      '  });',
      '});',
      '',
    ].join('\n'),
  );
  fs.writeFileSync(
    path.join(dir, 'skipped.test.ts'),
    [
      "import { describe, it } from 'vitest';",
      "describe('rotation', () => {",
      "  it.skip('re-encrypts data from old key to new key', () => {});",
      '});',
      '',
    ].join('\n'),
  );
  fs.writeFileSync(
    path.join(dir, 'mocked.test.ts'),
    [
      "import { PGlite } from '@electric-sql/pglite';",
      "import { it } from 'vitest';",
      "it('re-encrypts data from old key to new key', () => {});",
      '',
    ].join('\n'),
  );
});

afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

function entry(over: Partial<ClaimEntry> & Pick<ClaimEntry, 'text'>): ClaimEntry {
  return {
    file: 'capabilities.ts',
    exportPath: 'CAPABILITIES[0].body',
    evidence: [],
    ...over,
  };
}

const provenRef = `${PROVEN_TEST_REL}#re-encrypts data from old key to new key`;

describe('analyzeClaimText', () => {
  it('flags capability markers', () => {
    expect(
      analyzeClaimText('Every event is recorded automatically.').markers.length,
    ).toBeGreaterThan(0);
    expect(analyzeClaimText('Sensitive fields are encrypted at rest.').markers).toContain(
      'encrypt',
    );
  });

  it('does not flag benign non-capability prose', () => {
    const s = analyzeClaimText('The RevFleet product family.');
    expect(isCapabilityClaim(s)).toBe(false);
  });

  it('does not fire markers inside longer words', () => {
    // "never" must not match "nevertheless"; "every" is space-bounded on one side.
    expect(analyzeClaimText('Nevertheless the plan holds.').markers).not.toContain(' never ');
    // Space-anchored markers must not fire inside containing words.
    expect(isCapabilityClaim(analyzeClaimText('A carefully designed admin surface.'))).toBe(false);
    expect(isCapabilityClaim(analyzeClaimText('Roles assigned in the dashboard.'))).toBe(false);
    expect(isCapabilityClaim(analyzeClaimText('Docs that reinforce the pattern.'))).toBe(false);
    // Sentence-initial forms still fire (the analyzer pads with spaces).
    expect(isCapabilityClaim(analyzeClaimText('Signed license JWTs gate Pro routes.'))).toBe(true);
    expect(isCapabilityClaim(analyzeClaimText('Enforced at the API layer.'))).toBe(true);
  });

  it('detects denylisted removed families', () => {
    expect(analyzeClaimText('A hash-chained HMAC tamper-evident audit log.').denylist.length).toBe(
      3,
    );
    expect(
      analyzeClaimText(
        'One policy governs your team, your agents, and your service accounts.',
      ).denylist.map((d) => d.family),
    ).toContain('one-policy-governs');
    expect(
      analyzeClaimText('Decide who can stop an agent.').denylist.map((d) => d.family),
    ).toContain('stop-an-agent');
  });
});

describe('validateTestRef', () => {
  it('accepts a real, named, non-skipped test', () => {
    const r = validateTestRef(provenRef, root);
    expect(r.ok).toBe(true);
    expect(r.advisory).toBeUndefined();
  });

  it('rejects a ref with no "#" separator', () => {
    expect(validateTestRef(PROVEN_TEST_REL, root).ok).toBe(false);
  });

  it('rejects a nonexistent test file', () => {
    const r = validateTestRef('packages/fixture/__tests__/missing.test.ts#whatever', root);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('not found');
  });

  it('rejects a title that is not present in the file', () => {
    const r = validateTestRef(`${PROVEN_TEST_REL}#no such title here`, root);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('not found');
  });

  it("rejects a .skip'd test (a skipped proof is no proof)", () => {
    const r = validateTestRef(`${SKIPPED_TEST_REL}#re-encrypts data from old key to new key`, root);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('skipped');
  });

  it('accepts a mocked-seam test but attaches a review advisory', () => {
    const r = validateTestRef(`${MOCKED_TEST_REL}#re-encrypts data from old key to new key`, root);
    expect(r.ok).toBe(true);
    expect(r.advisory).toContain('production seam');
  });
});

describe('isTitleSkipped', () => {
  it('catches it.skip / it.todo / xit forms', () => {
    expect(isTitleSkipped("it.skip('foo bar', () => {})", 'foo bar')).toBe(true);
    expect(isTitleSkipped("it.todo('foo bar')", 'foo bar')).toBe(true);
    expect(isTitleSkipped("xit('foo bar', () => {})", 'foo bar')).toBe(true);
    expect(isTitleSkipped("it('foo bar', () => {})", 'foo bar')).toBe(false);
  });
});

describe('importsMockMarker', () => {
  it('only inspects import lines', () => {
    expect(importsMockMarker("import { PGlite } from '@electric-sql/pglite';")).toBe(true);
    // pglite mentioned in a comment, not imported -> not flagged
    expect(importsMockMarker('// uses pglite under the hood')).toBe(false);
  });
});

describe('checkCapabilityClaims', () => {
  // (a) capability-shaped claim, no kind:'test' ref, not in baseline -> fails
  it('fails a capability claim with no test ref that is not baselined', () => {
    const claims = [entry({ text: 'Every event is recorded automatically.' })];
    const res = checkCapabilityClaims(claims, new Set(), root);
    expect(res.violations).toHaveLength(1);
    expect(res.violations[0].kind).toBe('missing-proof');
  });

  it('passes a capability claim with no test ref when baselined', () => {
    const claims = [entry({ text: 'Every event is recorded automatically.' })];
    const key = capabilityClaimKey(claims[0]);
    const res = checkCapabilityClaims(claims, new Set([key]), root);
    expect(res.violations).toHaveLength(0);
    expect(res.baselined).toEqual([key]);
  });

  // (b) denylisted term -> fails even if baselined
  it('fails a denylisted term even when baselined', () => {
    const claims = [
      entry({ text: 'A hash-chained HMAC tamper-evident audit log secures every event.' }),
    ];
    const key = capabilityClaimKey(claims[0]);
    const res = checkCapabilityClaims(claims, new Set([key]), root);
    expect(res.violations.some((v) => v.kind === 'denylist')).toBe(true);
  });

  it('passes a denylisted term only when it carries a valid test proof', () => {
    const claims = [
      entry({
        text: 'A tamper-evident audit log records every event.',
        evidence: [{ kind: 'test', ref: provenRef }],
      }),
    ];
    const res = checkCapabilityClaims(claims, new Set(), root);
    expect(res.violations).toHaveLength(0);
    expect(res.proven).toBe(1);
  });

  // (c) proof ref to a nonexistent file or a .skip'd test -> fails
  it('fails a claim whose only test ref points at a missing file', () => {
    const claims = [
      entry({
        text: 'Every event is recorded automatically.',
        evidence: [{ kind: 'test', ref: 'packages/fixture/__tests__/missing.test.ts#x' }],
      }),
    ];
    // baselined, yet a broken ref must still fail.
    const key = capabilityClaimKey(claims[0]);
    const res = checkCapabilityClaims(claims, new Set([key]), root);
    expect(res.violations.some((v) => v.kind === 'bad-ref')).toBe(true);
  });

  it('fails a claim whose only test ref is skipped', () => {
    const claims = [
      entry({
        text: 'Every event is recorded automatically.',
        evidence: [
          { kind: 'test', ref: `${SKIPPED_TEST_REL}#re-encrypts data from old key to new key` },
        ],
      }),
    ];
    const res = checkCapabilityClaims(claims, new Set(), root);
    expect(res.violations.some((v) => v.kind === 'bad-ref')).toBe(true);
  });

  // (d) a properly proven claim -> passes
  it('passes a capability claim with a valid test proof', () => {
    const claims = [
      entry({
        text: 'Sensitive fields are encrypted with per-record DEKs.',
        evidence: [
          { kind: 'code', ref: 'packages/security/src/encryption.ts' },
          { kind: 'test', ref: provenRef },
        ],
      }),
    ];
    const res = checkCapabilityClaims(claims, new Set(), root);
    expect(res.violations).toHaveLength(0);
    expect(res.proven).toBe(1);
    expect(res.scanned).toBe(1);
  });

  it('ignores non-capability prose entirely', () => {
    const claims = [entry({ text: 'The RevFleet product family.' })];
    const res = checkCapabilityClaims(claims, new Set(), root);
    expect(res.scanned).toBe(0);
    expect(res.violations).toHaveLength(0);
  });
});

describe('computeBaselineKeys', () => {
  it('grandfathers unproven capability claims but never denylist families', () => {
    const claims = [
      entry({ exportPath: 'A', text: 'Every event is recorded automatically.' }),
      entry({ exportPath: 'B', text: 'A tamper-evident audit log for every event.' }),
      entry({
        exportPath: 'C',
        text: 'Encrypted at rest, always.',
        evidence: [{ kind: 'test', ref: provenRef }],
      }),
    ];
    const keys = computeBaselineKeys(claims, root);
    // A (unproven, non-denylist) is grandfathered; B (denylist) is not; C (proven) is not.
    expect(keys).toEqual([capabilityClaimKey(claims[0])]);
  });
});
