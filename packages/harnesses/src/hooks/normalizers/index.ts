import type {
  HarnessEnforcementTier,
  HarnessHookEvent,
  HarnessHookSource,
} from '../../types/hook-event.js';
import { normalizeClaudeCodeHookEvent } from './claude-code.js';
import { normalizeCursorHookEvent } from './cursor.js';
import { normalizeGrokHookEvent } from './grok.js';
import { normalizeVSCodeHookEvent } from './vscode.js';

export { normalizeClaudeCodeHookEvent } from './claude-code.js';
export { normalizeCursorHookEvent } from './cursor.js';
export { normalizeGrokHookEvent } from './grok.js';
export { normalizeVSCodeHookEvent } from './vscode.js';

/** Sources with a normalizer implemented in this package today. */
export type ImplementedHookSource = Extract<
  HarnessHookSource,
  'cursor' | 'claude-code' | 'vscode' | 'grok'
>;

const IMPLEMENTED_SOURCES: ReadonlySet<string> = new Set<ImplementedHookSource>([
  'cursor',
  'claude-code',
  'vscode',
  'grok',
]);

/** True if `normalizeHookEvent` has a normalizer for this source. */
export function isImplementedHookSource(source: string): source is ImplementedHookSource {
  return IMPLEMENTED_SOURCES.has(source);
}

/**
 * Dispatch a raw hook payload to the normalizer for its source.
 *
 * `opencode` is a declared `HarnessHookSource` member (the schema
 * anticipates it) but has no normalizer -- OpenCode has no hook system to
 * normalize from (`hooks.supported: false` in `TOOL_PROFILES.opencode`).
 * Callers should gate on `isImplementedHookSource` before calling this.
 */
export function normalizeHookEvent(
  source: ImplementedHookSource,
  raw: unknown,
  enforcementTier: HarnessEnforcementTier,
): HarnessHookEvent {
  switch (source) {
    case 'cursor':
      return normalizeCursorHookEvent(raw, enforcementTier);
    case 'claude-code':
      return normalizeClaudeCodeHookEvent(raw, enforcementTier);
    case 'vscode':
      return normalizeVSCodeHookEvent(raw, enforcementTier);
    case 'grok':
      return normalizeGrokHookEvent(raw, enforcementTier);
  }
}
