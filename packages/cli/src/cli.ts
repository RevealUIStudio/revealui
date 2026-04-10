/**
 * CLI definition using Commander.js
 */

import { createRequire } from 'node:module';
import { createLogger } from '@revealui/setup/utils';
import { Command } from 'commander';
import {
  runAgentHeadlessCommand,
  runAgentReplCommand,
  runAgentStatusCommand,
} from './commands/agent.js';
import {
  runAuthSetTokenCommand,
  runAuthStatusCommand,
  runAuthVerifyCommand,
} from './commands/auth.js';
import { runCreateFlow } from './commands/create-flow.js';
import {
  runDbCleanupCommand,
  runDbInitCommand,
  runDbMigrateCommand,
  runDbResetCommand,
  runDbStartCommand,
  runDbStatusCommand,
  runDbStopCommand,
} from './commands/db.js';
import {
  type DevProfileName,
  runDevDownCommand,
  runDevProfileSetCommand,
  runDevProfileShowCommand,
  runDevStatusCommand,
  runDevUpCommand,
} from './commands/dev.js';
import { runDoctorCommand } from './commands/doctor.js';
import { runTerminalInstallCommand, runTerminalListCommand } from './commands/terminal.js';

const cliRequire = createRequire(import.meta.url);
const CLI_VERSION: string = (cliRequire('../package.json') as { version: string }).version;

const logger = createLogger({ prefix: 'CLI' });

export interface CliOptions {
  template?: string;
  skipGit?: boolean;
  skipInstall?: boolean;
  yes?: boolean;
}

function configureCreateCommand(command: Command, legacyName?: string): Command {
  command
    .description('Create a new RevealUI project')
    .argument('[project-name]', 'Name of the project')
    .option('-t, --template <name>', 'Template to use (basic-blog, e-commerce, portfolio)')
    .option('--skip-git', 'Skip git initialization', false)
    .option('--skip-install', 'Skip dependency installation', false)
    .option('-y, --yes', 'Skip all prompts and use defaults', false)
    .action(async (projectName: string | undefined, options: CliOptions) => {
      logger.header(legacyName ? 'Create RevealUI Project' : 'RevealUI Create');
      await runCreateFlow(projectName, options);
    });

  return command;
}

