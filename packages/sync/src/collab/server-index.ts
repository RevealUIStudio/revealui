export type { AgentCollabClientOptions, AgentIdentity } from './agent-client.js';
export { AgentCollabClient } from './agent-client.js';
export type { CreateAgentClientOptions } from './agent-client-factory.js';
export { createAgentClient, createAndConnectAgentClient } from './agent-client-factory.js';
export type {
  KgViewAnnotation,
  KgViewLayoutPosition,
  KgViewPresenceEntry,
  KgViewState,
} from './kg-view.js';
export {
  buildAnnotationPatch,
  buildKgViewDocumentId,
  buildLayoutPatch,
  buildPinPatch,
  buildPresencePatch,
  isKgViewDocumentId,
  isPresenceStale,
  isValidKgViewSlug,
  KG_VIEW_ID_PREFIX,
  PRESENCE_STALE_MS,
  parseKgViewState,
} from './kg-view.js';
export { MESSAGE_AWARENESS, MESSAGE_SYNC } from './protocol-constants.js';
export type { ApplyResult, PatchType, ScratchpadPatch } from './scratchpad-patch-applier.js';
export { applyPatch, applyPatches, readScratchpad } from './scratchpad-patch-applier.js';
