#!/usr/bin/env tsx

/**
 * Operations CLI
 *
 * Consolidated CLI for operations and maintenance tasks.
 *
 * Commands:
 *   fix-imports       Fix missing .js extensions in imports
 *   fix-lint          Fix common linting errors
 *   fix-types         Fix TypeScript errors
 *   fix-validation    Fix validation issues
 *   fix-test          Fix test errors
 *   audit-scripts     Audit package.json scripts for issues
 *   validate-scripts  Validate package scripts against templates
 *   fix-scripts       Auto-fix package scripts
 *   clean             Clean generated files and caches
 *   migrate:plan      Generate migration plan between versions
 *   migrate:execute   Execute migration plan
 *   migrate:compare   Compare two versions
 *   db:reset          Reset database
 *   rollback          Rollback to previous state
 *
 * Usage:
 *   pnpm ops <command> [options]
 *   pnpm ops fix-imports --dry-run
 *   pnpm ops migrate:plan --script=auth --from=1.0 --to=2.0
 *
 * @dependencies
 * - scripts/cli/_base.ts - Base CLI classes (DispatcherCLI, runCLI)
 * - scripts/lib/args.ts - Argument parsing types (ParsedArgs)
 * - scripts/commands/fix/* - Fix command implementations
 * - scripts/commands/maintain/* - Maintenance command implementations
 * - scripts/commands/ops/* - Rollback commands
 *
 * @requires
 * - Scripts: Individual command scripts in commandMap (dispatched at runtime)
 */

import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ParsedArgs } from '@revealui/scripts/args.js';
import { type CommandDefinition, DispatcherCLI, runCLI } from './_base.js';

class OpsCLI extends DispatcherCLI {
  name = 'ops';
  description = 'Operations and maintenance commands';
  protected enableExecutionLogging = true;

  protected commandMap = {
    // Maintenance commands
    'fix-imports': 'scripts/commands/fix/fix-import-extensions.ts',
    'fix-lint': 'scripts/commands/fix/fix-linting-errors.ts',
    'fix-types': 'scripts/commands/fix/fix-typescript-errors.ts',
    'fix-validation': 'scripts/validate/fix-validation-issues.ts',
    'fix-test': 'scripts/commands/fix/fix-test-errors.ts',
    'audit-scripts': 'scripts/commands/maintain/audit-scripts.ts',
    'audit:exit-codes': 'scripts/commands/maintain/audit-exit-codes.ts',
    'validate-scripts': 'scripts/commands/maintain/validate-scripts.ts',
    'fix-scripts': 'scripts/commands/maintain/fix-scripts.ts',

    // Database commands
    'db:reset': 'scripts/setup/reset-database.ts',

    // Rollback commands
    'rollback:list': 'scripts/commands/ops/rollback-list.ts',
    'rollback:restore': 'scripts/commands/ops/rollback-restore.ts',
    'rollback:clear': 'scripts/commands/ops/rollback-clear.ts',
  };

  defineGlobalArgs() {
    return [
      ...super.defineGlobalArgs(),
      {
        name: 'dry-run',
        type: 'boolean' as const,
        description: 'Show what would be changed without making changes',
        default: false,
      },
      {
        name: 'path',
        type: 'string' as const,
        description: 'Glob pattern to filter files',
      },
    ];
  }

