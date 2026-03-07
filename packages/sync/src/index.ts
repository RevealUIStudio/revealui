/**
 * @revealui/sync — Real-time collaboration and sync primitives.
 *
 * The collab layer (Yjs-based) is fully functional.
 * ElectricProvider is a passthrough context — ElectricSQL integration is planned.
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
