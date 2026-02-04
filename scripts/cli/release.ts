#!/usr/bin/env tsx

/**
 * Release CLI
 *
 * Unified CLI for version management and package publishing.
 * Handles versioning, changelog generation, and npm publishing for the monorepo.
 *
 * Commands:
 *   version           Bump version (major|minor|patch)
 *   preview           Preview release changes
 *   changelog         Generate changelog
 *   publish           Publish packages to npm
 *   tag               Create git release tag
 *   dry-run           Simulate a release without publishing
 *
 * Usage:
 *   pnpm release version minor
 *   pnpm release preview
 *   pnpm release changelog --output CHANGELOG.md
 *   pnpm release publish --tag beta
 *   pnpm release tag v1.2.3
 *
 * @dependencies
 * - scripts/cli/_base.ts - ExecutingCLI base class with execution logging
 * - scripts/lib/args.ts - CLI argument type definitions
 * - scripts/lib/errors.ts - Error handling with ErrorCode
 * - scripts/lib/index.ts - Command execution utilities
 * - scripts/lib/output.ts - Output formatting helpers
 *
 * @requires
 * - External: git - Version control operations
 * - External: npm - Package publishing
 */

import type { ParsedArgs } from '../lib/args.js'
import { ErrorCode } from '../lib/errors.js'
import { execCommand } from '../lib/index.js'
import { fail, ok } from '../lib/output.js'
import { type CommandDefinition, ExecutingCLI } from './_base.js'

class ReleaseCLI extends ExecutingCLI {
  name = 'release'
  description = 'Version management and publishing'
  protected enableExecutionLogging = true

  defineGlobalArgs() {
    return [
      {
        name: 'tag',
        type: 'string' as const,
        description: 'NPM tag for publishing (latest, beta, next, etc.)',
        default: 'latest',
      },
      {
        name: 'output',
        short: 'o',
        type: 'string' as const,
        description: 'Output file path',
      },
      {
        name: 'no-push',
        type: 'boolean' as const,
        description: 'Skip pushing to git remote',
        default: false,
      },
    ]
  }

  defineCommands(): CommandDefinition[] {
    return [
      {
        name: 'version',
        description: 'Bump version (major|minor|patch)',
        args: [
          {
            name: 'type',
            type: 'string',
            description: 'Version bump type: major, minor, or patch',
            required: true,
          },
        ],
        handler: async (args) => this.bumpVersion(args),
      },
      {
        name: 'preview',
        description: 'Preview release changes without making any modifications',
        handler: async (args) => this.previewRelease(args),
      },
      {
        name: 'changelog',
        description: 'Generate changelog from git commits',
        handler: async (args) => this.generateChangelog(args),
      },
      {
        name: 'publish',
        description: 'Publish packages to npm registry',
        confirmPrompt: 'This will publish packages to npm. Are you sure?',
        handler: async (args) => this.publishPackages(args),
      },
      {
        name: 'tag',
        description: 'Create git release tag',
        args: [
          {
            name: 'version',
            type: 'string',
            description: 'Version tag (e.g., v1.2.3)',
            required: true,
          },
        ],
        handler: async (args) => this.createTag(args),
      },
      {
        name: 'dry-run',
        description: 'Simulate a complete release without publishing',
        handler: async (args) => this.dryRun(args),
      },
    ]
  }

  /**
   * Bump version using changesets
   */
  private async bumpVersion(args: ParsedArgs) {
    const versionType = args.type as string

    if (!['major', 'minor', 'patch'].includes(versionType)) {
      return fail('Version type must be major, minor, or patch', ErrorCode.VALIDATION_ERROR)
    }

    // Use changesets for version bumping
    const result = await execCommand('pnpm', ['changeset', 'version'], {
      cwd: this.projectRoot,
    })

    if (!result.success) {
      return fail('Version bump failed', ErrorCode.EXECUTION_ERROR)
    }

    return ok({
      message: `Version bumped to ${versionType}`,
      type: versionType,
    })
  }

  /**
   * Preview release changes
   */
  private async previewRelease(_args: ParsedArgs) {
    // Check what would be published
    const statusResult = await execCommand('pnpm', ['changeset', 'status'], {
      cwd: this.projectRoot,
    })

    if (!statusResult.success) {
      return fail('Failed to get release preview', ErrorCode.EXECUTION_ERROR)
    }

    return ok({ message: 'Release preview complete' })
  }

  /**
   * Generate changelog
   */
  private async generateChangelog(args: ParsedArgs) {
    const outputFile = args.output ? String(args.output) : 'CHANGELOG.md'

    // TODO: Implement changelog generation
    // This could use conventional-changelog, git log parsing, or changeset

    return ok({
      message: `Changelog would be generated to ${outputFile}`,
      output: outputFile,
      note: 'Changelog generation not yet implemented - use changeset CLI directly',
    })
  }

  /**
   * Publish packages to npm
   */
  private async publishPackages(args: ParsedArgs) {
    const tag = args.tag ? String(args.tag) : 'latest'

    // Use changesets to publish
    const cmdArgs = ['changeset', 'publish']
    if (tag !== 'latest') {
      cmdArgs.push('--tag', tag)
    }

    const result = await execCommand('pnpm', cmdArgs, {
      cwd: this.projectRoot,
    })

    if (!result.success) {
      return fail('Publishing failed', ErrorCode.EXECUTION_ERROR)
    }

    // Push tags unless --no-push specified
    if (!args.noPush) {
      await execCommand('git', ['push', '--follow-tags'], {
        cwd: this.projectRoot,
      })
    }

    return ok({
      message: 'Packages published successfully',
      tag,
    })
  }

  /**
   * Create git release tag
   */
  private async createTag(args: ParsedArgs) {
    const version = args.version as string

    if (!version) {
      return fail('Version tag required', ErrorCode.VALIDATION_ERROR)
    }

    // Validate version format (v1.2.3)
    if (!/^v?\d+\.\d+\.\d+/.test(version)) {
      return fail('Invalid version format. Use v1.2.3 or 1.2.3', ErrorCode.VALIDATION_ERROR)
    }

    const tagName = version.startsWith('v') ? version : `v${version}`

    // Create annotated tag
    const result = await execCommand('git', ['tag', '-a', tagName, '-m', `Release ${tagName}`], {
      cwd: this.projectRoot,
    })

    if (!result.success) {
      return fail('Failed to create tag', ErrorCode.EXECUTION_ERROR)
    }

    // Push tag unless --no-push specified
    if (!args.noPush) {
      await execCommand('git', ['push', 'origin', tagName], {
        cwd: this.projectRoot,
      })
    }

    return ok({
      message: `Tag ${tagName} created`,
      tag: tagName,
    })
  }

  /**
   * Dry run - simulate release without publishing
   */
  private async dryRun(args: ParsedArgs) {
    // Run preview
    await this.previewRelease(args)

    // Show what would be published
    const result = await execCommand('pnpm', ['changeset', 'status', '--verbose'], {
      cwd: this.projectRoot,
    })

    if (!result.success) {
      return fail('Dry run failed', ErrorCode.EXECUTION_ERROR)
    }

    return ok({
      message: 'Dry run complete - no changes made',
      note: 'Use "release publish" to actually publish packages',
    })
  }
}

// =============================================================================
// CLI Entry Point
// =============================================================================

const cli = new ReleaseCLI()
await cli.run()
