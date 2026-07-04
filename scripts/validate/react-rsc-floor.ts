#!/usr/bin/env tsx

/**
 * React RSC CVE Floor Validation
 *
 * Enforces the resolved-version security floor for the December-2025 React
 * RSC CVE series: CVE-2025-55182 "React2Shell" (CVSS 10.0 unauthenticated
 * RCE via flight-protocol deserialization at Server Function endpoints),
 * CVE-2025-55184 (DoS) + CVE-2025-55183 (source exposure), and
 * CVE-2025-67779 (follow-up for the incomplete DoS fix). The final fixed
 * floor is 19.2.4 (react.dev advisories 2025-12-03 and 2025-12-11).
 *
 * Rules:
 *   1. react, react-dom, and react-server-dom-webpack must each RESOLVE at
 *      >=19.2.4. Resolved versions come from node_modules/.pnpm metadata,
 *      not declared ranges, so catalog drift or a pnpm override below the
 *      floor is caught.
 *   2. All resolved copies of the three must be ONE identical version:
 *      skew between react and its server-dom binding is itself a failure
 *      mode for the RSC flight protocol.
 *   3. A package absent from the dependency graph passes (absence is not
 *      exposure). react-server-dom-webpack is not a dependency today; it
 *      arrives with @revealui/router 0.4.0 RSC mode and this check starts
 *      guarding it automatically.
 *
 * Source: internal RSC-router design re-audit (2026-07-04), finding F8.
 *
 * @dependencies
 * - node:fs - File system operations
 * - node:path - Path manipulation
 * - node:url - import.meta.url to filesystem path
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Final fixed version for the Dec-2025 React RSC CVE series. */
export const REACT_RSC_FLOOR = '19.2.4';

/** The flight-protocol trio that must clear the floor in lockstep. */
export const LOCKSTEP_PACKAGES = ['react', 'react-dom', 'react-server-dom-webpack'] as const;

export interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  /** Pre-release suffix (e.g. "canary-abc"), null for stable releases. */
  prerelease: string | null;
}

function isAllDigits(segment: string): boolean {
  if (segment.length === 0) return false;
  for (const char of segment) {
    if (char < '0' || char > '9') return false;
  }
  return true;
}

/**
 * Structured semver parse (no regex, per repo convention): strip build
 * metadata (+) and pre-release (-), then require exactly three numeric
 * dot-separated core segments.
 */
export function parseVersion(version: string): ParsedVersion | null {
  const plusIndex = version.indexOf('+');
  const withoutBuild = plusIndex === -1 ? version : version.slice(0, plusIndex);
  const dashIndex = withoutBuild.indexOf('-');
  const core = dashIndex === -1 ? withoutBuild : withoutBuild.slice(0, dashIndex);
  const prerelease = dashIndex === -1 ? null : withoutBuild.slice(dashIndex + 1);

  const segments = core.split('.');
  if (segments.length !== 3) return null;
  const [majorRaw, minorRaw, patchRaw] = segments;
  if (majorRaw === undefined || minorRaw === undefined || patchRaw === undefined) return null;
  if (!(isAllDigits(majorRaw) && isAllDigits(minorRaw) && isAllDigits(patchRaw))) return null;

  return {
    major: Number.parseInt(majorRaw, 10),
    minor: Number.parseInt(minorRaw, 10),
    patch: Number.parseInt(patchRaw, 10),
    prerelease,
  };
}

/**
 * Compare parsed versions. A pre-release orders BEFORE its stable release
 * (19.2.4-canary < 19.2.4) per semver, which the floor check depends on.
 * Ordering BETWEEN two pre-releases of the same core is plain string
 * comparison; floor and lockstep verdicts never depend on it.
 */
export function compareVersions(a: ParsedVersion, b: ParsedVersion): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  if (a.patch !== b.patch) return a.patch - b.patch;
  if (a.prerelease === null && b.prerelease === null) return 0;
  if (a.prerelease === null) return 1;
  if (b.prerelease === null) return -1;
  if (a.prerelease < b.prerelease) return -1;
  if (a.prerelease > b.prerelease) return 1;
  return 0;
}

/**
 * Read every resolved copy of the lockstep packages from the pnpm virtual
 * store (node_modules/.pnpm/<pkg>@<version>[peer-suffix]/node_modules/
 * <pkg>/package.json). The inner manifest is the authority; directory
 * names are only a cheap prefix filter, so peer-suffix naming changes
 * cannot skew the result. Multiple installed copies of one package
 * surface as multiple versions.
 *
 * Throws when the virtual store is missing: "cannot verify" must fail the
 * gate loudly instead of passing vacuously.
 */
