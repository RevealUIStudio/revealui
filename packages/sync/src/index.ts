/**
 * @revealui/sync — Real-time collaboration and sync primitives.
 *
 * The collab layer (Yjs-based) is fully functional.
 * ElectricProvider provides proxyBaseUrl config to child hooks. All hooks route
 * through the authenticated CMS proxy at /api/shapes/* — no direct Electric client.
 */

export type {
  CollabDocumentState,
  UseCollaborationOptions,
  UseCollaborationResult,
} from './collab/index.js'
export {
  CollabProvider,
  useCollabDocument,
  useCollaboration,
} from './collab/index.js'
export type { AgentContextRecord } from './hooks/useAgentContexts.js'
export { useAgentContexts } from './hooks/useAgentContexts.js'
export type { AgentMemoryRecord } from './hooks/useAgentMemory.js'
export { useAgentMemory } from './hooks/useAgentMemory.js'
export { useConversations } from './hooks/useConversations.js'
export { ElectricProvider, useElectricConfig } from './provider/index.js'
