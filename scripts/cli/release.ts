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
 *   pro               Publish Pro packages to npm
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
 *   pnpm release pro                     # publish Pro packages to npm
 *   pnpm release pro --dry-run           # dry-run Pro publish
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

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ParsedArgs } from '@revealui/scripts/args.js';
import { ErrorCode } from '@revealui/scripts/errors.js';
import { execCommand } from '@revealui/scripts/index.js';
import { fail, ok } from '@revealui/scripts/output.js';
import { type CommandDefinition, ExecutingCLI } from './_base.js';

class ReleaseCLI extends ExecutingCLI {
  name = 'release';
  description = 'Version management and publishing';
  protected enableExecutionLogging = true;

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
    ];
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
        description: 'Publish Pro packages to npm (source-available)',
        confirmPrompt: 'This will publish Pro packages to npm. Continue?',
        handler: async (args) => this.releasePro(args),
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
        description: 'Generate changelog from git commits since the last tag',
        args: [
          {
            name: 'output',
            type: 'string' as const,
            description: 'Output file path (default: CHANGELOG.md)',
            default: 'CHANGELOG.md',
          },
          {
            name: 'since',
            type: 'string' as const,
            description: 'Git ref (tag, commit) to start from (default: last tag)',
          },
        ],
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
    ];
  }

  /**
   * Show changeset status  -  what would be released on next publish.
   * Replaces: pnpm changeset status (surfaced as a release subcommand)
   */
  private async showStatus(_args: ParsedArgs) {
    const result = await execCommand('pnpm', ['changeset', 'status', '--verbose'], {
      cwd: this.projectRoot,
    });

    if (!result.success) {
      return fail('No changesets found or changeset status failed', ErrorCode.EXECUTION_ERROR);
    }

    return ok({ message: 'Changeset status shown above' });
  }

  /**
   * Full OSS release flow  -  replaces GitHub Actions release.yml + changesets/action.
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
    const isDryRun = Boolean(args['dry-run']);

    if (isDryRun) {
      console.log('\n[dry-run] OSS release  -  steps 4–6 will be skipped\n');
    }

    // Step 1: Confirm pending changesets
    console.log('\nStep 1: Checking for pending changesets...');
    const statusResult = await execCommand('pnpm', ['changeset', 'status'], {
      cwd: this.projectRoot,
      capture: true,
    });
    if (!statusResult.success) {
      return fail(
        'No pending changesets found. Run "pnpm changeset" to create one.',
        ErrorCode.VALIDATION_ERROR,
      );
    }

    // Step 2: Apply version bumps + regenerate lockfile
    console.log('\nStep 2: Applying version bumps (pnpm changeset:version)...');
    const versionResult = await execCommand('pnpm', ['changeset:version'], {
      cwd: this.projectRoot,
    });
    if (!versionResult.success) {
      return fail('changeset version failed', ErrorCode.EXECUTION_ERROR);
    }

    // Step 3: Build all packages (concurrency capped to prevent OOM)
    console.log('\nStep 3: Building all packages...');
    const buildResult = await execCommand('pnpm', ['build', '--concurrency=4'], {
      cwd: this.projectRoot,
      env: { SKIP_ENV_VALIDATION: 'true' },
      timeout: 900000,
    });
    if (!buildResult.success) {
      return fail('Build failed  -  fix errors before publishing', ErrorCode.EXECUTION_ERROR);
    }

    if (isDryRun) {
      console.log('\n[dry-run] Skipping publish, GitHub releases, and git push.');
      return ok({ message: 'Dry run complete  -  no packages published', dryRun: true });
    }

    // Step 4: Publish to npm, capture published packages from output
    console.log('\nStep 4: Publishing to npm (pnpm changeset publish)...');
    const publishResult = await execCommand('pnpm', ['changeset', 'publish'], {
      cwd: this.projectRoot,
      capture: true,
    });
    if (!publishResult.success) {
      return fail('Publish failed', ErrorCode.EXECUTION_ERROR);
    }

    // Parse published packages from changeset output
    // changeset publish prints: "New tag: @scope/pkg@version"
    const publishedTags: string[] = [];
    for (const line of (publishResult.stdout ?? '').split('\n')) {
      const match = /New tag:\s+(.+)/.exec(line.trim());
      if (match?.[1]) {
        publishedTags.push(match[1].trim());
      }
    }

    // Step 5: Create GitHub releases for each published package
    if (publishedTags.length > 0) {
      console.log(`\nStep 5: Creating GitHub releases for ${publishedTags.length} package(s)...`);
      for (const tag of publishedTags) {
        console.log(`  Creating release: ${tag}`);
        const releaseResult = await execCommand(
          'gh',
          ['release', 'create', tag, '--title', tag, '--generate-notes', '--latest=false'],
          { cwd: this.projectRoot },
        );
        if (!releaseResult.success) {
          console.warn(`  Warning: Could not create GitHub release for ${tag}`);
        }
      }
    } else {
      console.log('\nStep 5: No packages published (nothing to release on GitHub)');
    }

    // Step 6: Push tags
    if (!args.noPush) {
      console.log('\nStep 6: Pushing tags to remote...');
      await execCommand('git', ['push', '--follow-tags'], { cwd: this.projectRoot });
    }

    return ok({
      message: `OSS release complete. Published ${publishedTags.length} package(s).`,
      published: publishedTags,
    });
  }

  /**
   * Publish Pro packages to npmjs.org (public, open-core model).
   *
   * Pro packages are source-available and publicly installable.
   * A license key is required for production use  -  enforced at runtime.
   *
   * Prerequisites:
   *   1. Remove "private": true from the 5 Pro package.json files
   *   2. Be logged in to npm (`npm whoami`) or set NPM_TOKEN env var
   *
   * Use --dry-run to preview without publishing.
   */
  private async releasePro(args: ParsedArgs) {
    const isDryRun = Boolean(args['dry-run']);
    const ProPackages = ['ai', 'harnesses'];
    const { readFile } = await import('node:fs/promises');
    const { join } = await import('node:path');

    if (isDryRun) {
      console.log('\n[dry-run] Pro release  -  publish commands will include --dry-run\n');
    }

    // Prerequisite check: verify "private": true has been removed
    console.log('\nChecking Pro package prerequisites...');
    const stillPrivate: string[] = [];
    for (const pkg of ProPackages) {
      try {
        const pkgJsonPath = join(this.projectRoot, 'packages', pkg, 'package.json');
        const raw = await readFile(pkgJsonPath, 'utf8');
        const parsed = JSON.parse(raw) as { private?: boolean };
        if (parsed.private === true) {
          stillPrivate.push(`@revealui/${pkg}`);
        }
      } catch {
        // Package might not exist yet
      }
    }

    if (stillPrivate.length > 0) {
      return fail(
        `The following Pro packages still have "private": true and cannot be published:\n${stillPrivate.map((p) => `  - ${p}`).join('\n')}\n\nRemove "private": true from each package.json before running Pro release.`,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    // Build each Pro package
    console.log('\nBuilding Pro packages...');
    for (const pkg of ProPackages) {
      console.log(`  Building @revealui/${pkg}...`);
      const buildResult = await execCommand('pnpm', ['--filter', `@revealui/${pkg}`, 'build'], {
        cwd: this.projectRoot,
        env: { SKIP_ENV_VALIDATION: 'true' },
        timeout: 300000,
      });
      if (!buildResult.success) {
        return fail(`Build failed for @revealui/${pkg}`, ErrorCode.EXECUTION_ERROR);
      }
    }

    // Publish each Pro package to npmjs.org
    // publishConfig.access=public in each package.json handles open-core visibility.
    // Runtime license enforcement (requireFeature) gates actual usage.
    console.log('\nPublishing Pro packages to npm...');
    const publishArgs = isDryRun ? ['--no-git-checks', '--dry-run'] : ['--no-git-checks'];

    for (const pkg of ProPackages) {
      console.log(`  ${isDryRun ? '[dry-run] ' : ''}Publishing @revealui/${pkg}...`);
      const env: Record<string, string> = { SKIP_ENV_VALIDATION: 'true' };
      if (process.env.NPM_TOKEN) env.NPM_TOKEN = process.env.NPM_TOKEN;
      const publishResult = await execCommand(
        'pnpm',
        ['--filter', `@revealui/${pkg}`, 'publish', ...publishArgs],
        { cwd: this.projectRoot, env },
      );
      if (!(publishResult.success || isDryRun)) {
        return fail(`Publish failed for @revealui/${pkg}`, ErrorCode.EXECUTION_ERROR);
      }
    }

    return ok({
      message: isDryRun
        ? 'Pro dry-run complete  -  no packages published'
        : 'Pro packages published to npm (open-core, runtime-licensed)',
      packages: ProPackages.map((p) => `@revealui/${p}`),
      dryRun: isDryRun,
    });
  }

  /**
   * Bump version using changesets
   */
  private async bumpVersion(_args: ParsedArgs) {
    // Changesets determine bump types from changeset files, not CLI args.
    // Use `pnpm changeset:version` which also regenerates lockfile + stages it.
    const result = await execCommand('pnpm', ['changeset:version'], {
      cwd: this.projectRoot,
    });

    if (!result.success) {
      return fail('Version bump failed', ErrorCode.EXECUTION_ERROR);
    }

    return ok({ message: 'Versions bumped from changesets' });
  }

  /**
   * Preview release changes
   */
  private async previewRelease(_args: ParsedArgs) {
    // Check what would be published
    const statusResult = await execCommand('pnpm', ['changeset', 'status'], {
      cwd: this.projectRoot,
    });

    if (!statusResult.success) {
      return fail('Failed to get release preview', ErrorCode.EXECUTION_ERROR);
    }

    return ok({ message: 'Release preview complete' });
  }

  /**
   * Generate changelog
   */
  private async generateChangelog(args: ParsedArgs) {
    const outputFile = args.output ? String(args.output) : 'CHANGELOG.md';
    const since = args.since ? String(args.since) : undefined;

    // Get the most recent git tag as the base, or use --since override
    let fromRef = since;
    if (!fromRef) {
      const tagResult = await execCommand('git', ['describe', '--tags', '--abbrev=0'], {
        cwd: this.projectRoot,
      });
      fromRef = tagResult.success ? (tagResult.stdout ?? '').trim() : undefined;
    }

    const logArgs = ['log', '--pretty=format:%H|%s|%an|%ad', '--date=short', '--no-merges'];
    if (fromRef) logArgs.push(`${fromRef}..HEAD`);

    const logResult = await execCommand('git', logArgs, { cwd: this.projectRoot });
    if (!logResult.success) {
      return fail('Failed to read git log', ErrorCode.EXECUTION_ERROR);
    }

    const lines = (logResult.stdout ?? '').trim().split('\n').filter(Boolean);

    // Parse conventional commits into sections
    const sections: Record<string, string[]> = {
      feat: [],
      fix: [],
      perf: [],
      refactor: [],
      docs: [],
      test: [],
      chore: [],
      other: [],
    };
    const labelMap: Record<string, string> = {
      feat: 'Features',
      fix: 'Bug Fixes',
      perf: 'Performance',
      refactor: 'Refactoring',
      docs: 'Documentation',
      test: 'Tests',
      chore: 'Chores',
      other: 'Other Changes',
    };

    for (const line of lines) {
      const [hash, subject] = line.split('|');
      if (!subject) continue;
      const match = subject.match(/^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/);
      if (match) {
        const [, type, scope, breaking, desc] = match;
        const entry = scope
          ? `- **${scope}**: ${desc}${breaking ? ' (**BREAKING**)' : ''} (${hash?.slice(0, 8)})`
          : `- ${desc}${breaking ? ' (**BREAKING**)' : ''} (${hash?.slice(0, 8)})`;
        const bucket = sections[type ?? ''] !== undefined ? (type ?? 'other') : 'other';
        sections[bucket]?.push(entry);
      } else {
        sections.other?.push(`- ${subject} (${hash?.slice(0, 8)})`);
      }
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    const header = fromRef
      ? `## Changes since ${fromRef} (${dateStr})\n`
      : `## Changelog (${dateStr})\n`;

    const body = Object.entries(sections)
      .filter(([, entries]) => entries.length > 0)
      .map(([type, entries]) => `### ${labelMap[type]}\n\n${entries.join('\n')}`)
      .join('\n\n');

    const content = `${header}\n${body || '_No changes_'}\n`;

    const outPath = resolve(this.projectRoot, outputFile);
    writeFileSync(outPath, content, 'utf-8');

    return ok({
      message: `Changelog written to ${outputFile}`,
      output: outPath,
      commits: lines.length,
      since: fromRef ?? 'beginning',
    });
  }

  /**
   * Publish packages to npm
   */
  private async publishPackages(args: ParsedArgs) {
    const tag = args.tag ? String(args.tag) : 'latest';

    // Use changesets to publish
    const cmdArgs = ['changeset', 'publish'];
    if (tag !== 'latest') {
      cmdArgs.push('--tag', tag);
    }

    const result = await execCommand('pnpm', cmdArgs, {
      cwd: this.projectRoot,
    });

    if (!result.success) {
      return fail('Publishing failed', ErrorCode.EXECUTION_ERROR);
    }

    // Push tags unless --no-push specified
    if (!args.noPush) {
      await execCommand('git', ['push', '--follow-tags'], {
        cwd: this.projectRoot,
      });
    }

    return ok({
      message: 'Packages published successfully',
      tag,
    });
  }

  /**
   * Create git release tag
   */
  private async createTag(args: ParsedArgs) {
    const version = args.version as string;

    if (!version) {
      return fail('Version tag required', ErrorCode.VALIDATION_ERROR);
    }

    // Validate version format (v1.2.3)
    if (!/^v?\d+\.\d+\.\d+/.test(version)) {
      return fail('Invalid version format. Use v1.2.3 or 1.2.3', ErrorCode.VALIDATION_ERROR);
    }

    const tagName = version.startsWith('v') ? version : `v${version}`;

    // Create annotated tag
    const result = await execCommand('git', ['tag', '-a', tagName, '-m', `Release ${tagName}`], {
      cwd: this.projectRoot,
    });

    if (!result.success) {
      return fail('Failed to create tag', ErrorCode.EXECUTION_ERROR);
    }

    // Push tag unless --no-push specified
    if (!args.noPush) {
      await execCommand('git', ['push', 'origin', tagName], {
        cwd: this.projectRoot,
      });
    }

    return ok({
      message: `Tag ${tagName} created`,
      tag: tagName,
    });
  }

  /**
   * Dry run - simulate release without publishing
   */
  private async dryRun(args: ParsedArgs) {
    // Run preview
    await this.previewRelease(args);

    // Show what would be published
    const result = await execCommand('pnpm', ['changeset', 'status', '--verbose'], {
      cwd: this.projectRoot,
    });

    if (!result.success) {
      return fail('Dry run failed', ErrorCode.EXECUTION_ERROR);
    }

    return ok({
      message: 'Dry run complete - no changes made',
      note: 'Use "release publish" to actually publish packages',
    });
  }
}

// =============================================================================
// CLI Entry Point
// =============================================================================

const cli = new ReleaseCLI();
await cli.run();
