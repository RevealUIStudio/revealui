/**
 * @revealui/sync  -  Real-time collaboration and sync primitives.
 *
 * The collab layer (Yjs-based) is fully functional.
 * ElectricProvider provides proxyBaseUrl config to child hooks. All hooks route
 * through the authenticated admin proxy at /api/shapes/*  -  no direct Electric client.
 *
 * Reads use ElectricSQL shape subscriptions for real-time updates.
 * Writes use REST mutations via /api/sync/*  -  changes propagate to all
 * subscribers automatically through ElectricSQL replication.
 */

export type {
  CollabDocumentState,
  UseCollaborationOptions,
  UseCollaborationResult,
} from './collab/index.js';
export {
  CollabProvider,
  useCollabDocument,
  useCollaboration,
} from './collab/index.js';
export type {
  AgentContextRecord,
  CreateAgentContextInput,
  UpdateAgentContextInput,
  UseAgentContextsResult,
} from './hooks/useAgentContexts.js';
export { useAgentContexts } from './hooks/useAgentContexts.js';
export type {
  AgentMemoryRecord,
  CreateAgentMemoryInput,
  UpdateAgentMemoryInput,
  UseAgentMemoryResult,
} from './hooks/useAgentMemory.js';
export { useAgentMemory } from './hooks/useAgentMemory.js';
export type {
  ConversationRecord,
  CreateConversationInput,
  UpdateConversationInput,
  UseConversationsResult,
} from './hooks/useConversations.js';
export { useConversations } from './hooks/useConversations.js';
export type {
  CoordinationSessionRecord,
  CreateCoordinationSessionInput,
  UpdateCoordinationSessionInput,
  UseCoordinationSessionsResult,
} from './hooks/useCoordinationSessions.js';
export { useCoordinationSessions } from './hooks/useCoordinationSessions.js';
export type {
  CoordinationWorkItemRecord,
  CreateCoordinationWorkItemInput,
  UpdateCoordinationWorkItemInput,
  UseCoordinationWorkItemsResult,
} from './hooks/useCoordinationWorkItems.js';
export { useCoordinationWorkItems } from './hooks/useCoordinationWorkItems.js';
export type { MutationResult } from './mutations.js';
export { ElectricProvider, useElectricConfig } from './provider/index.js';
export { useOfflineCache } from './hooks/useOfflineCache.js';
export { useOnlineStatus } from './hooks/useOnlineStatus.js';
export type { OnlineStatusResult } from './hooks/useOnlineStatus.js';
export { useShapeCacheInvalidation } from './hooks/useShapeCacheInvalidation.js';
export type { InvalidationAction } from './hooks/useShapeCacheInvalidation.js';
export type {
  ConflictStrategy,
  OfflineMutation,
  ConflictInfo,
  ReplayResult,
} from './conflict-resolution.js';
export {
  resolveConflict,
  replayMutations,
  coalesceMutations,
} from './conflict-resolution.js';