export function createCli(): Command {
  const program = new Command();

  program.name('revealui').description('RevealUI operational CLI').version(CLI_VERSION);

  configureCreateCommand(program.command('create'), undefined);

  program
    .command('doctor')
    .description('Check RevealUI workspace and developer environment health')
    .option('--json', 'Output machine-readable JSON', false)
    .option('--fix', 'Apply safe automatic fixes when possible', false)
    .option('--strict', 'Exit nonzero when checks fail', false)
    .action(async (options: { json?: boolean; fix?: boolean; strict?: boolean }) => {
      await runDoctorCommand(options);
    });

  const agent = program
    .command('agent')
    .description('RevealUI coding agent (powered by local or cloud LLMs)');

  agent
    .option('-p, --prompt <text>', 'Run a single prompt in headless mode')
    .action(async (options: { prompt?: string }) => {
      if (options.prompt) {
        await runAgentHeadlessCommand(options.prompt);
      } else {
        await runAgentReplCommand();
      }
    });

  agent
    .command('status')
    .description('Show agent status: model, provider, project root')
    .action(async () => {
      await runAgentStatusCommand();
    });

  const db = program.command('db').description('Manage the local RevealUI database');

  db.command('init')
    .description('Initialize the local PostgreSQL data directory')
    .option('--force', 'Delete and recreate the local data directory', false)
    .action(async (options: { force?: boolean }) => {
      await runDbInitCommand(options);
    });

  db.command('start')
    .description('Start the local PostgreSQL server')
    .action(async () => {
      await runDbStartCommand();
    });

  db.command('stop')
    .description('Stop the local PostgreSQL server')
    .action(async () => {
      await runDbStopCommand();
    });

  db.command('status')
    .description('Show local PostgreSQL status')
    .action(async () => {
      await runDbStatusCommand();
    });

  db.command('reset')
    .description('Reset the local PostgreSQL data directory')
    .option('--force', 'Confirm the destructive reset', false)
    .action(async (options: { force?: boolean }) => {
      await runDbResetCommand(options);
    });

  db.command('migrate')
    .description('Run Drizzle migrations using the local RevealUI database environment')
    .action(async () => {
      await runDbMigrateCommand();
    });

  db.command('cleanup')
    .description(
      'Delete expired sessions, rate-limit rows, password-reset tokens, magic links, and publish due scheduled pages. Uses DATABASE_URL / POSTGRES_URL from the environment.',
    )
    .option('--dry-run', 'Count stale rows without deleting them', false)
    .option(
      '--tables <names>',
      'Comma-separated subset: sessions,rateLimits,passwordResetTokens,magicLinks,scheduledPages',
    )
    .action(async (options: { dryRun?: boolean; tables?: string }) => {
      await runDbCleanupCommand(options);
    });

  const dev = program
    .command('dev')
    .description('Prepare and manage the RevealUI development workspace');

  dev
    .command('up')
    .description(
      'Ensure the local dev environment is ready, migrate the DB, optionally validate MCP, and start a dev script',
    )
    .option('--json', 'Output machine-readable JSON', false)
    .option('--dry-run', 'Print the effective plan and actions without executing them', false)
    .option('--fix', 'Apply safe automatic fixes before bootstrapping when possible', false)
    .option('--no-ensure', 'Skip automatic local DB initialization/start')
    .option('--profile <name>', 'Named dev profile: local, agent, admin, fullstack')
    .option(
      '--include <service...>',
      'Additional development services to prepare (currently supports: mcp)',
    )
    .option('--script <name>', 'Optional pnpm script to run after environment bootstrap')
    .option('--inside', 'Internal flag used after re-entering nix develop', false)
    .action(
      async (options: {
        ensure?: boolean;
        json?: boolean;
        dryRun?: boolean;
        fix?: boolean;
        script?: string;
        profile?: DevProfileName;
        include?: string[];
        inside?: boolean;
      }) => {
        await runDevUpCommand(options);
      },
    );

  dev
    .command('status')
    .description('Show current RevealUI development environment status')
    .option('--json', 'Output machine-readable JSON', false)
    .option('--profile <name>', 'Named dev profile: local, agent, admin, fullstack')
    .option(
      '--include <service...>',
      'Additional development services to preview in the effective plan',
    )
    .option('--script <name>', 'Optional pnpm script to preview in the effective plan')
    .option('--inside', 'Internal flag used after re-entering nix develop', false)
    .action(
      async (options: {
        json?: boolean;
        profile?: DevProfileName;
        include?: string[];
        script?: string;
        inside?: boolean;
      }) => {
        await runDevStatusCommand(options);
      },
    );

  dev
    .command('down')
    .description('Stop local RevealUI development services that are managed by the CLI')
    .action(async () => {
      await runDevDownCommand();
    });

  dev
    .command('shell')
    .description('Alias for `revealui dev up` without starting an app script')
    .option('--json', 'Output machine-readable JSON', false)
    .option('--dry-run', 'Print the effective plan and actions without executing them', false)
    .option('--fix', 'Apply safe automatic fixes before bootstrapping when possible', false)
    .option('--no-ensure', 'Skip automatic local DB initialization/start')
    .option('--profile <name>', 'Named dev profile: local, agent, admin, fullstack')
    .option(
      '--include <service...>',
      'Additional development services to prepare (currently supports: mcp)',
    )
    .option('--inside', 'Internal flag used after re-entering nix develop', false)
    .action(
      async (options: {
        ensure?: boolean;
        json?: boolean;
        dryRun?: boolean;
        fix?: boolean;
        profile?: DevProfileName;
        include?: string[];
        inside?: boolean;
      }) => {
        await runDevUpCommand({
          ensure: options.ensure,
          json: options.json,
          dryRun: options.dryRun,
          fix: options.fix,
          profile: options.profile,
          include: options.include,
          inside: options.inside,
        });
      },
    );

  const devProfile = dev
    .command('profile')
    .description('Persist or inspect the default dev profile');

  devProfile
    .command('set')
    .description('Set the default profile used by `revealui dev up` and `revealui dev status`')
    .argument('<name>', 'Profile name: local, agent, admin, fullstack')
    .action(async (name: DevProfileName) => {
      await runDevProfileSetCommand(name);
    });

  devProfile
    .command('show')
    .description('Show the configured default dev profile')
    .option('--json', 'Output machine-readable JSON', false)
    .action(async (options: { json?: boolean }) => {
      await runDevProfileShowCommand(options);
    });

  const auth = program
    .command('auth')
    .description('Manage npm registry authentication and publish tokens');

  auth
    .command('status')
    .description('Show current npm authentication state')
    .option('--json', 'Output machine-readable JSON', false)
    .action(async (options: { json?: boolean }) => {
      await runAuthStatusCommand(options);
    });

  auth
    .command('set-token')
    .description('Store an npm token via RevVault and configure .npmrc')
    .option('--token <value>', 'npm token (or set NPM_TOKEN env var)')
    .option('--skip-vault', 'Skip RevVault storage', false)
    .option('--skip-npmrc', 'Skip .npmrc modification', false)
    .action(async (options: { token?: string; skipVault?: boolean; skipNpmrc?: boolean }) => {
      await runAuthSetTokenCommand(options);
    });

  auth
    .command('verify')
    .description('Verify the full npm auth chain (env → RevVault → .npmrc → registry)')
    .option('--json', 'Output machine-readable JSON', false)
    .action(async (options: { json?: boolean }) => {
      await runAuthVerifyCommand(options);
    });

  const terminal = program
    .command('terminal')
    .description('Install RevealUI terminal profiles for your terminal emulator');

  terminal
    .command('install')
    .description('Detect and install terminal profiles for supported emulators')
    .option('--terminal <name>', 'Install for a specific terminal (e.g. iTerm2, Alacritty, Kitty)')
    .option('--force', 'Overwrite existing profile files', false)
    .option('--json', 'Output machine-readable JSON', false)
    .action(async (options: { terminal?: string; force?: boolean; json?: boolean }) => {
      await runTerminalInstallCommand(options);
    });

  terminal
    .command('list')
    .description('List available terminal profiles and detected emulators')
    .option('--json', 'Output machine-readable JSON', false)
    .action(async (options: { json?: boolean }) => {
      await runTerminalListCommand(options);
    });

  program
    .command('shell')
    .description('Deprecated alias for `revealui dev shell`')
    .option('--ensure', 'Initialize/start the local DB when possible', false)
    .option('--json', 'Output machine-readable JSON', false)
    .option('--inside', 'Internal flag used after re-entering nix develop', false)
    .action(async (options: { ensure?: boolean; json?: boolean; inside?: boolean }) => {
      await runDevUpCommand({
        ensure: options.ensure,
        json: options.json,
        inside: options.inside,
      });
    });

  return program;
}

export function createLegacyCreateCli(): Command {
  const program = new Command();

  program.name('create-revealui').version(CLI_VERSION);
  configureCreateCommand(program, 'create-revealui');

  return program;
}
