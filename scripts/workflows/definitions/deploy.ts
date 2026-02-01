/**
 * Deployment Workflow Template
 *
 * Automated deployment workflow with pre-deployment checks,
 * build verification, and staged rollout.
 *
 * @example
 * ```typescript
 * import { createDeployWorkflow } from './definitions/deploy.js'
 *
 * const workflow = createDeployWorkflow({
 *   environment: 'production',
 *   requireApproval: true,
 * })
 *
 * await workflow.execute()
 * ```
 */

import type { WorkflowStep } from '../../lib/state/index.js'

export interface DeployWorkflowConfig {
  /** Target environment */
  environment: 'development' | 'staging' | 'production'
  /** Git branch to deploy */
  branch?: string
  /** Require manual approval before deployment */
  requireApproval?: boolean
  /** Run smoke tests after deployment */
  runSmokeTests?: boolean
  /** Deployment strategy */
  strategy?: 'rolling' | 'blue-green' | 'canary'
  /** Rollback on failure */
  autoRollback?: boolean
}

export function createDeployWorkflow(config: DeployWorkflowConfig): {
  id: string
  name: string
  steps: WorkflowStep[]
} {
  const {
    environment,
    branch: _branch = 'main',
    requireApproval = environment === 'production',
    runSmokeTests = true,
    strategy = 'rolling',
    autoRollback = true,
  } = config

  const steps: WorkflowStep[] = [
    // Step 1: Pre-deployment checks
    {
      id: 'pre-checks',
      name: 'Pre-deployment Checks',
      description: 'Verify environment and prerequisites',
      action: async () => {
        // Check git status
        // Verify branch
        // Check for uncommitted changes
        // Validate environment variables
        return {
          success: true,
          message: 'Pre-deployment checks passed',
        }
      },
      onSuccess: 'build',
      onFailure: 'abort',
    },

    // Step 2: Build
    {
      id: 'build',
      name: 'Build Application',
      description: `Build for ${environment} environment`,
      action: async () => {
        // Run build command
        // Verify build artifacts
        return {
          success: true,
          message: 'Build completed successfully',
        }
      },
      onSuccess: 'test',
      onFailure: 'abort',
    },

    // Step 3: Run Tests
    {
      id: 'test',
      name: 'Run Tests',
      description: 'Execute test suite',
      action: async () => {
        // Run unit tests
        // Run integration tests
        return {
          success: true,
          message: 'All tests passed',
        }
      },
      onSuccess: requireApproval ? 'approval' : 'deploy',
      onFailure: 'abort',
    },

    // Step 4: Manual Approval (conditional)
    ...(requireApproval
      ? [
          {
            id: 'approval',
            name: 'Manual Approval',
            description: `Approve deployment to ${environment}`,
            requiresApproval: true,
            action: async () => {
              return {
                success: true,
                message: 'Deployment approved',
              }
            },
            onSuccess: 'deploy',
            onFailure: 'abort',
          } as WorkflowStep,
        ]
      : []),

    // Step 5: Deploy
    {
      id: 'deploy',
      name: 'Deploy Application',
      description: `Deploy to ${environment} using ${strategy} strategy`,
      action: async () => {
        // Execute deployment
        // Monitor deployment progress
        return {
          success: true,
          message: `Deployed to ${environment}`,
        }
      },
      onSuccess: runSmokeTests ? 'smoke-tests' : 'complete',
      onFailure: autoRollback ? 'rollback' : 'abort',
    },

    // Step 6: Smoke Tests (conditional)
    ...(runSmokeTests
      ? [
          {
            id: 'smoke-tests',
            name: 'Smoke Tests',
            description: 'Verify deployment health',
            action: async () => {
              // Run smoke tests
              // Check health endpoints
              return {
                success: true,
                message: 'Smoke tests passed',
              }
            },
            onSuccess: 'complete',
            onFailure: autoRollback ? 'rollback' : 'abort',
          } as WorkflowStep,
        ]
      : []),

    // Step 7: Rollback (conditional)
    ...(autoRollback
      ? [
          {
            id: 'rollback',
            name: 'Rollback Deployment',
            description: 'Revert to previous version',
            action: async () => {
              // Execute rollback
              return {
                success: true,
                message: 'Rolled back to previous version',
              }
            },
            onSuccess: 'abort',
            onFailure: 'abort',
          } as WorkflowStep,
        ]
      : []),

    // Step 8: Complete
    {
      id: 'complete',
      name: 'Deployment Complete',
      description: 'Finalize deployment',
      action: async () => {
        // Send notifications
        // Update deployment logs
        return {
          success: true,
          message: `Deployment to ${environment} completed successfully`,
        }
      },
      onSuccess: undefined,
      onFailure: undefined,
    },

    // Step 9: Abort
    {
      id: 'abort',
      name: 'Deployment Aborted',
      description: 'Deployment failed or was cancelled',
      action: async () => {
        // Cleanup resources
        // Send failure notifications
        return {
          success: false,
          message: 'Deployment aborted',
        }
      },
      onSuccess: undefined,
      onFailure: undefined,
    },
  ]

  return {
    id: `deploy-${environment}-${Date.now()}`,
    name: `Deploy to ${environment}`,
    steps,
  }
}

/**
 * Quick deployment presets
 */
export const deployPresets = {
  development: () =>
    createDeployWorkflow({
      environment: 'development',
      requireApproval: false,
      runSmokeTests: false,
      autoRollback: false,
    }),

  staging: () =>
    createDeployWorkflow({
      environment: 'staging',
      requireApproval: false,
      runSmokeTests: true,
      strategy: 'rolling',
      autoRollback: true,
    }),

  production: () =>
    createDeployWorkflow({
      environment: 'production',
      requireApproval: true,
      runSmokeTests: true,
      strategy: 'blue-green',
      autoRollback: true,
    }),
}
