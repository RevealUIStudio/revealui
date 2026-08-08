/**
 * GAP-381 Phase D — RevealUI as an ACP agent server.
 *
 * @see ADR 2026-08-08-gap-381-acp-sdk-posture (D-B: official SDK)
 */

export {
  acp,
  createRevealUiAcpAgent,
  type RevealUiAcpAgentOptions,
} from './agent.js';
export {
  type AcpPromptExecutor,
  type AcpPromptInput,
  type AcpPromptResult,
  createDefaultAcpPromptExecutor,
} from './executor.js';
export { extractPromptText, isTextContentBlock } from './prompt-text.js';
export { runRevealUiAcpAgentStdio } from './stdio.js';
