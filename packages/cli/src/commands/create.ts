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
import {
  checkPnpmVersion,
  installDependencies,
  isPnpmInstalled,
} from '../installers/dependencies.js';
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
 * Pull OSS AI rules from the revealui-rules repo.
 * Best-effort  -  if the network is unavailable or the repo doesn't exist yet, skip silently.
 */
async function pullContentRules(projectPath: string): Promise<void> {
  const rawBaseUrl =
    process.env.REVEALUI_RULES_URL ??
    'https://raw.githubusercontent.com/RevealUIStudio/editor-configs/main/harnesses';

  // Validate URL protocol to prevent file:// or other dangerous schemes
  let baseUrl: string;
  try {
    const parsed = new URL(rawBaseUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return; // silently skip non-HTTP URLs
    }
    baseUrl = rawBaseUrl;
  } catch {
    return; // invalid URL  -  skip
  }

  const spinner = ora('Pulling AI coding rules...').start();
  try {
    const manifestRes = await fetch(`${baseUrl}/manifest.json`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!manifestRes.ok) {
      spinner.info('AI rules not available  -  skipping');
      return;
    }

    const manifest = (await manifestRes.json()) as {
      definitions: Array<{
        tier: string;
        generatorPaths: Record<string, string[]>;
      }>;
    };

    // Only pull OSS definitions, rendered for Claude Code
    const generatorId = 'claude-code';
    const ossDefs = manifest.definitions.filter((d) => d.tier === 'oss');
    let written = 0;

    // Allowed file extensions for downloaded rule files
    const allowedExtensions = new Set(['.md', '.json', '.txt', '.yaml', '.yml', '.ts', '.js']);
    // Maximum file size (1 MB) to prevent abuse
    const maxFileSize = 1_048_576;

    for (const def of ossDefs) {
      const paths = def.generatorPaths[generatorId] ?? [];
      for (const relPath of paths) {
        try {
          // Reject paths containing traversal sequences before fetching
          if (relPath.includes('..') || relPath.startsWith('/')) continue;
          // Only allow known text file extensions
          const ext = path.extname(relPath).toLowerCase();
          if (!allowedExtensions.has(ext)) continue;

          const absolutePath = path.resolve(projectPath, relPath);
          // Verify resolved path stays within project (prevent path traversal)
          if (!absolutePath.startsWith(path.resolve(projectPath))) continue;

          const fileRes = await fetch(`${baseUrl}/generators/${generatorId}/${relPath}`, {
            signal: AbortSignal.timeout(5_000),
          });
          if (!fileRes.ok) continue;

          // Enforce size limit before reading body
          const contentLength = fileRes.headers.get('content-length');
          if (contentLength && Number.parseInt(contentLength, 10) > maxFileSize) continue;

          const content = await fileRes.text();
          if (content.length > maxFileSize) continue;

          await fs.mkdir(path.dirname(absolutePath), { recursive: true });
          // lgtm[js/http-to-file-access]  -  intentional: CLI scaffolding downloads text rule files
          // from a trusted HTTPS source with path traversal, extension, and size guards
          await fs.writeFile(absolutePath, content, 'utf-8');
          written++;
        } catch {
          // Individual file failures are non-fatal
        }
      }
    }

    if (written > 0) {
      spinner.succeed(`Pulled ${written} AI coding rules`);
    } else {
      spinner.info('No AI rules pulled');
    }
  } catch {
    spinner.info('AI rules not available  -  skipping');
  }
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

  // 4c. Pull OSS AI rules from the rules repo (best-effort)
  await pullContentRules(projectPath);

  // 5. Install dependencies
  if (!skipInstall) {
    const pnpmOk = await isPnpmInstalled();
    if (!pnpmOk) {
      logger.warn(
        'pnpm not found  -  skipping dependency installation. Run `pnpm install` manually.',
      );
    } else {
      const { version, valid } = await checkPnpmVersion();
      if (!valid) {
        logger.error(`pnpm 10.28.2 or higher is required. You have ${version}.`);
        logger.info('Upgrade: https://pnpm.io/installation');
        process.exit(1);
      }
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
