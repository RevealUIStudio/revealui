import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import {
  controlManifestPath,
  ensureControlTmpscriptDir,
  legacyClaudeManifestPath,
} from './paths.js';
import type { TmpscriptManifest, TmpscriptStoreOptions } from './types.js';

const EMPTY: TmpscriptManifest = { version: 1, entries: [] };

function parseManifest(raw: string): TmpscriptManifest | null {
  try {
    const data = JSON.parse(raw) as TmpscriptManifest;
    if (data && Array.isArray(data.entries)) {
      return { version: 1, store: data.store, entries: data.entries };
    }
  } catch {
    /* corrupt */
  }
  return null;
}

/**
 * Load control-layer manifest. If missing/empty, one-time import from the
 * legacy `~/.claude/tmp-scripts` adapter store (does not delete legacy).
 */
export function loadManifest(options?: TmpscriptStoreOptions): TmpscriptManifest {
  const controlPath = options?.controlPath ?? controlManifestPath();
  const legacyPath = options?.legacyPath ?? legacyClaudeManifestPath();
  const migrate = options?.migrate !== false;

  if (existsSync(controlPath)) {
    const parsed = parseManifest(readFileSync(controlPath, 'utf8'));
    if (parsed) return parsed;
  }

  if (migrate && existsSync(legacyPath)) {
    const legacy = parseManifest(readFileSync(legacyPath, 'utf8'));
    if (legacy && legacy.entries.length > 0) {
      const migrated: TmpscriptManifest = {
        version: 1,
        store: controlPath,
        entries: legacy.entries,
      };
      saveManifest(migrated, { controlPath });
      return migrated;
    }
  }

  return { ...EMPTY, store: controlPath, entries: [] };
}

export function saveManifest(m: TmpscriptManifest, options?: { controlPath?: string }): void {
  const controlPath = options?.controlPath ?? controlManifestPath();
  ensureControlTmpscriptDir();
  const out: TmpscriptManifest = {
    version: 1,
    store: controlPath,
    entries: m.entries,
  };
  writeFileSync(controlPath, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
}
