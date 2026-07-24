import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { controlManifestPath, ensureControlHotfixDir, legacyClaudeManifestPath } from './paths.js';
import type { HotfixManifest } from './types.js';

const EMPTY: HotfixManifest = { version: 1, entries: [] };

function parseManifest(raw: string): HotfixManifest | null {
  try {
    const data = JSON.parse(raw) as HotfixManifest;
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
 * legacy `~/.claude/hotfixes` adapter store (does not delete legacy).
 */
export function loadManifest(options?: {
  controlPath?: string;
  legacyPath?: string;
  migrate?: boolean;
}): HotfixManifest {
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
      const migrated: HotfixManifest = {
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

export function saveManifest(m: HotfixManifest, options?: { controlPath?: string }): void {
  const controlPath = options?.controlPath ?? controlManifestPath();
  ensureControlHotfixDir();
  const out: HotfixManifest = {
    version: 1,
    store: controlPath,
    entries: m.entries,
  };
  writeFileSync(controlPath, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
}
