/**
 * Temp-artifact lifecycle registry (RevealUI control layer, GAP-295).
 *
 * Claude Studio `~/.claude/scripts/tmpscript.js` is a thin adapter that
 * forwards here. Store: $XDG_STATE_HOME/revealui/tmp-scripts/manifest.json (default ~/.local/state).
 */

export { runTmpscriptCli } from './cli.js';
export {
  controlManifestPath,
  controlTmpscriptDir,
  legacyClaudeManifestPath,
  revealuiDataDir,
} from './paths.js';
export {
  ageDays,
  confirmTmpscript,
  ENTRY_RETENTION_DAYS,
  findEntry,
  formatCheckLines,
  PENDING_TTL_DAYS,
  pendingEntries,
  preserveTmpscript,
  registerTmpscript,
  sweepTmpscript,
} from './registry.js';
export { importManifest, loadManifest, ManifestPublishedError, saveManifest } from './store.js';
export type {
  ConfirmTmpscriptOptions,
  RegisterTmpscriptInput,
  SweepTmpscriptResult,
  TmpscriptEntry,
  TmpscriptManifest,
  TmpscriptStatus,
  TmpscriptStoreOptions,
} from './types.js';
