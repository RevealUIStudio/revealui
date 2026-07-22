export {
  checkManager,
  contentRootPath,
  loadManager,
  materializeClaudeStub,
  materializeCursorStub,
  materializeGrokPointer,
  materializeManager,
  materializeOpenCodeStub,
  managerPath,
  writeManager,
} from './materialize.js';
export type { ManagerCheckResult, MaterializeResult } from './materialize.js';
export {
  MANAGER_CONTENT_DIR,
  MANAGER_DIR,
  MANAGER_FILE,
  type ManagerConfig,
  ManagerSchema,
} from './schema.js';
