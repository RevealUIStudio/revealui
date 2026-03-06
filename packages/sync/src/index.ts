/**
 * @experimental ElectricSQL sync is not yet functional.
 * The ElectricProvider is currently a passthrough that renders children without
 * establishing any sync connection. Do not use in production.
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
export { useConversations } from './hooks/useConversations.js'
export { ElectricProvider } from './provider/index.js'