  defineCommands(): CommandDefinition[] {
    return [
      // Maintenance Commands
      {
        name: 'fix-imports',
        description: 'Fix missing .js extensions in imports',
        handler: async (args) => this.dispatchCommand('fix-imports', args),
      },
      {
        name: 'fix-lint',
        description: 'Fix common linting errors',
        handler: async (args) => this.dispatchCommand('fix-lint', args),
      },
      {
        name: 'fix-types',
        description: 'Fix TypeScript errors',
        handler: async (args) => this.dispatchCommand('fix-types', args),
      },
      {
        name: 'fix-validation',
        description: 'Fix validation issues',
        handler: async (args) => this.dispatchCommand('fix-validation', args),
      },
      {
        name: 'fix-test',
        description: 'Fix test errors',
        handler: async (args) => this.dispatchCommand('fix-test', args),
      },
      {
        name: 'audit-scripts',
        description: 'Audit package.json scripts for issues',
        args: [
          {
            name: 'show-duplicates',
            type: 'boolean' as const,
            description: 'Show all duplicate scripts with details',
            default: false,
          },
        ],
        handler: async (args) => this.dispatchCommand('audit-scripts', args),
      },
      {
        name: 'validate-scripts',
        description: 'Validate package scripts against templates',
        args: [
          {
            name: 'package',
            type: 'string' as const,
            description: 'Specific package to validate (e.g., @revealui/ai)',
          },
          {
            name: 'strict',
            type: 'boolean' as const,
            description: 'Fail on warnings, not just errors',
            default: false,
          },
        ],
        handler: async (args) => this.dispatchCommand('validate-scripts', args),
      },
      {
        name: 'fix-scripts',
        description: 'Auto-fix package scripts (add missing, align with templates)',
        args: [
          {
            name: 'package',
            type: 'string' as const,
            description: 'Specific package to fix (e.g., @revealui/ai)',
          },
          {
            name: 'backup',
            type: 'boolean' as const,
            description: 'Create backup before modifying',
            default: false,
          },
        ],
        handler: async (args) => this.dispatchCommand('fix-scripts', args),
      },
      {
        name: 'clean',
        description:
          'Clean build artifacts (dist/, .next/, .turbo/). Use --deep to also remove node_modules and reinstall.',
        args: [
          {
            name: 'deep',
            type: 'boolean' as const,
            description: 'Also remove node_modules and reinstall dependencies',
            default: false,
          },
        ],
        confirmPrompt: 'This will delete generated files. Continue?',
        handler: async (args) => this.clean(args),
      },

      // Migration Commands
      {
        name: 'migrate:plan',
        description: 'Generate migration plan between versions',
        args: [
          {
            name: 'script',
            type: 'string' as const,
            required: true,
            description: 'Script name',
          },
          {
            name: 'from',
            type: 'string' as const,
            required: true,
            description: 'Current version',
          },
          {
            name: 'to',
            type: 'string' as const,
            required: true,
            description: 'Target version',
          },
        ],
        handler: async (args) => this.migratePlan(args),
      },
      {
        name: 'migrate:execute',
        description: 'Execute migration plan',
        args: [
          {
            name: 'script',
            type: 'string' as const,
            required: true,
            description: 'Script name',
          },
          {
            name: 'from',
            type: 'string' as const,
            required: true,
            description: 'Current version',
          },
          {
            name: 'to',
            type: 'string' as const,
            required: true,
            description: 'Target version',
          },
        ],
        confirmPrompt: 'This will execute the migration. Continue?',
        handler: async (args) => this.migrateExecute(args),
      },
      {
        name: 'migrate:compare',
        description: 'Compare two versions',
        args: [
          {
            name: 'script',
            type: 'string' as const,
            required: true,
            description: 'Script name',
          },
          {
            name: 'from',
            type: 'string' as const,
            required: true,
            description: 'First version',
          },
          {
            name: 'to',
            type: 'string' as const,
            required: true,
            description: 'Second version',
          },
        ],
        handler: async (args) => this.migrateCompare(args),
      },

      // Database Commands
      {
        name: 'db:reset',
        description: 'Reset database (destructive)',
        confirmPrompt: 'This will delete all data. Continue?',
        handler: async (args) => this.dispatchCommand('db:reset', args),
      },

      // Rollback Command
      {
        name: 'rollback',
        description: 'Rollback to previous state',
        args: [
          {
            name: 'checkpoint',
            type: 'string' as const,
            description: 'Checkpoint ID to rollback to (default: last checkpoint)',
          },
        ],
        confirmPrompt: 'This will rollback changes. Continue?',
        handler: async (args) => this.rollback(args),
      },
    ];
  }

