/**
 * Lockstep drift gate (P0-2). Asserts the four secret-path surfaces agree with
 * zero live API calls:
 *
 *   sync manifests (smol-toml)  ↔  SECRET_PATHS spec  ↔  docs/SECRETS.md (rendered)
 *
 * plus sensitivity-completeness, leaf-or-dir, kebab, retired-path, explicit-
 * listing, and the migrating_since>1-release-window tripwire. Wired into CI via
 * the Unit Tests job (`pnpm test` discovers scripts/**\/__tests__). No revvault,
 * no network, no secret values - path metadata only.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { collectVars } from '../parse-manifests.js';
import {
  extractGeneratedPaths,
  renderSecretPathsBlock,
  SECRETS_MD_PATH,
  spliceGenerated,
  syncedPathDefs,
} from '../render-secrets-md.js';
import {
  DECLARED_PATHS,
  findDocDrift,
  findExpiredMigrations,
  findLeafOrDirViolations,
  findManifestDrift,
  findNonKebabPaths,
  findRetiredPathUsage,
  findSensitivityGaps,
  findSpecSensitivityInconsistencies,
  isSensitiveKind,
  RETIRED_PATHS,
  SECRET_PATHS,
  SYNCED_PATHS,
} from '../secret-paths.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const VERCEL_MANIFEST = resolve(HERE, '../revvault-vercel.toml');
const FLY_MANIFEST = resolve(HERE, '../revvault-fly.toml');
const STAGING_MANIFEST = resolve(HERE, '../revvault-vercel-staging.toml');

const vercelVars = collectVars(readFileSync(VERCEL_MANIFEST, 'utf8'), 'projects', 'vercel');
const flyVars = collectVars(readFileSync(FLY_MANIFEST, 'utf8'), 'fly-apps', 'fly');
// The staging manifest (GAP-343 Phase 3) is a SEPARATE file from the prod
// Vercel manifest by design, but must get the same declared/synced/
// sensitivity/kebab lockstep coverage - fed into the same predicates below.
const stagingVars = collectVars(readFileSync(STAGING_MANIFEST, 'utf8'), 'projects', 'vercel');
const allManifestPaths = [...vercelVars, ...flyVars, ...stagingVars].map((v) => v.path);
const secretsMd = readFileSync(SECRETS_MD_PATH, 'utf8');
const docPaths = extractGeneratedPaths(secretsMd);

describe('secret-paths spec self-consistency', () => {
  it('every SecretPathDef.sensitive matches its kind', () => {
    expect(findSpecSensitivityInconsistencies(SECRET_PATHS)).toEqual([]);
  });

  it('every declared path is a leaf XOR a directory prefix, never both', () => {
    expect(findLeafOrDirViolations([...DECLARED_PATHS])).toEqual([]);
  });

  it('every path segment is lower-kebab', () => {
    expect(findNonKebabPaths([...DECLARED_PATHS])).toEqual([]);
  });
});

describe('manifest ↔ spec lockstep', () => {
  it('parses both manifests to a non-trivial var set', () => {
    expect(vercelVars.length).toBeGreaterThan(40);
    expect(flyVars.length).toBeGreaterThan(20);
  });

  it('parses the staging manifest to a non-trivial var set (GAP-343)', () => {
    expect(stagingVars.length).toBeGreaterThan(40);
  });

  it('no undeclared manifest path and every synced spec path is explicitly listed', () => {
    expect(findManifestDrift(allManifestPaths)).toEqual([]);
  });

  it('no retired (renamed-away) path is actively synced', () => {
    expect(findRetiredPathUsage(allManifestPaths)).toEqual([]);
  });

  it('sensitivity-completeness: credential-class Vercel vars are sensitive, public vars are bare', () => {
    expect(findSensitivityGaps(vercelVars)).toEqual([]);
  });

  it('sensitivity-completeness holds for the staging manifest too (GAP-343)', () => {
    expect(findSensitivityGaps(stagingVars)).toEqual([]);
  });

  it('the license private key is sensitive and the public key is bare in the Vercel manifest', () => {
    const priv = vercelVars.find((v) => v.name === 'REVEALUI_LICENSE_PRIVATE_KEY');
    const pub = vercelVars.find((v) => v.name === 'REVEALUI_LICENSE_PUBLIC_KEY');
    expect(priv?.sensitive).toBe(true);
    expect(pub?.sensitive).toBe(false);
  });

  it('the staging license private key is sensitive and the public key is bare', () => {
    const priv = stagingVars.find((v) => v.name === 'REVEALUI_LICENSE_PRIVATE_KEY');
    const pub = stagingVars.find((v) => v.name === 'REVEALUI_LICENSE_PUBLIC_KEY');
    expect(priv?.sensitive).toBe(true);
    expect(pub?.sensitive).toBe(false);
  });

  it('the staging license keypair path is isolated from the prod revdev/* pair', () => {
    const priv = stagingVars.find((v) => v.name === 'REVEALUI_LICENSE_PRIVATE_KEY');
    const pub = stagingVars.find((v) => v.name === 'REVEALUI_LICENSE_PUBLIC_KEY');
    expect(priv?.path).toBe('revealui/staging/license/private-key');
    expect(pub?.path).toBe('revealui/staging/license/public-key');
  });

  // GAP-343: the staging manifest reuses exactly five prod paths on purpose
  // (Gmail SA transport + one Stripe meter-event name - see the manifest
  // header + the consumers additions on those prod SECRET_PATHS entries).
  // Any OTHER revealui/prod/* reference in the staging manifest is an
  // accidental leak, not a deliberate reuse - this is the machine-checked
  // form of the PR's "grep the diff for revealui/prod/ paths" instruction.
  it('the staging manifest references revealui/prod/* only for the documented reuse set', () => {
    const allowedProdReuse: ReadonlySet<string> = new Set([
      'revealui/prod/stripe/agent-meter-event-name',
      'revealui/prod/google/service-account-email',
      'revealui/prod/google/private-key',
      'revealui/prod/email/from',
      'revealui/prod/email/reply-to',
    ]);
    const unexpectedProdPaths = stagingVars
      .map((v) => v.path)
      .filter((path) => path.startsWith('revealui/prod/') && !allowedProdReuse.has(path));
    expect(unexpectedProdPaths).toEqual([]);
  });
});

describe('SECRETS.md ↔ spec lockstep (rendered derived view)', () => {
  it('the generated block lists exactly the synced spec paths', () => {
    expect(findDocDrift(docPaths)).toEqual([]);
    expect(new Set(docPaths)).toEqual(SYNCED_PATHS);
  });

  it('is idempotent - re-rendering the committed doc produces no diff', () => {
    expect(spliceGenerated(secretsMd, renderSecretPathsBlock())).toEqual(secretsMd);
  });
});

describe('env/* mirror invariant (R8)', () => {
  it('revealui/env/license is public-only, intentionally unsynced, and absent from every manifest (GAP-260 P2-2)', () => {
    expect(DECLARED_PATHS.has('revealui/env/license')).toBe(true);
    expect(SYNCED_PATHS.has('revealui/env/license')).toBe(false);
    expect(allManifestPaths).not.toContain('revealui/env/license');
    const def = SECRET_PATHS.find((d) => d.path === 'revealui/env/license');
    expect(def?.kind).toBe('signing-public');
    expect(def?.sensitive).toBe(false);
    expect(isSensitiveKind(def?.kind ?? 'public-config')).toBe(false);
    expect(def?.consumers).toEqual(['with-secrets:license']);
  });

  it('revealui/env/license-signing is private, intentionally unsynced (GAP-260 P2-2)', () => {
    expect(DECLARED_PATHS.has('revealui/env/license-signing')).toBe(true);
    expect(SYNCED_PATHS.has('revealui/env/license-signing')).toBe(false);
    expect(allManifestPaths).not.toContain('revealui/env/license-signing');
    const def = SECRET_PATHS.find((d) => d.path === 'revealui/env/license-signing');
    expect(def?.kind).toBe('signing-private');
    expect(def?.sensitive).toBe(true);
    expect(def?.consumers).toEqual(['with-secrets:license-signing']);
  });
});

describe('license migration is declared, not moved', () => {
  it('canonical stays at the live revdev path with a declared target', () => {
    const priv = SECRET_PATHS.find((d) => d.path === 'revdev/license-signing-private-key');
    expect(priv).toBeDefined();
    expect(priv?.migratingTo).toBe('revealui/prod/license/private-key');
    expect(priv?.migratingSince).toBe('2026-06-28');
    // The target must NOT yet be a declared canonical path (value has not moved).
    expect(DECLARED_PATHS.has('revealui/prod/license/private-key')).toBe(false);
    // And the retired dedup paths are never canonical.
    for (const retired of RETIRED_PATHS) {
      expect(DECLARED_PATHS.has(retired)).toBe(false);
    }
  });
});

describe('migrating_since > 1-release-window tripwire', () => {
  it('a fresh migration is clean within the window', () => {
    // Reference instant close to migratingSince - deterministic, not wall-clock.
    expect(findExpiredMigrations(SECRET_PATHS, '2026-07-01', 90)).toEqual([]);
  });

  it('FAILS a migration that lingers past one release window', () => {
    const drift = findExpiredMigrations(SECRET_PATHS, '2027-01-01', 90);
    expect(drift.length).toBeGreaterThan(0);
    expect(drift.every((d) => d.kind === 'expired-migration')).toBe(true);
    // Both license leaves carry migratingSince, so both trip.
    expect(drift.map((d) => d.path)).toContain('revdev/license-signing-private-key');
  });
});

describe('rendered synced surface', () => {
  it('renders every synced path (count derived from the spec, not a hand-maintained literal)', () => {
    expect(docPaths.length).toBe(syncedPathDefs().length);
    expect(syncedPathDefs().length).toBe(SYNCED_PATHS.size);
  });
});
