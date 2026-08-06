/**
 * Temp-artifact lifecycle registry (RevealUI control layer, GAP-295).
 *
 * Claude Studio `~/.claude/scripts/tmpscript.js` is a thin adapter that
 * forwards here. Store: ~/.local/share/revealui/tmp-scripts/manifest.json
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
  registerTmpscript,
  sweepTmpscript,
} from './registry.js';
export { loadManifest, saveManifest } from './store.js';
export type {
  ConfirmTmpscriptOptions,
  RegisterTmpscriptInput,
  SweepTmpscriptResult,
  TmpscriptEntry,
  TmpscriptManifest,
  TmpscriptStatus,
  TmpscriptStoreOptions,
} from './types.js';
