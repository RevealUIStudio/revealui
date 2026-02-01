/**
 * Workflow Template Definitions
 *
 * Export all workflow templates for easy import.
 */

export {
  type CIWorkflowConfig,
  ciPresets,
  createCIWorkflow,
} from './ci-checks.js'
export {
  createDeployWorkflow,
  type DeployWorkflowConfig,
  deployPresets,
} from './deploy.js'
export {
  createReleaseWorkflow,
  type ReleaseWorkflowConfig,
  releasePresets,
} from './release.js'
