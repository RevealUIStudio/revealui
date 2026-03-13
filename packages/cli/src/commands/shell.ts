import { createLogger } from '@revealui/setup/utils';
import { execa } from 'execa';
import { formatDoctorReport, gatherDoctorReport } from '../runtime/doctor.js';
import { commandExists } from '../utils/command.js';
import { findWorkspaceRoot } from '../utils/workspace.js';
import { runDbInitCommand, runDbStartCommand } from './db.js';

const logger = createLogger({ prefix: 'Shell' });

export async function runShellCommand(
  options: { ensure?: boolean; json?: boolean; inside?: boolean; forwardArgs?: string[] } = {},
): Promise<boolean> {
  if (!(options.inside || process.env.IN_NIX_SHELL) && (await commandExists('nix'))) {
    const workspaceRoot = findWorkspaceRoot();

    if (workspaceRoot) {
      const reentryArgs = options.ensure ? ['dev', 'up'] : ['dev', 'status'];
      await execa(
        'nix',
        [
          'develop',
          '-c',
          'node',
          'packages/cli/bin/revealui.js',
          ...reentryArgs,
          ...(options.forwardArgs ?? []),
          '--inside',
          ...(options.json ? ['--json'] : []),
        ],
        {
          cwd: workspaceRoot,
          stdio: 'inherit',
        },
      );
      return true;
    }
  }

  const report = await gatherDoctorReport();

  if (options.ensure && report.dbTarget === 'local' && (await commandExists('pg_ctl'))) {
    const postgresCheck = report.checks.find((check) => check.id === 'postgres');
    if (postgresCheck && !postgresCheck.ok) {
      try {
        await runDbInitCommand();
      } catch {
        // Ignore if already initialized.
      }
      await runDbStartCommand();
    }
  }

  const freshReport = await gatherDoctorReport();
  if (options.json) {
    process.stdout.write(`${JSON.stringify(freshReport, null, 2)}\n`);
    return false;
  }

  process.stdout.write(`${formatDoctorReport(freshReport)}\n`);
  logger.info('Use `revealui doctor --json` for machine-readable status.');
  return false;
}
