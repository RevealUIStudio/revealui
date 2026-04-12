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
  createTask,
  evictTask,
  getTask,
  getTaskSignal,
  updateTaskState,
} from './task-store.js';
