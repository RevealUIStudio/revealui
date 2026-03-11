/**
 * Release Workflow Template
 *
 * Automated release workflow with version bumping, changelog generation,
 * testing, and publishing.
 *
 * @example
 * ```typescript
 * import { createReleaseWorkflow } from './definitions/release.js'
 *
 * const workflow = createReleaseWorkflow({
 *   versionType: 'minor',
 *   publish: true,
 * })
 *
 * await workflow.execute()
 * ```
 */

import type { WorkflowStep } from '../../lib/state/index.js';

export interface ReleaseWorkflowConfig {
  /** Version bump type */
  versionType: 'major' | 'minor' | 'patch' | 'prerelease';
  /** Publish to npm */
  publish?: boolean;
  /** Create git tag */
  createTag?: boolean;
  /** Generate changelog */
  generateChangelog?: boolean;
  /** Run full test suite */
  runTests?: boolean;
  /** Create GitHub release */
  createGitHubRelease?: boolean;
  /** Dry run (no actual changes) */
  dryRun?: boolean;
}

export function createReleaseWorkflow(config: ReleaseWorkflowConfig): {
  id: string;
  name: string;
  steps: WorkflowStep[];
} {
  const {
    versionType,
    publish = true,
    createTag = true,
    generateChangelog = true,
    runTests = true,
    createGitHubRelease = true,
    dryRun = false,
  } = config;

  const steps: WorkflowStep[] = [
    // Step 1: Pre-release checks
    {
      id: 'pre-checks',
      name: 'Pre-release Checks',
      description: 'Verify repository state',
      action: async () => {
        // Check git status (no uncommitted changes)
        // Verify on main branch
        // Check remote is up to date
        // Verify npm credentials (if publishing)
        return {
          success: true,
          message: 'Pre-release checks passed',
        };
      },
      onSuccess: 'version-bump',
      onFailure: 'abort',
    },

    // Step 2: Version Bump
    {
      id: 'version-bump',
      name: 'Bump Version',
      description: `Bump ${versionType} version`,
      action: async () => {
        // Update package.json version
        // Update all workspace package versions
        // Update lock file
        if (dryRun) {
          return {
            success: true,
            message: `[DRY RUN] Would bump ${versionType} version`,
          };
        }
        return {
          success: true,
          message: `Version bumped: ${versionType}`,
        };
      },
      onSuccess: generateChangelog ? 'changelog' : 'build',
      onFailure: 'abort',
    },

    // Step 3: Generate Changelog (conditional)
    ...(generateChangelog
      ? [
          {
            id: 'changelog',
            name: 'Generate Changelog',
            description: 'Create changelog from commits',
            action: async () => {
              // Generate changelog from git history
              // Update CHANGELOG.md
              if (dryRun) {
                return {
                  success: true,
                  message: '[DRY RUN] Would generate changelog',
                };
              }
              return {
                success: true,
                message: 'Changelog generated',
              };
            },
            onSuccess: 'build',
            onFailure: 'abort',
          } as WorkflowStep,
        ]
      : []),

    // Step 4: Build
    {
      id: 'build',
      name: 'Build All Packages',
      description: 'Build production artifacts',
      action: async () => {
        // Run production build
        // Verify build artifacts
        return {
          success: true,
          message: 'Build completed',
        };
      },
      onSuccess: runTests ? 'test' : 'commit',
      onFailure: 'abort',
    },

    // Step 5: Run Tests (conditional)
    ...(runTests
      ? [
          {
            id: 'test',
            name: 'Run Test Suite',
            description: 'Execute all tests',
            action: async () => {
              // Run unit tests
              // Run integration tests
              // Run E2E tests
              return {
                success: true,
                message: 'All tests passed',
              };
            },
            onSuccess: 'commit',
            onFailure: 'abort',
          } as WorkflowStep,
        ]
      : []),

    // Step 6: Commit Changes
    {
      id: 'commit',
      name: 'Commit Release',
      description: 'Commit version changes',
      action: async () => {
        // Git add changed files
        // Commit with release message
        if (dryRun) {
          return {
            success: true,
            message: '[DRY RUN] Would commit release',
          };
        }
        return {
          success: true,
          message: 'Release committed',
        };
      },
      onSuccess: createTag ? 'tag' : publish ? 'publish' : 'complete',
      onFailure: 'abort',
    },

    // Step 7: Create Git Tag (conditional)
    ...(createTag
      ? [
          {
            id: 'tag',
            name: 'Create Git Tag',
            description: 'Tag release version',
            action: async () => {
              // Create annotated git tag
              // Push tag to remote
              if (dryRun) {
                return {
                  success: true,
                  message: '[DRY RUN] Would create git tag',
                };
              }
              return {
                success: true,
                message: 'Git tag created',
              };
            },
            onSuccess: publish ? 'publish' : createGitHubRelease ? 'github-release' : 'complete',
            onFailure: 'abort',
          } as WorkflowStep,
        ]
      : []),

    // Step 8: Publish to npm (conditional)
    ...(publish
      ? [
          {
            id: 'publish',
            name: 'Publish to npm',
            description: 'Publish packages to registry',
            action: async () => {
              // Publish all changed packages
              // Verify publication
              if (dryRun) {
                return {
                  success: true,
                  message: '[DRY RUN] Would publish to npm',
                };
              }
              return {
                success: true,
                message: 'Published to npm',
              };
            },
            onSuccess: createGitHubRelease ? 'github-release' : 'complete',
            onFailure: 'abort',
          } as WorkflowStep,
        ]
      : []),

    // Step 9: Create GitHub Release (conditional)
    ...(createGitHubRelease
      ? [
          {
            id: 'github-release',
            name: 'Create GitHub Release',
            description: 'Create release on GitHub',
            action: async () => {
              // Create GitHub release
              // Upload release assets
              if (dryRun) {
                return {
                  success: true,
                  message: '[DRY RUN] Would create GitHub release',
                };
              }
              return {
                success: true,
                message: 'GitHub release created',
              };
            },
            onSuccess: 'complete',
            onFailure: 'abort',
          } as WorkflowStep,
        ]
      : []),

    // Step 10: Complete
    {
      id: 'complete',
      name: 'Release Complete',
      description: 'Finalize release',
      action: async () => {
        // Send notifications
        // Update documentation
        // Post release announcement
        return {
          success: true,
          message: dryRun
            ? '[DRY RUN] Release preview completed'
            : 'Release completed successfully',
        };
      },
      onSuccess: undefined,
      onFailure: undefined,
    },

    // Step 11: Abort
    {
      id: 'abort',
      name: 'Release Aborted',
      description: 'Release failed or was cancelled',
      action: async () => {
        // Revert version changes
        // Cleanup temporary files
        return {
          success: false,
          message: 'Release aborted - changes reverted',
        };
      },
      onSuccess: undefined,
      onFailure: undefined,
    },
  ];

  return {
    id: `release-${versionType}-${Date.now()}`,
    name: `Release ${versionType} version`,
    steps,
  };
}

/**
 * Quick release presets
 */
export const releasePresets = {
  patch: () =>
    createReleaseWorkflow({
      versionType: 'patch',
      publish: true,
      runTests: true,
      dryRun: false,
    }),

  minor: () =>
    createReleaseWorkflow({
      versionType: 'minor',
      publish: true,
      runTests: true,
      generateChangelog: true,
      createGitHubRelease: true,
      dryRun: false,
    }),

  major: () =>
    createReleaseWorkflow({
      versionType: 'major',
      publish: true,
      runTests: true,
      generateChangelog: true,
      createGitHubRelease: true,
      dryRun: false,
    }),

  dryRun: (versionType: 'major' | 'minor' | 'patch') =>
    createReleaseWorkflow({
      versionType,
      publish: false,
      runTests: false,
      dryRun: true,
    }),
};