export function collectResolvedVersions(root: string = ROOT): Map<string, string[]> {
  const virtualStore = join(root, 'node_modules', '.pnpm');
  if (!existsSync(virtualStore)) {
    throw new Error(
      `pnpm virtual store not found at ${virtualStore} - run pnpm install first; ` +
        'resolved versions cannot be verified without it',
    );
  }

  const found = new Map<string, Set<string>>();
  for (const name of LOCKSTEP_PACKAGES) {
    found.set(name, new Set());
  }

  for (const entry of readdirSync(virtualStore)) {
    const name = LOCKSTEP_PACKAGES.find((candidate) => entry.startsWith(`${candidate}@`));
    if (!name) continue;
    const manifestPath = join(virtualStore, entry, 'node_modules', name, 'package.json');
    if (!existsSync(manifestPath)) continue;
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      name?: unknown;
      version?: unknown;
    };
    if (manifest.name === name && typeof manifest.version === 'string') {
      found.get(name)?.add(manifest.version);
    }
  }

  return new Map([...found].map(([name, versions]) => [name, [...versions].sort()]));
}

export type FloorViolationRule = 'below-floor' | 'version-skew' | 'unparseable-version';

export interface FloorViolation {
  rule: FloorViolationRule;
  detail: string;
}

export interface FloorReport {
  violations: FloorViolation[];
  /** One human-readable line per tracked package: resolved versions or absence. */
  summary: string[];
}

function mustParse(version: string): ParsedVersion {
  const parsed = parseVersion(version);
  if (!parsed) throw new Error(`unparseable version constant: ${version}`);
  return parsed;
}

const FLOOR_PARSED = mustParse(REACT_RSC_FLOOR);

export function evaluateFloor(resolved: ReadonlyMap<string, readonly string[]>): FloorReport {
  const violations: FloorViolation[] = [];
  const summary: string[] = [];
  const distinctVersions = new Set<string>();
  const presentLines: string[] = [];

  for (const name of LOCKSTEP_PACKAGES) {
    const versions = resolved.get(name) ?? [];
    if (versions.length === 0) {
      summary.push(
        `${name}: absent from the dependency graph, skipped (guard engages when it lands)`,
      );
      continue;
    }
    summary.push(`${name}: ${versions.join(', ')}`);
    presentLines.push(`${name}=${versions.join(',')}`);

    for (const version of versions) {
      distinctVersions.add(version);
      const parsed = parseVersion(version);
      if (!parsed) {
        violations.push({
          rule: 'unparseable-version',
          detail:
            `${name}@${version} is not parseable semver; ` +
            `the >=${REACT_RSC_FLOOR} floor cannot be verified against it`,
        });
        continue;
      }
      if (compareVersions(parsed, FLOOR_PARSED) < 0) {
        violations.push({
          rule: 'below-floor',
          detail:
            `${name}@${version} resolves below ${REACT_RSC_FLOOR}, the final fix for the ` +
            'Dec-2025 React RSC CVE series (CVE-2025-55182 "React2Shell" RCE, ' +
            'CVE-2025-55184 DoS, CVE-2025-55183 source exposure, CVE-2025-67779 follow-up)',
        });
      }
    }
  }

  if (distinctVersions.size > 1) {
    violations.push({
      rule: 'version-skew',
      detail:
        'react / react-dom / react-server-dom-webpack must resolve to one identical version ' +
        `(RSC flight-protocol lockstep); found ${distinctVersions.size} distinct: ` +
        presentLines.join('; '),
    });
  }

  return { violations, summary };
}

function main(): void {
  process.stdout.write('Validating React RSC CVE floor (resolved versions)...\n\n');

  let resolved: Map<string, string[]>;
  try {
    resolved = collectResolvedVersions();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`validate:react-floor FAIL\n${message}\n`);
    process.exit(1);
  }

  const { violations, summary } = evaluateFloor(resolved);

  for (const line of summary) {
    process.stdout.write(`  ${line}\n`);
  }

  if (violations.length > 0) {
    for (const violation of violations) {
      process.stderr.write(`  [${violation.rule}] ${violation.detail}\n`);
    }
    process.stderr.write(
      '\nReact RSC CVE floor: FAIL - hold react, react-dom, and react-server-dom-webpack ' +
        `at >=${REACT_RSC_FLOOR}, lockstep-exact (react.dev advisories 2025-12-03 / 2025-12-11)\n`,
    );
    process.exit(1);
  }

  process.stdout.write(
    `\nReact RSC CVE floor: PASS (floor ${REACT_RSC_FLOOR}, lockstep verified)\n`,
  );
}

const isMainModule = process.argv[1] ? import.meta.url === `file://${process.argv[1]}` : false;
if (isMainModule) main();
