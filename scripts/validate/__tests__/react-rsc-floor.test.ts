import { describe, expect, it } from 'vitest';

import {
  collectResolvedVersions,
  compareVersions,
  evaluateFloor,
  LOCKSTEP_PACKAGES,
  parseVersion,
  REACT_RSC_FLOOR,
} from '../react-rsc-floor';

function resolvedMap(entries: Record<string, readonly string[]>): Map<string, readonly string[]> {
  return new Map(Object.entries(entries));
}

describe('parseVersion', () => {
  it('parses a stable release', () => {
    expect(parseVersion('19.2.7')).toEqual({ major: 19, minor: 2, patch: 7, prerelease: null });
  });

  it('parses a pre-release suffix', () => {
    expect(parseVersion('19.2.4-canary-abc123')).toEqual({
      major: 19,
      minor: 2,
      patch: 4,
      prerelease: 'canary-abc123',
    });
  });

  it('ignores build metadata', () => {
    expect(parseVersion('19.2.4+build.5')).toEqual({
      major: 19,
      minor: 2,
      patch: 4,
      prerelease: null,
    });
  });

  it('rejects cores that are not exactly three segments', () => {
    expect(parseVersion('19.2')).toBeNull();
    expect(parseVersion('19.2.4.1')).toBeNull();
    expect(parseVersion('')).toBeNull();
  });

  it('rejects non-numeric segments', () => {
    expect(parseVersion('19.2.x')).toBeNull();
    expect(parseVersion('19.2.7a')).toBeNull();
    expect(parseVersion('workspace:*')).toBeNull();
  });
});

describe('compareVersions', () => {
  function mustParseForTest(version: string) {
    const parsed = parseVersion(version);
    if (!parsed) throw new Error(`test version must parse: ${version}`);
    return parsed;
  }

  function cmp(a: string, b: string): number {
    return compareVersions(mustParseForTest(a), mustParseForTest(b));
  }

  it('orders by major, minor, patch', () => {
    expect(cmp('18.9.9', '19.0.0')).toBeLessThan(0);
    expect(cmp('19.1.9', '19.2.0')).toBeLessThan(0);
    expect(cmp('19.2.3', '19.2.4')).toBeLessThan(0);
    expect(cmp('19.3.0', '19.2.4')).toBeGreaterThan(0);
  });

  it('treats identical stable versions as equal', () => {
    expect(cmp('19.2.4', '19.2.4')).toBe(0);
  });

  it('orders a pre-release BEFORE its stable release (the semver rule the floor depends on)', () => {
    expect(cmp('19.2.4-canary-1', '19.2.4')).toBeLessThan(0);
    expect(cmp('19.2.4', '19.2.4-canary-1')).toBeGreaterThan(0);
  });
});

describe('evaluateFloor', () => {
  it('pins the floor constant to the final fix of the Dec-2025 CVE series', () => {
    // Lowering this constant is a security decision, not a refactor: the
    // test forces any such change to touch this file and say why.
    expect(REACT_RSC_FLOOR).toBe('19.2.4');
    expect([...LOCKSTEP_PACKAGES]).toEqual(['react', 'react-dom', 'react-server-dom-webpack']);
  });

  it('passes when all three resolve lockstep above the floor', () => {
    const report = evaluateFloor(
      resolvedMap({
        react: ['19.2.7'],
        'react-dom': ['19.2.7'],
        'react-server-dom-webpack': ['19.2.7'],
      }),
    );
    expect(report.violations).toEqual([]);
  });

  it('passes at exactly the floor (boundary)', () => {
    const report = evaluateFloor(
      resolvedMap({
        react: ['19.2.4'],
        'react-dom': ['19.2.4'],
        'react-server-dom-webpack': ['19.2.4'],
      }),
    );
    expect(report.violations).toEqual([]);
  });

  it('passes with react-server-dom-webpack absent (pre-router-0.4.0 state) and says so', () => {
    const report = evaluateFloor(
      resolvedMap({ react: ['19.2.7'], 'react-dom': ['19.2.7'], 'react-server-dom-webpack': [] }),
    );
    expect(report.violations).toEqual([]);
    const skipLine = report.summary.find((line) => line.startsWith('react-server-dom-webpack'));
    expect(skipLine).toContain('absent');
  });

  it('passes vacuously when none of the three are installed (absence is not exposure)', () => {
    expect(evaluateFloor(new Map<string, string[]>()).violations).toEqual([]);
  });

  it('fails every resolution below the floor and names the CVE series', () => {
    const report = evaluateFloor(
      resolvedMap({
        react: ['19.2.3'],
        'react-dom': ['19.2.3'],
        'react-server-dom-webpack': ['19.2.3'],
      }),
    );
    const belowFloor = report.violations.filter((violation) => violation.rule === 'below-floor');
    expect(belowFloor).toHaveLength(3);
    expect(belowFloor[0]?.detail).toContain('CVE-2025-55182');
  });

  it('fails a pre-release of the floor version (19.2.4-canary is below 19.2.4)', () => {
    const report = evaluateFloor(
      resolvedMap({
        react: ['19.2.4'],
        'react-dom': ['19.2.4'],
        'react-server-dom-webpack': ['19.2.4-canary-abc'],
      }),
    );
    expect(report.violations.map((violation) => violation.rule)).toContain('below-floor');
  });

  it('fails lockstep skew even when every version clears the floor', () => {
    const report = evaluateFloor(
      resolvedMap({
        react: ['19.2.7'],
        'react-dom': ['19.2.6'],
        'react-server-dom-webpack': ['19.2.7'],
      }),
    );
    expect(report.violations).toHaveLength(1);
    expect(report.violations[0]?.rule).toBe('version-skew');
    expect(report.violations[0]?.detail).toContain('react-dom=19.2.6');
  });

  it('fails when one package resolves to multiple versions (skew within a package)', () => {
    const report = evaluateFloor(
      resolvedMap({
        react: ['19.2.7', '19.3.0'],
        'react-dom': ['19.2.7'],
        'react-server-dom-webpack': [],
      }),
    );
    expect(report.violations.map((violation) => violation.rule)).toContain('version-skew');
  });

  it('fails closed on an unparseable resolved version', () => {
    const report = evaluateFloor(resolvedMap({ react: ['not-semver'] }));
    expect(report.violations.map((violation) => violation.rule)).toContain('unparseable-version');
  });
});

describe('collectResolvedVersions', () => {
  it('reads react from the real pnpm virtual store (pnpm-layout drift guard)', () => {
    // If the .pnpm directory layout ever changes shape, the collector would
    // report every package absent and the floor would pass vacuously. react
    // is always installed in this repo, so an empty result means collector
    // drift, not a react-free workspace.
    const resolved = collectResolvedVersions();
    const reactVersions = resolved.get('react') ?? [];
    expect(reactVersions.length).toBeGreaterThan(0);
    for (const version of reactVersions) {
      expect(parseVersion(version)).not.toBeNull();
    }
  });

  it('throws (fail-closed) when the virtual store is missing', () => {
    expect(() => collectResolvedVersions('scripts/validate/__tests__/no-such-root')).toThrow(
      'pnpm install',
    );
  });
});
