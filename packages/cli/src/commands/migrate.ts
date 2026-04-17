/**
 * `revealui migrate` — run applicable codemods against the current project.
 */

import { createLogger } from '@revealui/setup/utils';
import {
  type CodemodLogger,
  type CodemodRunResult,
  listApplicableCodemods,
  runCodemods,
} from '../codemods/index.js';

export interface MigrateOptions {
  /** Preview changes without writing files. */
  dryRun?: boolean;
  /** Print the applicable codemod list and exit. */
  list?: boolean;
  /** Restrict the run to a single codemod by name. */
  only?: string;
  /** Override the project root (defaults to process.cwd()). */
  cwd?: string;
}

const logger = createLogger({ prefix: 'migrate' });

const codemodLogger: CodemodLogger = {
  info: (m) => logger.info(m),
  warn: (m) => logger.warn(m),
  error: (m) => logger.error(m),
};

export async function runMigrateListCommand(options: MigrateOptions = {}): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  const entries = await listApplicableCodemods(cwd);
  if (entries.length === 0) {
    logger.info('No codemods are registered.');
    return;
  }
  logger.info(`Codemods available for project at ${cwd}:`);
  for (const entry of entries) {
    const marker = entry.applicable ? '✓' : '·';
    logger.info(
      `  ${marker} ${entry.codemod.name}  [${entry.codemod.package} ${entry.codemod.fromVersion} → ${entry.codemod.toVersion}]`,
    );
    logger.info(`      ${entry.codemod.description}`);
    logger.info(`      status: ${entry.reason}`);
  }
}

export async function runMigrateCommand(options: MigrateOptions = {}): Promise<CodemodRunResult> {
  const cwd = options.cwd ?? process.cwd();
  if (options.list) {
    await runMigrateListCommand({ ...options, cwd });
    return {
      applied: [],
      skipped: [],
      changedFiles: 0,
      errored: 0,
      results: [],
    };
  }
  const result = await runCodemods({
    cwd,
    dryRun: options.dryRun,
    only: options.only,
    logger: codemodLogger,
  });

  if (result.applied.length === 0) {
    logger.info('No applicable codemods. Your project is up to date.');
    return result;
  }

  logger.success(
    `${options.dryRun ? 'Would change' : 'Changed'} ${result.changedFiles} file(s) across ${result.applied.length} codemod(s).`,
  );
  if (result.errored > 0) {
    logger.warn(`${result.errored} file(s) errored — see log above.`);
  }
  if (result.skipped.length > 0) {
    logger.info(`Skipped: ${result.skipped.join(', ')}`);
  }
  return result;
}
