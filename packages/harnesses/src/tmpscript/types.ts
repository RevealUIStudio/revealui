/**
 * Temp-artifact lifecycle registry (RevealUI control layer).
 *
 * One-shot helpers (installers, verifiers, repro scripts) must be registered,
 * validated, and cleaned — not left orphaned in $HOME or repo roots.
 * GAP-295 control-layer conversion of the Claude Studio adapter.
 */

export type TmpscriptStatus = 'pending' | 'confirmed';

export interface TmpscriptEntry {
  id: string;
  path: string;
  purpose: string;
  validate: string | null;
  session: string;
  created: string;
  status: TmpscriptStatus;
  confirmed: string | null;
  /** Set when sweep auto-closed an expired pending entry. */
  sweptAsExpired?: boolean;
}

export interface TmpscriptManifest {
  version: 1;
  /** Control-layer store path this manifest was last written to. */
  store?: string;
  entries: TmpscriptEntry[];
}

export interface RegisterTmpscriptInput {
  path: string;
  purpose?: string;
  validate?: string | null;
  id?: string;
}

export interface TmpscriptStoreOptions {
  controlPath?: string;
  legacyPath?: string;
  migrate?: boolean;
}

export interface ConfirmTmpscriptOptions extends TmpscriptStoreOptions {
  /** Injected for tests; default runs validate via shell execSync. */
  runValidate?: (cmd: string) => void;
  /** Injected for tests; default fs.unlinkSync. */
  unlinkPath?: (filePath: string) => void;
  pathExists?: (filePath: string) => boolean;
}

export interface SweepTmpscriptResult {
  removedFiles: number;
  prunedEntries: number;
  remaining: number;
}
