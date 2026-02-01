/**
 * Skill Loaders
 *
 * Load skills from various sources (GitHub, local directories).
 */

export {
  type GitHubLoadOptions,
  type GitHubSource,
  loadFromGitHub,
  parseGitHubSource,
  updateFromGitHub,
  validateGitHubSource,
} from './github-loader.js'

export {
  createSkill,
  type LocalLoadOptions,
  loadAllFromDirectory,
  loadFromLocal,
  removeSkill,
  type SkillTemplate,
} from './local-loader.js'
