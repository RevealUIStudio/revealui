/**
 * Inference utilities — context budget, compression, and task decomposition.
 */

export {
  type ContextBudget,
  classifyModel,
  getContextBudget,
  getContextBudgetForModel,
  type ModelTier,
  pruneHistory,
  truncateToolResult,
} from './context-budget.js';
export { compressContext } from './overflow-compressor.js';

export {
  configureDecomposer,
  type DecomposedStep,
  type DecomposerConfig,
  type DecompositionResult,
  decomposeTask,
  estimateComplexity,
  type StepResult,
  selectToolsForStep,
  shouldDecompose,
} from './task-decomposer.js';
export {
  type CompressorConfig,
  compressSearchResult,
  compressToolResult,
  configureCompressor,
  getLimitsForTool,
  type ToolLimits,
} from './tool-result-compressor.js';
