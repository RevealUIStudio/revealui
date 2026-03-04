#!/usr/bin/env tsx

/**
 * Release CLI
 *
 * Unified CLI for version management and package publishing.
 * Handles versioning, changelog generation, and npm publishing for the monorepo.
 * Replaces GitHub Actions release.yml and release-pro.yml workflows.
 *
 * Commands:
 *   status            Show changeset status (pending versions)
 *   oss               Full OSS release: version → build → publish → GitHub releases
 *   pro               Publish Pro packages to GitHub Packages
 *   supabase-types    Regenerate Supabase types and optionally open a PR
 *   version           Bump version (major|minor|patch)
 *   preview           Preview release changes
 *   changelog         Generate changelog
 *   publish           Publish packages to npm
 *   tag               Create git release tag
 *   dry-run           Simulate a release without publishing
 *
 * Usage:
 *   pnpm release status
 *   pnpm release oss                     # full OSS release
 *   pnpm release oss --dry-run           # preview only
 *   pnpm release pro                     # publish Pro packages to GitHub Packages
 *   pnpm release pro --dry-run           # dry-run Pro publish
 *   pnpm release supabase-types          # regenerate and optionally PR
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
 * - External: gh  - GitHub CLI (for release creation and PR)
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
      {
        name: 'dry-run',
        type: 'boolean' as const,
        description: 'Simulate release without publishing',
        default: false,
      },
    ]
  }

  defineCommands(): CommandDefinition[] {
    return [
      {
        name: 'status',
        description: 'Show pending changeset versions',
        handler: async (args) => this.showStatus(args),
      },
      {
        name: 'oss',
        description: 'Full OSS release: changeset version → build → publish → GitHub releases',
        confirmPrompt:
          'This will version, build, publish OSS packages, and create GitHub releases. Continue?',
        handler: async (args) => this.releaseOss(args),
      },
      {
        name: 'pro',
        description: 'Publish Pro packages to GitHub Packages registry',
        confirmPrompt: 'This will publish Pro packages to GitHub Packages. Continue?',
        handler: async (args) => this.releasePro(args),
      },
      {
        name: 'supabase-types',
        description: 'Regenerate Supabase types and optionally open a PR',
        handler: async (args) => this.regenerateSupabaseTypes(args),
      },
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
   * Show changeset status — what would be released on next publish.
   * Replaces: pnpm changeset status (surfaced as a release subcommand)
   */
  private async showStatus(_args: ParsedArgs) {
    const result = await execCommand('pnpm', ['changeset', 'status', '--verbose'], {
      cwd: this.projectRoot,
    })

    if (!result.success) {
      return fail('No changesets found or changeset status failed', ErrorCode.EXECUTION_ERROR)
    }

    return ok({ message: 'Changeset status shown above' })
  }

  /**
   * Full OSS release flow — replaces GitHub Actions release.yml + changesets/action.
   *
   * Steps:
   *   1. Confirm changesets exist
   *   2. pnpm changeset version  (applies version bumps, updates CHANGELOG)
   *   3. pnpm build              (SKIP_ENV_VALIDATION=true)
   *   4. pnpm changeset publish  (publishes to npm, captures new tags)
   *   5. gh release create       (one per published package)
   *   6. git push --follow-tags
   *
   * Use --dry-run to skip steps 4–6.
   */
  private async releaseOss(args: ParsedArgs) {
    const isDryRun = Boolean(args['dry-run'])

    if (isDryRun) {
      console.log('\n[dry-run] OSS release — steps 4–6 will be skipped\n')
    }

    // Step 1: Confirm pending changesets
    console.log('\nStep 1: Checking for pending changesets...')
    const statusResult = await execCommand('pnpm', ['changeset', 'status'], {
      cwd: this.projectRoot,
      capture: true,
    })
    if (!statusResult.success) {
      return fail(
        'No pending changesets found. Run "pnpm changeset" to create one.',
        ErrorCode.VALIDATION_ERROR,
      )
    }

    // Step 2: Apply version bumps
    console.log('\nStep 2: Applying version bumps (pnpm changeset version)...')
    const versionResult = await execCommand('pnpm', ['changeset', 'version'], {
      cwd: this.projectRoot,
    })
    if (!versionResult.success) {
      return fail('changeset version failed', ErrorCode.EXECUTION_ERROR)
    }

    // Step 3: Build all packages
    console.log('\nStep 3: Building all packages...')
    const buildResult = await execCommand('pnpm', ['build'], {
      cwd: this.projectRoot,
      env: { SKIP_ENV_VALIDATION: 'true' },
      timeout: 900000,
    })
    if (!buildResult.success) {
      return fail('Build failed — fix errors before publishing', ErrorCode.EXECUTION_ERROR)
    }

    if (isDryRun) {
      console.log('\n[dry-run] Skipping publish, GitHub releases, and git push.')
      return ok({ message: 'Dry run complete — no packages published', dryRun: true })
    }

    // Step 4: Publish to npm, capture published packages from output
    console.log('\nStep 4: Publishing to npm (pnpm changeset publish)...')
    const publishResult = await execCommand('pnpm', ['changeset', 'publish'], {
      cwd: this.projectRoot,
      capture: true,
    })
    if (!publishResult.success) {
      return fail('Publish failed', ErrorCode.EXECUTION_ERROR)
    }

    // Parse published packages from changeset output
    // changeset publish prints: "New tag: @scope/pkg@version"
    const publishedTags: string[] = []
    for (const line of (publishResult.stdout ?? '').split('\n')) {
      const match = /New tag:\s+(.+)/.exec(line.trim())
      if (match?.[1]) {
        publishedTags.push(match[1].trim())
      }
    }

    // Step 5: Create GitHub releases for each published package
    if (publishedTags.length > 0) {
      console.log(`\nStep 5: Creating GitHub releases for ${publishedTags.length} package(s)...`)
      for (const tag of publishedTags) {
        console.log(`  Creating release: ${tag}`)
        const releaseResult = await execCommand(
          'gh',
          ['release', 'create', tag, '--title', tag, '--generate-notes', '--latest=false'],
          { cwd: this.projectRoot },
        )
        if (!releaseResult.success) {
          console.warn(`  Warning: Could not create GitHub release for ${tag}`)
        }
      }
    } else {
      console.log('\nStep 5: No packages published (nothing to release on GitHub)')
    }

    // Step 6: Push tags
    if (!args.noPush) {
      console.log('\nStep 6: Pushing tags to remote...')
      await execCommand('git', ['push', '--follow-tags'], { cwd: this.projectRoot })
    }

    return ok({
      message: `OSS release complete. Published ${publishedTags.length} package(s).`,
      published: publishedTags,
    })
  }

  /**
   * Publish Pro packages to GitHub Packages — replaces release-pro.yml.
   *
   * Prerequisites:
   *   1. Remove "private": true from the 5 Pro package.json files
   *   2. Set NODE_AUTH_TOKEN to a PAT with write:packages scope
   *
   * Use --dry-run to preview without publishing.
   */
  private async releasePro(args: ParsedArgs) {
    const isDryRun = Boolean(args['dry-run'])
    const ProPackages = ['ai', 'mcp', 'editors', 'services', 'harnesses']
    const { readFile } = await import('node:fs/promises')
    const { join } = await import('node:path')

    if (isDryRun) {
      console.log('\n[dry-run] Pro release — publish commands will include --dry-run\n')
    }

    // Check NODE_AUTH_TOKEN
    if (!(isDryRun || process.env.NODE_AUTH_TOKEN)) {
      return fail(
        'NODE_AUTH_TOKEN is required for Pro package publishing.\nSet it to a GitHub PAT with write:packages scope.',
        ErrorCode.CONFIG_ERROR,
      )
    }

    // Prerequisite check: verify "private": true has been removed
    console.log('\nChecking Pro package prerequisites...')
    const stillPrivate: string[] = []
    for (const pkg of ProPackages) {
      try {
        const pkgJsonPath = join(this.projectRoot, 'packages', pkg, 'package.json')
        const raw = await readFile(pkgJsonPath, 'utf8')
        const parsed = JSON.parse(raw) as { private?: boolean }
        if (parsed.private === true) {
          stillPrivate.push(`@revealui/${pkg}`)
        }
      } catch {
        // Package might not exist yet
      }
    }

    if (stillPrivate.length > 0) {
      return fail(
        `The following Pro packages still have "private": true and cannot be published:\n${stillPrivate.map((p) => `  - ${p}`).join('\n')}\n\nRemove "private": true from each package.json before running Pro release.`,
        ErrorCode.VALIDATION_ERROR,
      )
    }

    // Build each Pro package
    console.log('\nBuilding Pro packages...')
    for (const pkg of ProPackages) {
      console.log(`  Building @revealui/${pkg}...`)
      const buildResult = await execCommand('pnpm', ['--filter', `@revealui/${pkg}`, 'build'], {
        cwd: this.projectRoot,
        env: { SKIP_ENV_VALIDATION: 'true' },
        timeout: 300000,
      })
      if (!buildResult.success) {
        return fail(`Build failed for @revealui/${pkg}`, ErrorCode.EXECUTION_ERROR)
      }
    }

    // Publish each Pro package to GitHub Packages
    console.log('\nPublishing Pro packages to GitHub Packages...')
    const publishArgs = isDryRun ? ['--no-git-checks', '--dry-run'] : ['--no-git-checks']

    for (const pkg of ProPackages) {
      console.log(`  ${isDryRun ? '[dry-run] ' : ''}Publishing @revealui/${pkg}...`)
      const publishResult = await execCommand(
        'pnpm',
        ['--filter', `@revealui/${pkg}`, 'publish', ...publishArgs],
        {
          cwd: this.projectRoot,
          env: { NODE_AUTH_TOKEN: process.env.NODE_AUTH_TOKEN ?? '' },
        },
      )
      if (!(publishResult.success || isDryRun)) {
        return fail(`Publish failed for @revealui/${pkg}`, ErrorCode.EXECUTION_ERROR)
      }
    }

    return ok({
      message: isDryRun
        ? 'Pro dry-run complete — no packages published'
        : `Pro packages published to GitHub Packages`,
      packages: ProPackages.map((p) => `@revealui/${p}`),
      dryRun: isDryRun,
    })
  }

  /**
   * Regenerate Supabase types and optionally create a PR.
   * Replaces the manual dispatch regenerate-types.yml workflow.
   *
   * Requires:
   *   SUPABASE_ACCESS_TOKEN — Supabase personal access token
   *   SUPABASE_PROJECT_ID   — Supabase project ID
   */
  private async regenerateSupabaseTypes(_args: ParsedArgs) {
    if (!(process.env.SUPABASE_ACCESS_TOKEN && process.env.SUPABASE_PROJECT_ID)) {
      return fail(
        'SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_ID are required.\nThese should be available via direnv / revvault.',
        ErrorCode.CONFIG_ERROR,
      )
    }

    console.log('\nRegenerating Supabase types...')
    const genResult = await execCommand('pnpm', ['generate:supabase-types'], {
      cwd: this.projectRoot,
      timeout: 120000,
    })

    if (!genResult.success) {
      return fail('Supabase type generation failed', ErrorCode.EXECUTION_ERROR)
    }

    // Check if any files changed
    const statusResult = await execCommand('git', ['status', '--porcelain'], {
      cwd: this.projectRoot,
      capture: true,
    })
    const dirty = (statusResult.stdout ?? '').trim()

    if (!dirty) {
      return ok({ message: 'Supabase types are already up to date — no changes' })
    }

    console.log('\nChanged files:')
    for (const line of dirty.split('\n')) {
      console.log(`  ${line}`)
    }

    // Offer to create a PR via gh CLI
    console.log('\nWould you like to commit and create a PR? (gh CLI required)')
    console.log('Run manually:')
    console.log('  git checkout -b automated/regenerate-types')
    console.log(
      '  git add packages/services/src/supabase/types.ts packages/services/src/generated/types/supabase.ts',
    )
    console.log('  git commit -m "chore: regenerate Supabase types"')
    console.log('  gh pr create --title "Regenerate Supabase Types" \\')
    console.log('    --body "Auto-regenerated Supabase TypeScript types" \\')
    console.log('    --branch automated/regenerate-types')

    return ok({
      message: 'Supabase types regenerated — see instructions above to create a PR',
      changedFiles: dirty.split('\n').filter(Boolean),
    })
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
