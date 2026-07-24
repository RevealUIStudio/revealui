/**
 * Coding Tools Package
 * File operations, search, shell, git, and project context tools
 * for the RevealUI standalone coding agent.
 */

import type { Tool } from '../base.js';
import {
  maybeWrapToolsWithIntegrityAudit,
  type ToolIntegrityAuditHandler,
} from '../integrity-audit.js';
import { fileEditTool } from './file-edit.js';
import { fileGlobTool } from './file-glob.js';
import { fileGrepTool } from './file-grep.js';
import { fileReadTool } from './file-read.js';
import { fileWriteTool } from './file-write.js';
import { gitOpsTool } from './git-ops.js';
import { lintFixTool } from './lint-fix.js';
import { projectContextTool } from './project-context.js';
import type { SafetyConfig } from './safety.js';
import { configureSafety } from './safety.js';
import { shellExecTool } from './shell-exec.js';
import { testRunnerTool } from './test-runner.js';

// Re-export individual tools
export { fileEditTool } from './file-edit.js';
export { fileGlobTool } from './file-glob.js';
export { fileGrepTool } from './file-grep.js';
export { fileReadTool } from './file-read.js';
export { fileWriteTool } from './file-write.js';
export { gitOpsTool } from './git-ops.js';
export { lintFixTool } from './lint-fix.js';
export { projectContextTool } from './project-context.js';
// Re-export safety utilities
export type { SafetyConfig } from './safety.js';
export {
  configureSafety,
  getSafetyConfig,
  resolveSafePath,
  validateCommand,
  validatePath,
} from './safety.js';
export { shellExecTool } from './shell-exec.js';
export { testRunnerTool } from './test-runner.js';

/**
 * Configuration for the coding tools factory
 */
export interface CodingToolsConfig {
  /** Project root directory  -  all file operations sandboxed here */
  projectRoot: string;
  /** Additional directories to allow (e.g., /tmp for scratch files) */
  allowedPaths?: string[];
  /** Extra commands to deny beyond the built-in denylist */
  extraDeniedCommands?: string[];
  /** Extra path patterns to deny */
  deniedPathPatterns?: RegExp[];
  /** Which tools to include (default: all) */
  include?: Array<
    | 'file_read'
    | 'file_write'
    | 'file_edit'
    | 'file_glob'
    | 'file_grep'
    | 'shell_exec'
    | 'git_ops'
    | 'project_context'
    | 'test_runner'
    | 'lint_fix'
  >;
  /**
   * GAP-355 S5-4 integrity audit. When set, every tool execute is awaited and
   * successful results fail closed if the audit write throws.
   */
  onToolAudit?: ToolIntegrityAuditHandler;
}

/** All coding tools in registration order */
const ALL_CODING_TOOLS: Tool[] = [
  fileReadTool,
  fileWriteTool,
  fileEditTool,
  fileGlobTool,
  fileGrepTool,
  shellExecTool,
  gitOpsTool,
  projectContextTool,
  testRunnerTool,
  lintFixTool,
];

/**
 * Create coding tools with safety configuration applied.
 *
 * Must be called before any tool execution to establish the project root sandbox.
 */
export function createCodingTools(config: CodingToolsConfig): Tool[] {
  // Configure the safety module
  const safetyConfig: SafetyConfig = {
    projectRoot: config.projectRoot,
    allowedPaths: config.allowedPaths,
    extraDeniedCommands: config.extraDeniedCommands,
    deniedPathPatterns: config.deniedPathPatterns,
  };
  configureSafety(safetyConfig);

  // Filter tools if include list is provided
  let tools: Tool[];
  if (config.include) {
    const includeSet = new Set(config.include);
    tools = ALL_CODING_TOOLS.filter((t) =>
      includeSet.has(t.name as CodingToolsConfig['include'] extends Array<infer U> ? U : never),
    );
  } else {
    tools = [...ALL_CODING_TOOLS];
  }

  return maybeWrapToolsWithIntegrityAudit(tools, config.onToolAudit);
}
