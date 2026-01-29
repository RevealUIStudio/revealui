/**
 * Skill Loaders
 *
 * Load skills from various sources (GitHub, local directories).
 */

export {
  loadFromGitHub,
  parseGitHubSource,
  updateFromGitHub,
  validateGitHubSource,
  type GitHubLoadOptions,
  type GitHubSource,
} from './github-loader.js'

export {
  createSkill,
  loadAllFromDirectory,
  loadFromLocal,
  removeSkill,
  type LocalLoadOptions,
  type SkillTemplate,
} from './local-loader.js'
