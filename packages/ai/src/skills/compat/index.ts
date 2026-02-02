/**
 * Compatibility and Enhancement Layer
 *
 * Ensure Vercel Skills work seamlessly with RevealUI's enhanced features.
 */

export {
  checkVercelCompatibility,
  normalizeVercelSkill,
  toVercelFormat,
} from './vercel-compat.js'

export {
  batchGenerateEmbeddings,
  enhanceSkillMetadata,
  generateEmbeddingsForVercelSkill,
} from './skill-enhancer.js'

export {
  formatAllowedToolsString,
  isToolSupported,
  mapRevealUIToolsToVercel,
  mapVercelToolsToRevealUI,
  parseAllowedToolsString,
  type RevealUITool,
  REVEALUI_TO_VERCEL,
  REVEALUI_TOOLS,
  type VercelTool,
  VERCEL_TO_REVEALUI,
  VERCEL_TOOLS,
} from './tool-mapper.js'
