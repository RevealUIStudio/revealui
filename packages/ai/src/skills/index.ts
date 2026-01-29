/**
 * Agent Skills
 *
 * Implementation of the Agent Skills open standard (skills.sh).
 * Allows RevealUI agents to install and use skill packages.
 *
 * @example
 * ```typescript
 * import {
 *   globalSkillRegistry,
 *   loadFromGitHub,
 *   SkillActivator,
 *   AgentSkillProvider,
 * } from '@revealui/ai/skills'
 *
 * // Install a skill from GitHub
 * await loadFromGitHub('vercel-labs/agent-skills/skills/react-best-practices', {
 *   targetDir: registry.getSkillDirectory('react-best-practices', 'local'),
 *   scope: 'local',
 *   registry: globalSkillRegistry,
 * })
 *
 * // Activate skills based on context
 * const activator = new SkillActivator({ registry: globalSkillRegistry })
 * const provider = new AgentSkillProvider({ activator })
 *
 * const result = await provider.injectSkillInstructions(messages, {
 *   taskDescription: 'Refactor this React component',
 * })
 * ```
 */

// Types
export {
  AllowedToolSchema,
  matchesAllowedTool,
  parseAllowedTool,
  SkillActivationContextSchema,
  SkillActivationResultSchema,
  SkillMetadataSchema,
  SkillResourceSchema,
  SkillSchema,
  type AllowedTool,
  type ParsedAllowedTool,
  type Skill,
  type SkillActivationContext,
  type SkillActivationResult,
  type SkillMetadata,
  type SkillResource,
} from './types.js'

// Parser
export {
  generateSkillMd,
  parseAllowedToolsString,
  parseSkillMd,
  parseSkillMetadataOnly,
  validateSkillMd,
  type ParsedSkillMd,
} from './parser/index.js'

// Registry
export {
  globalSkillRegistry,
  SkillRegistry,
  type SkillStorageConfig,
} from './registry/index.js'

// Loaders
export {
  createSkill,
  loadAllFromDirectory,
  loadFromGitHub,
  loadFromLocal,
  parseGitHubSource,
  removeSkill,
  updateFromGitHub,
  validateGitHubSource,
  type GitHubLoadOptions,
  type GitHubSource,
  type LocalLoadOptions,
  type SkillTemplate,
} from './loader/index.js'

// Activation
export { SkillActivator, type SkillActivatorConfig } from './activation/index.js'

// Integration
export {
  AgentSkillProvider,
  createAgentSkillProvider,
  type AgentMessage,
  type AgentSkillProviderConfig,
  type SkillInjectionResult,
} from './integration/index.js'
