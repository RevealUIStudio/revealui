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

export { ClientOnly } from './client-only.js';
export type {
  CollabDocumentState,
  KgViewAnnotation,
  KgViewLayoutPosition,
  KgViewPresenceEntry,
  KgViewState,
  UseCollaborationOptions,
  UseCollaborationResult,
  UseKgViewDocumentResult,
} from './collab/index.js';
export {
  buildAnnotationPatch,
  buildKgViewDocumentId,
  buildLayoutPatch,
  buildPinPatch,
  buildPresencePatch,
  CollabProvider,
  isKgViewDocumentId,
  isPresenceStale,
  isValidKgViewSlug,
  KG_VIEW_ID_PREFIX,
  PRESENCE_STALE_MS,
  parseKgViewState,
  useCollabDocument,
  useCollaboration,
  useKgViewDocument,
} from './collab/index.js';
export type {
  ConflictInfo,
  ConflictStrategy,
  OfflineMutation,
  ReplayResult,
} from './conflict-resolution.js';
export {
  coalesceMutations,
  replayMutations,
  resolveConflict,
} from './conflict-resolution.js';
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
export type {
  KgEdgeEpisodeRecord,
  KgEdgeRecord,
  KgNodeRecord,
  UseKgEdgeEpisodesResult,
  UseKgEdgesResult,
  UseKgNodesResult,
  UseKnowledgeGraphResult,
} from './hooks/useKnowledgeGraph.js';
export {
  useKgEdgeEpisodes,
  useKgEdges,
  useKgNodes,
  useKnowledgeGraph,
} from './hooks/useKnowledgeGraph.js';
export { useOfflineCache } from './hooks/useOfflineCache.js';
export type { OnlineStatusResult } from './hooks/useOnlineStatus.js';
export { useOnlineStatus } from './hooks/useOnlineStatus.js';
export type { InvalidationAction } from './hooks/useShapeCacheInvalidation.js';
export { useShapeCacheInvalidation } from './hooks/useShapeCacheInvalidation.js';
export type {
  CreateSharedFactInput,
  SharedFactRecord,
  UpdateSharedFactInput,
  UseSharedFactsResult,
} from './hooks/useSharedFacts.js';
export { useSharedFacts } from './hooks/useSharedFacts.js';
export type {
  CreateSharedMemoryInput,
  SharedMemoryRecord,
  UpdateSharedMemoryInput,
  UseSharedMemoriesResult,
} from './hooks/useSharedMemories.js';
export { useSharedMemories } from './hooks/useSharedMemories.js';
export type {
  CreateTaskSubmissionInput,
  TaskSubmissionRecord,
  UpdateTaskSubmissionInput,
  UseTaskSubmissionsResult,
} from './hooks/useTaskSubmissions.js';
export { useTaskSubmissions } from './hooks/useTaskSubmissions.js';
export type { MutationResult } from './mutations.js';
/**
 * localStorage-backed offline mutation queue (table/operation shape).
 * Distinct from conflict-resolution `OfflineMutation` (HTTP replay shape).
 */
export type { OfflineMutation as OfflineQueueMutation } from './offline-queue.js';
export { OfflineMutationQueue } from './offline-queue.js';
export { ElectricProvider, useElectricConfig } from './provider/index.js';
