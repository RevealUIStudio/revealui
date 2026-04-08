/**
 * Skill Loaders
 *
 * Load skills from various sources (GitHub, local directories, Vercel Skills ecosystem).
 */

export {
  type GitHubLoadOptions,
  type GitHubSource,
  loadFromGitHub,
  parseGitHubSource,
  updateFromGitHub,
  validateGitHubSource,
} from './github-loader.js';

export {
  createSkill,
  type LocalLoadOptions,
  loadAllFromDirectory,
  loadFromLocal,
  removeSkill,
  type SkillTemplate,
} from './local-loader.js';

export {
  checkVercelSkillUpdates,
  isVercelCliAvailable,
  loadFromVercelSkills,
  updateVercelSkill,
  type VercelLoadOptions,
} from './vercel-loader.js';

export { parseVercelSource, type UpdateInfo, type VercelSource } from './vercel-types.js';
