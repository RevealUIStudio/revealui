export {
  GROK_HOOK_FILES,
  GROK_HOOK_TEMPLATE_DIR,
  GROK_SESSION_END_HOOKS_JSON,
  GROK_SESSION_START_HOOKS_JSON,
} from './grok-session-hooks.js';
export type { ManagerCheckResult, MaterializeResult } from './materialize.js';
export {
  checkManager,
  contentRootPath,
  loadManager,
  managerPath,
  materializeClaudeStub,
  materializeCursorStub,
  materializeGrokPointer,
  materializeManager,
  materializeOpenCodeStub,
  materializeRevDevPointer,
  writeManager,
  writeManagerPreserving,
} from './materialize.js';
export {
  MANAGER_CONTENT_DIR,
  MANAGER_DIR,
  MANAGER_FILE,
  type ManagerConfig,
  ManagerSchema,
} from './schema.js';
