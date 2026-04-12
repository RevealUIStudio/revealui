import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createLogger } from '@revealui/setup/utils';
import { importSPKI, jwtVerify } from 'jose';
import type { CliOptions } from '../cli.js';
import { promptDatabaseConfig } from '../prompts/database.js';
import { promptDevEnvConfig } from '../prompts/devenv.js';
import { promptPaymentConfig } from '../prompts/payments.js';
import { promptProjectConfig } from '../prompts/project.js';
import { promptStorageConfig } from '../prompts/storage.js';
import { validateNodeVersion } from '../validators/node-version.js';
import { createProject } from './create.js';

const logger = createLogger({ prefix: '@revealui/cli' });

const PRO_TEMPLATES = new Set<string>([]);

async function checkProLicense(): Promise<boolean> {
  let key: string | undefined = process.env.REVEALUI_LICENSE_KEY;

  if (!key) {
    try {
      const licenseFile = join(homedir(), '.revealui', 'license.json');
      const parsed = JSON.parse(readFileSync(licenseFile, 'utf8')) as { key?: string };
      key = parsed.key;
    } catch {
      // No license file  -  free tier
    }
  }

  if (!key) return false;

  const publicKeyPem = process.env.REVEALUI_LICENSE_PUBLIC_KEY?.replace(/\\n/g, '\n');
  if (publicKeyPem) {
    try {
      const publicKey = await importSPKI(publicKeyPem, 'RS256');
      const { payload } = await jwtVerify(key, publicKey);
      const tier = (payload as { tier?: string }).tier ?? 'free';
      return tier === 'pro' || tier === 'enterprise';
    } catch {
      return false;
    }
  }

  try {
    const parts = key.split('.');
    if (parts.length < 3) return false;
    const payload = JSON.parse(Buffer.from(parts[1] ?? '', 'base64url').toString('utf8')) as {
      tier?: string;
      exp?: number;
    };
    if (payload.exp !== undefined && payload.exp < Math.floor(Date.now() / 1000)) {
      return false;
    }
    const tier = payload.tier ?? 'free';
    return tier === 'pro' || tier === 'enterprise';
  } catch {
    return false;
  }
}

function printBanner(): void {
  logger.divider();
  logger.info('  RevealUI  -  Agentic Business Runtime');
  logger.info('  Build your business, not your boilerplate.');
  logger.divider();
  logger.info('');
}

function printPostCreateSummary(projectName: string): void {
  logger.divider();
  logger.success('Your RevealUI project is ready!');
  logger.info('');
  logger.info('  Quick start:');
  logger.info(`    cd ${projectName}`);
  logger.info('    pnpm install');
  logger.info('    pnpm dev');
  logger.info('');
  logger.info('  What was created:');
  logger.info(`    ./${projectName}/          — project root`);
  logger.info(`    ./${projectName}/.env.local — environment variables (edit before pnpm dev)`);
  logger.info(`    ./${projectName}/README.md  — getting started guide`);
  logger.info('');
  logger.info('  RevealUI ecosystem:');
  logger.info('    Studio:   Native AI experience  -  agent hub, local inference, dev environment');
  logger.info('    Terminal: TUI client  -  run `revealui terminal install`');
  logger.info('    admin:      Admin dashboard at your-domain.com/admin');
  logger.info('');
  logger.info('  Helpful links:');
  logger.info('    Docs:    https://docs.revealui.com');
  logger.info('    GitHub:  https://github.com/RevealUIStudio/revealui');
  logger.info('    Support: support@revealui.com');
  logger.divider();
}

function formatCreateError(err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  const code = err instanceof Error && 'code' in err ? (err as { code: string }).code : undefined;

  logger.error('Project creation failed.');
  logger.info('');

  if (code === 'EACCES') {
    logger.info('  Permission denied. Try:');
    logger.info('    - Running from a directory you own');
    logger.info('    - Checking folder permissions with `ls -la`');
  } else if (code === 'ENOENT') {
    logger.info('  A required file or directory was not found.');
    logger.info('    - Check that you are in the correct directory');
    logger.info('    - Try running `revealui doctor` to diagnose your environment');
  } else if (code === 'ENOSPC') {
    logger.info('  Disk full. Free up space and try again.');
  } else if (
    message.includes('fetch') ||
    message.includes('ENOTFOUND') ||
    message.includes('ETIMEDOUT')
  ) {
    logger.info('  Network error. Check your internet connection and try again.');
  } else {
    logger.info(`  ${message}`);
  }

  logger.info('');
  logger.info('  Troubleshooting:');
  logger.info('    revealui doctor        -  diagnose your environment');
  logger.info('    https://docs.revealui.com/docs/TROUBLESHOOTING');
  logger.info('    support@revealui.com   -  we are here to help');
  logger.divider();
}

export async function runCreateFlow(
  projectName: string | undefined,
  options: CliOptions,
): Promise<void> {
  printBanner();

  try {
    logger.info('[1/8] Validating Node.js version...');
    if (!validateNodeVersion()) {
      process.exit(1);
    }
    logger.success(`Node.js version: ${process.version}`);

    logger.info('[2/8] Configure your project');
    const projectConfig = await promptProjectConfig(projectName, options.template, options.yes);
    logger.success(`Project: ${projectConfig.projectName}`);
    logger.success(`Template: ${projectConfig.template}`);

    if (PRO_TEMPLATES.has(projectConfig.template)) {
      if (!(await checkProLicense())) {
        logger.error(`The "${projectConfig.template}" template requires a RevealUI Pro license.`);
        logger.info('Get Pro at https://revealui.com/pricing');
        logger.info('Set your license key: export REVEALUI_LICENSE_KEY=<your-key>');
        process.exit(2);
      }
      logger.success('Pro license verified');
    }

    const nonInteractive = options.yes === true;

    logger.info('[3/8] Configure database');
    const databaseConfig = nonInteractive
      ? { provider: 'skip' as const }
      : await promptDatabaseConfig();
    if (databaseConfig.provider !== 'skip') {
      logger.success(`Database: ${databaseConfig.provider}`);
    } else {
      logger.info('Database configuration skipped');
    }

    logger.info('[4/8] Configure storage');
    const storageConfig = nonInteractive
      ? { provider: 'skip' as const }
      : await promptStorageConfig();
    if (storageConfig.provider !== 'skip') {
      logger.success(`Storage: ${storageConfig.provider}`);
    } else {
      logger.info('Storage configuration skipped');
    }

    logger.info('[5/8] Configure payments');
    const paymentConfig = nonInteractive ? { enabled: false } : await promptPaymentConfig();
    if (paymentConfig.enabled) {
      logger.success('Stripe configured');
    } else {
      logger.info('Payments disabled');
    }

    logger.info('[6/8] Configure development environment');
    const devEnvConfig = nonInteractive
      ? { createDevContainer: false, createDevbox: false }
      : await promptDevEnvConfig();
    logger.success(
      `Dev Container: ${devEnvConfig.createDevContainer ? 'Yes' : 'No'}, Devbox: ${devEnvConfig.createDevbox ? 'Yes' : 'No'}`,
    );

    logger.info('[7/8] Creating project...');
    await createProject({
      project: projectConfig,
      database: databaseConfig,
      storage: storageConfig,
      payment: paymentConfig,
      devenv: devEnvConfig,
      skipGit: options.skipGit,
      skipInstall: options.skipInstall,
    });
    logger.success('Project created successfully');

    logger.info('[8/8] Done!');
    printPostCreateSummary(projectConfig.projectName);
  } catch (err) {
    formatCreateError(err);
    process.exit(1);
  }
}
