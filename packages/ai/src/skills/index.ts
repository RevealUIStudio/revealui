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

// Activation
export { SkillActivator, type SkillActivatorConfig } from './activation/index.js';
// Catalog
export {
  type CatalogConfig,
  type CatalogMetadata,
  clearCatalogCache,
  fetchVercelCatalog,
  getSkillById,
  getSkillsByCompatibility,
  getSkillsByTag,
  getTrendingSkills,
  type SearchOptions,
  searchVercelCatalog,
  type VercelCatalog,
  type VercelCatalogSkill,
  type VercelSkillSearchResult,
} from './catalog/index.js';
// Compatibility
export {
  batchGenerateEmbeddings,
  checkVercelCompatibility,
  enhanceSkillMetadata,
  formatAllowedToolsString,
  generateEmbeddingsForVercelSkill,
  isToolSupported,
  mapRevealUIToolsToVercel,
  mapVercelToolsToRevealUI,
  normalizeVercelSkill,
  REVEALUI_TO_VERCEL,
  REVEALUI_TOOLS,
  type RevealUITool,
  toVercelFormat,
  VERCEL_TO_REVEALUI,
  VERCEL_TOOLS,
  type VercelTool,
} from './compat/index.js';
// Integration
export {
  type AgentMessage,
  AgentSkillProvider,
  type AgentSkillProviderConfig,
  createAgentSkillProvider,
  type SkillInjectionResult,
} from './integration/index.js';
// Loaders
export {
  checkVercelSkillUpdates,
  createSkill,
  type GitHubLoadOptions,
  type GitHubSource,
  isVercelCliAvailable,
  type LocalLoadOptions,
  loadAllFromDirectory,
  loadFromGitHub,
  loadFromLocal,
  loadFromVercelSkills,
  parseGitHubSource,
  parseVercelSource,
  removeSkill,
  type SkillTemplate,
  type UpdateInfo,
  updateFromGitHub,
  updateVercelSkill,
  type VercelLoadOptions,
  type VercelSource,
  validateGitHubSource,
} from './loader/index.js';
// Parser
export {
  generateSkillMd,
  type ParsedSkillMd,
  parseAllowedToolsString,
  parseSkillMd,
  parseSkillMetadataOnly,
  validateSkillMd,
} from './parser/index.js';
// Registry
export {
  globalSkillRegistry,
  SkillRegistry,
  type SkillStorageConfig,
} from './registry/index.js';
// Types
export {
  type AllowedTool,
  AllowedToolSchema,
  matchesAllowedTool,
  type ParsedAllowedTool,
  parseAllowedTool,
  type Skill,
  type SkillActivationContext,
  SkillActivationContextSchema,
  type SkillActivationResult,
  SkillActivationResultSchema,
  type SkillMetadata,
  SkillMetadataSchema,
  type SkillResource,
  SkillResourceSchema,
  SkillSchema,
  type SkillSource,
  SkillSourceSchema,
} from './types.js';
