/**
 * Compatibility and Enhancement Layer
 *
 * Ensure Vercel Skills work seamlessly with RevealUI's enhanced features.
 */

export {
  batchGenerateEmbeddings,
  enhanceSkillMetadata,
  generateEmbeddingsForVercelSkill,
} from './skill-enhancer.js';
export {
  formatAllowedToolsString,
  isToolSupported,
  mapRevealUIToolsToVercel,
  mapVercelToolsToRevealUI,
  parseAllowedToolsString,
  REVEALUI_TO_VERCEL,
  REVEALUI_TOOLS,
  type RevealUITool,
  VERCEL_TO_REVEALUI,
  VERCEL_TOOLS,
  type VercelTool,
} from './tool-mapper.js';
export {
  checkVercelCompatibility,
  normalizeVercelSkill,
  toVercelFormat,
} from './vercel-compat.js';
