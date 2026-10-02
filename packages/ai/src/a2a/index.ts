/**
 * @revealui/ai  -  A2A Protocol Implementation
 *
 * Agent-to-Agent (A2A) protocol support for RevealUI.
 * Exports the agent card registry, task store, and JSON-RPC handler.
 */

export { agentCardRegistry } from './card.js';
export { handleA2AJsonRpc, RPC_INVALID_REQUEST, RPC_PARSE_ERROR } from './handler.js';
export {
  appendArtifact,
  cancelTask,
  claimTask,
  createTask,
  evictTask,
  getTask,
  getTaskSignal,
  resumePendingTask,
  startClaimedTask,
  updateTaskState,
} from './task-store.js';