  // ===========================================================================
  // Custom Command Handlers
  // ===========================================================================

  private async clean(args: ParsedArgs) {
    // Delegate to the root package.json "clean" script which removes dist/, node_modules/,
    // .next/, and .turbo/ directories across all workspaces.
    const repoRoot = resolve(fileURLToPath(import.meta.url), '../../../');
    const deep = args.flags.deep as boolean | undefined;

    if (args.flags.json) {
      console.log(JSON.stringify({ status: 'running', target: deep ? 'full' : 'build-artifacts' }));
    } else {
      console.log(
        deep ? 'Removing node_modules + build artifacts...' : 'Removing build artifacts...',
      );
    }

    const script = deep ? 'clean:install' : 'clean';
    execFileSync('pnpm', [script], { cwd: repoRoot, stdio: 'inherit' });

    return {
      success: true,
      data: { cleaned: script },
      message: deep
        ? 'Cleaned build artifacts and reinstalled dependencies'
        : 'Cleaned build artifacts',
    };
  }

  private async migratePlan(args: ParsedArgs) {
    const { getMigrationHelper } = await import('../lib/migration/migration-helper.js');
    const helper = await getMigrationHelper();

    const script = args.flags.script as string;
    const from = args.flags.from as string;
    const to = args.flags.to as string;

    const plan = await helper.generatePlan(script, from, to);

    if (args.flags.json) {
      return { success: true, data: plan, message: 'Migration plan generated' };
    }

    console.log('\nMigration Plan:');
    console.log(`Script: ${script}`);
    console.log(`From: ${from} → To: ${to}`);
    console.log(`\nSteps: ${plan.steps.length}`);
    for (const step of plan.steps) {
      console.log(`  - ${step.description}`);
    }

    return { success: true, data: plan, message: 'Migration plan generated' };
  }

  private async migrateExecute(args: ParsedArgs) {
    const { getMigrationHelper } = await import('../lib/migration/migration-helper.js');
    const helper = await getMigrationHelper();

    const script = args.flags.script as string;
    const from = args.flags.from as string;
    const to = args.flags.to as string;
    const dryRun = args.flags['dry-run'] as boolean;

    const result = await helper.executeMigration(script, from, to, { dryRun });

    return {
      success: result.success,
      data: result,
      message: result.success ? 'Migration executed successfully' : 'Migration failed',
    };
  }

  private async migrateCompare(args: ParsedArgs) {
    const { getMigrationHelper } = await import('../lib/migration/migration-helper.js');
    const helper = await getMigrationHelper();

    const script = args.flags.script as string;
    const from = args.flags.from as string;
    const to = args.flags.to as string;

    const comparison = await helper.compareVersions(script, from, to);

    if (args.flags.json) {
      return { success: true, data: comparison, message: 'Versions compared' };
    }

    console.log('\nVersion Comparison:');
    console.log(`Script: ${script}`);
    console.log(`From: ${from}`);
    console.log(`To: ${to}`);
    console.log(`\nDifferences: ${comparison.differences.length}`);
    for (const diff of comparison.differences) {
      console.log(`  - ${diff.type}: ${diff.description}`);
    }

    return { success: true, data: comparison, message: 'Versions compared' };
  }

  private async rollback(args: ParsedArgs) {
    const { RollbackManager } = await import('../lib/rollback/manager.js');
    const manager = new RollbackManager(this.projectRoot);

    const checkpointId = args.flags.checkpoint as string | undefined;

    if (checkpointId) {
      await manager.rollback(checkpointId);
    } else {
      await manager.rollbackLast();
    }

    return {
      success: true,
      data: { checkpointId },
      message: checkpointId
        ? `Rolled back to checkpoint: ${checkpointId}`
        : 'Rolled back to last checkpoint',
    };
  }
}

// Run CLI if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI(OpsCLI).catch(console.error);
}

export { OpsCLI };
