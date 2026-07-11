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

const vercelVars = collectVars(readFileSync(VERCEL_MANIFEST, 'utf8'), 'projects', 'vercel');
const flyVars = collectVars(readFileSync(FLY_MANIFEST, 'utf8'), 'fly-apps', 'fly');
const allManifestPaths = [...vercelVars, ...flyVars].map((v) => v.path);
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

  it('no undeclared manifest path and every synced spec path is explicitly listed', () => {
    expect(findManifestDrift(allManifestPaths)).toEqual([]);
  });

  it('no retired (renamed-away) path is actively synced', () => {
    expect(findRetiredPathUsage(allManifestPaths)).toEqual([]);
  });

  it('sensitivity-completeness: credential-class Vercel vars are sensitive, public vars are bare', () => {
    expect(findSensitivityGaps(vercelVars)).toEqual([]);
  });

  it('the license private key is sensitive and the public key is bare in the Vercel manifest', () => {
    const priv = vercelVars.find((v) => v.name === 'REVEALUI_LICENSE_PRIVATE_KEY');
    const pub = vercelVars.find((v) => v.name === 'REVEALUI_LICENSE_PUBLIC_KEY');
    expect(priv?.sensitive).toBe(true);
    expect(pub?.sensitive).toBe(false);
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
  it('revealui/env/license is declared, intentionally unsynced, and absent from every manifest', () => {
    expect(DECLARED_PATHS.has('revealui/env/license')).toBe(true);
    expect(SYNCED_PATHS.has('revealui/env/license')).toBe(false);
    expect(allManifestPaths).not.toContain('revealui/env/license');
    const def = SECRET_PATHS.find((d) => d.path === 'revealui/env/license');
    // It bundles the private key → must be sensitive.
    expect(def?.sensitive).toBe(true);
    expect(isSensitiveKind(def?.kind ?? 'public-config')).toBe(true);
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
