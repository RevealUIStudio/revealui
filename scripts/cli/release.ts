#!/usr/bin/env tsx

/**
 * Release planning and version management.
 * OSS publication is owned by release.yml on main, using OIDC and the
 * npm-publish environment. This CLI never publishes, tags, pushes or dispatches.
 * Pro publication has no canonical workflow in this repository (GAP-501).
 */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ParsedArgs } from '@revealui/scripts/args.js';
import { execCommand } from '@revealui/scripts/exec.js';
import { fail, ok } from '@revealui/scripts/output.js';
import { type CommandDefinition, ExecutingCLI } from './_base.js';

const OSS_RELEASE_GUIDANCE =
  'OSS publishing and release tags are owned by GitHub Actions release.yml on main with OIDC, environment npm-publish. After reviewed changesets are applied and promoted to main, the owner runs Actions > Release OSS Packages.';
const PRO_RELEASE_GUIDANCE =
  'Pro publishing is unavailable: release.yml currently publishes OSS packages only. GAP-501 tracks the missing canonical Pro OIDC publication contract; local publishing is refused.';

export class ReleaseCLI extends ExecutingCLI {
  name = 'release';
  description =
    'Plan releases and apply changeset versions; publication uses the canonical OIDC workflow';
  protected enableExecutionLogging = true;

  defineCommands(): CommandDefinition[] {
    return [
      {
        name: 'status',
        description: 'Show pending changeset versions',
        handler: () => this.showStatus(),
      },
      {
        name: 'preview',
        description: 'Preview pending changeset versions',
        handler: () => this.showStatus(),
      },
      {
        name: 'version',
        description: 'Apply pending changeset versions locally',
        handler: () => this.bumpVersion(),
        confirmPrompt:
          'This will apply changeset versions, update the lockfile and stage changes. Continue?',
      },
      ...['oss', 'publish', 'tag'].map((name) => ({
        name,
        description: OSS_RELEASE_GUIDANCE,
        handler: async () => fail('PERMISSION_DENIED', OSS_RELEASE_GUIDANCE),
      })),
      {
        name: 'pro',
        description: PRO_RELEASE_GUIDANCE,
        handler: async () => fail('PERMISSION_DENIED', PRO_RELEASE_GUIDANCE),
      },
      {
        name: 'dry-run',
        description: OSS_RELEASE_GUIDANCE,
        executionMode: 'simulate',
        handler: async (args: ParsedArgs) => ok({ status: 'simulated', command: args.command }),
      },
    ];
  }

  private async showStatus() {
    const result = await execCommand('pnpm', ['changeset', 'status', '--verbose'], {
      cwd: this.projectRoot,
    });
    return result.success
      ? ok({ message: 'Changeset status shown above' })
      : fail('EXECUTION_ERROR', 'Failed to read changeset status');
  }

  private async bumpVersion() {
    const result = await execCommand('pnpm', ['changeset:version'], { cwd: this.projectRoot });
    return result.success
      ? ok({ message: 'Versions applied from changesets' })
      : fail('EXECUTION_ERROR', 'Failed to apply changeset versions');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await new ReleaseCLI().run();
}
