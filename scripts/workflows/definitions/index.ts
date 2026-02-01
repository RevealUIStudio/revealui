/**
 * Workflow Template Definitions
 *
 * Export all workflow templates for easy import.
 */

export {
  createDeployWorkflow,
  deployPresets,
  type DeployWorkflowConfig,
} from './deploy.js'

export {
  createReleaseWorkflow,
  releasePresets,
  type ReleaseWorkflowConfig,
} from './release.js'

export {
  ciPresets,
  createCIWorkflow,
  type CIWorkflowConfig,
} from './ci-checks.js'
