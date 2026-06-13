/**
 * Project creation command
 *
 * Copies template files, writes .env.development.local, installs
 * dependencies, and initialises a git repo.
 */

import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLogger } from '@revealui/setup/utils';
import ora from 'ora';
import { generateDevbox } from '../generators/devbox.js';
import { generateDevContainer } from '../generators/devcontainer.js';
import { generateEnvFile } from '../generators/env-file.js';
import { generateReadme } from '../generators/readme.js';
import { installDependencies, isPnpmInstalled } from '../installers/dependencies.js';
import type { DatabaseConfig } from '../prompts/database.js';
import type { DevEnvConfig } from '../prompts/devenv.js';
import type { PaymentConfig } from '../prompts/payments.js';
import type { ProjectConfig } from '../prompts/project.js';
import type { StorageConfig } from '../prompts/storage.js';
import { createInitialCommit, initializeGitRepo, isGitInstalled } from '../utils/git.js';

const logger = createLogger({ prefix: 'Create' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Templates live at packages/cli/templates/
// In source: __dirname = src/commands/ → ../../templates
// After tsup: __dirname = dist/ → ../templates
// Detect by checking which path actually exists
const TEMPLATES_DIR = existsSync(path.resolve(__dirname, '../../templates'))
  ? path.resolve(__dirname, '../../templates')
  : path.resolve(__dirname, '../templates');

export interface CreateProjectConfig {
  project: ProjectConfig;
  database: DatabaseConfig;
  storage: StorageConfig;
  payment: PaymentConfig;
  devenv: DevEnvConfig;
  skipGit?: boolean;
  skipInstall?: boolean;
}

/**
 * List template directories that actually exist on disk.
 */
async function listAvailableTemplates(): Promise<string[]> {
  try {
    const entries = await fs.readdir(TEMPLATES_DIR, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

/**
 * Copy a template directory recursively into the target path.
 */
async function copyTemplate(templateName: string, targetPath: string): Promise<void> {
  const templatePath = path.join(TEMPLATES_DIR, templateName);

  // Verify the template exists
  try {
    await fs.access(templatePath);
  } catch {
    const available = await listAvailableTemplates();
    const listing =
      available.length > 0
        ? `Available templates: ${available.join(', ')}`
        : `No templates found in ${TEMPLATES_DIR}`;
    throw new Error(`Template "${templateName}" not found at ${templatePath}. ${listing}`);
  }

  await copyDir(templatePath, targetPath);
}

async function copyDir(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    // npm always strips .gitignore from tarballs; we store it as _gitignore and rename on copy
    const destName = entry.name === '_gitignore' ? '.gitignore' : entry.name;
    const destPath = path.join(dest, destName);

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

/**
 * Map the CLI template name to the directory name under templates/.
 * Every selectable template maps 1:1 to its directory; the `?? 'starter'`
 * fallback is defensive for untyped JS callers only.
 *
 * `starter` is the blank-canvas Next.js scaffold (no sample collections).
 * `starter-native` is the RevealUI-native variant (Vite + @revealui/router +
 * no Next.js) — see GAP-194 audit §1.B for the rationale. Customers choose
 * `starter-native` when they want the framework-not-stack runtime instead of
 * the default Next.js-based starters.
 */
function resolveTemplateName(template: ProjectConfig['template']): string {
  const map: Record<ProjectConfig['template'], string> = {
    'basic-blog': 'basic-blog',
    'e-commerce': 'e-commerce',
    portfolio: 'portfolio',
    starter: 'starter',
    'starter-native': 'starter-native',
  };
  return map[template] ?? 'starter';
}

/**
 * Main project creation function  -  wires everything together.
 */
export async function createProject(cfg: CreateProjectConfig): Promise<void> {
  const { project, skipGit = false, skipInstall = false } = cfg;
  const { projectPath, projectName, template } = project;

  // 1. Copy template files
  const spinner = ora(`Copying template "${template}"...`).start();
  try {
    await copyTemplate(resolveTemplateName(template), projectPath);
    spinner.succeed('Template files copied');
  } catch (err) {
    spinner.fail('Failed to copy template files');
    throw err;
  }

  // 2. Replace {{PROJECT_NAME}} placeholders in package.json / other files
  const pkgJsonPath = path.join(projectPath, 'package.json');
  try {
    const raw = await fs.readFile(pkgJsonPath, 'utf-8');
    await fs.writeFile(pkgJsonPath, raw.replaceAll('{{PROJECT_NAME}}', projectName), 'utf-8');
  } catch {
    // package.json placeholder replacement is best-effort
  }

  // 3. Write .env.development.local
  const envSpinner = ora('Writing .env.development.local...').start();
  try {
    await generateEnvFile(projectPath, {
      database: cfg.database,
      storage: cfg.storage,
      payment: cfg.payment,
    });
    envSpinner.succeed('.env.development.local written');
  } catch (err) {
    envSpinner.fail('Failed to write .env.development.local');
    throw err;
  }

  // 4. Generate README
  await generateReadme(projectPath, project);
  logger.success('README.md generated');

  // 4b. Generate dev environment configs
  if (cfg.devenv.createDevContainer) {
    await generateDevContainer(projectPath);
    logger.success('.devcontainer/ generated');
  }
  if (cfg.devenv.createDevbox) {
    await generateDevbox(projectPath);
    logger.success('devbox.json generated');
  }

  // 5. Install dependencies
  if (!skipInstall) {
    const pnpmOk = await isPnpmInstalled();
    if (!pnpmOk) {
      logger.warn(
        'pnpm not found  -  skipping dependency installation. Run `pnpm install` manually.',
      );
    } else {
      await installDependencies(projectPath);
    }
  } else {
    logger.info('Skipping dependency installation (--skip-install)');
  }

  // 6. Git init
  if (!skipGit) {
    const gitOk = await isGitInstalled();
    if (!gitOk) {
      logger.warn('git not found  -  skipping repository initialisation.');
    } else {
      await initializeGitRepo(projectPath);
      await createInitialCommit(projectPath);
    }
  } else {
    logger.info('Skipping git initialisation (--skip-git)');
  }
}
