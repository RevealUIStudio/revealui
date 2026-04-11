/**
 * Auth commands  -  manage npm tokens and registry authentication
 *
 * Subcommands:
 *   revealui auth status     Show current npm auth state
 *   revealui auth set-token  Store an npm token via RevVault + .npmrc
 *   revealui auth verify     Verify the current token can publish
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createLogger } from '@revealui/setup/utils';
import { execa } from 'execa';
import { commandExists } from '../utils/command.js';

const logger = createLogger({ prefix: 'Auth' });

const REVVAULT_NPM_PATH = 'revealui/env/npm';

// The literal string npm uses for token interpolation in .npmrc files.
// Constructed to avoid Biome's noTemplateCurlyInString lint rule.
const NPM_TOKEN_INTERPOLATION = '$' + '{NPM_TOKEN}';
const NPMRC_AUTH_LINE = `//registry.npmjs.org/:_authToken=${NPM_TOKEN_INTERPOLATION}`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function write(text: string): void {
  process.stdout.write(text);
}

function writeJson(data: unknown): void {
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
}

interface NpmrcPaths {
  user: string;
  project: string | null;
}

function getNpmrcPaths(): NpmrcPaths {
  const user = path.join(os.homedir(), '.npmrc');
  // Walk up from cwd looking for a project .npmrc
  let dir = process.cwd();
  let project: string | null = null;
  for (let i = 0; i < 10; i++) {
    const candidate = path.join(dir, '.npmrc');
    if (dir !== os.homedir()) {
      // We'll check existence later; just record the first project-level candidate
      project ??= candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return { user, project };
}

async function fileContains(filePath: string, needle: string): Promise<boolean> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content.includes(needle);
  } catch {
    return false;
  }
}

async function getTokenFromEnv(): Promise<string | undefined> {
  return process.env.NPM_TOKEN || undefined;
}

async function getTokenFromNpmrc(): Promise<string | undefined> {
  const userRc = path.join(os.homedir(), '.npmrc');
  try {
    const content = await fs.readFile(userRc, 'utf-8');
    const match = content.match(/\/\/registry\.npmjs\.org\/:_authToken=(.+)/);
    return match?.[1]?.trim() || undefined;
  } catch {
    return undefined;
  }
}

function maskToken(token: string): string {
  if (token.length <= 8) return '***';
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

async function hasRevvault(): Promise<boolean> {
  return commandExists('revvault');
}

async function revvaultGet(secretPath: string): Promise<string | undefined> {
  try {
    const { stdout } = await execa('revvault', ['get', secretPath], {
      stdio: 'pipe',
    });
    return stdout.trim() || undefined;
  } catch {
    return undefined;
  }
}

async function revvaultSet(secretPath: string, value: string): Promise<boolean> {
  try {
    await execa('revvault', ['set', secretPath], {
      input: value,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// revealui auth status
// ---------------------------------------------------------------------------

export async function runAuthStatusCommand(options: { json?: boolean }): Promise<void> {
  const envToken = await getTokenFromEnv();
  const npmrcToken = await getTokenFromNpmrc();
  const hasVault = await hasRevvault();
  const vaultValue = hasVault ? await revvaultGet(REVVAULT_NPM_PATH) : undefined;
  const paths = getNpmrcPaths();

  // Check if project .npmrc uses token interpolation
  const projectUsesEnvVar = paths.project
    ? await fileContains(paths.project, NPM_TOKEN_INTERPOLATION)
    : false;

  // Determine effective token
  const effectiveToken = envToken || npmrcToken;

  // Check npm whoami
  let npmUser: string | undefined;
  try {
    const { stdout } = await execa('npm', ['whoami'], { stdio: 'pipe' });
    npmUser = stdout.trim();
  } catch {
    npmUser = undefined;
  }

  if (options.json) {
    writeJson({
      authenticated: !!npmUser,
      user: npmUser ?? null,
      tokenSource: envToken ? 'env' : npmrcToken ? 'npmrc' : null,
      tokenMasked: effectiveToken ? maskToken(effectiveToken) : null,
      revvaultConfigured: !!vaultValue,
      projectNpmrcUsesEnvVar: projectUsesEnvVar,
      paths: {
        userNpmrc: paths.user,
        projectNpmrc: paths.project,
      },
    });
    return;
  }

  logger.header('npm Authentication Status');

  if (npmUser) {
    logger.success(`Authenticated as: ${npmUser}`);
  } else {
    logger.error('Not authenticated  -  npm whoami failed');
  }

  write('\n');
  logger.info(
    `Token source: ${envToken ? '$NPM_TOKEN (env)' : npmrcToken ? '~/.npmrc (file)' : 'none'}`,
  );

  if (effectiveToken) {
    logger.info(`Token: ${maskToken(effectiveToken)}`);
  }

  write('\n');
  logger.info(
    `RevVault (${REVVAULT_NPM_PATH}): ${vaultValue ? 'configured' : hasVault ? 'not set' : 'revvault not installed'}`,
  );
  logger.info(`Project .npmrc uses NPM_TOKEN: ${projectUsesEnvVar ? 'yes' : 'no'}`);

  if (!projectUsesEnvVar && paths.project) {
    logger.warn(
      "Project .npmrc does not reference NPM_TOKEN  -  direnv/RevVault tokens won't be used for publishing",
    );
  }

  if (!vaultValue && hasVault && effectiveToken) {
    logger.warn('Token is not stored in RevVault. Run: revealui auth set-token to persist it.');
  }
}

// ---------------------------------------------------------------------------
// revealui auth set-token
// ---------------------------------------------------------------------------

export async function runAuthSetTokenCommand(options: {
  token?: string;
  skipVault?: boolean;
  skipNpmrc?: boolean;
}): Promise<void> {
  logger.header('Set npm Publish Token');

  const token = options.token || process.env.NPM_TOKEN;

  if (!token) {
    logger.error('No token provided. Pass --token <value> or set NPM_TOKEN in your environment.');
    logger.info('Create a Granular Access Token at: https://www.npmjs.com/settings/<user>/tokens');
    logger.info('  Type: Granular Access Token');
    logger.info('  Packages: All packages (read and write)');
    logger.info('  This bypasses 2FA  -  no OTP needed for publish');
    process.exitCode = 1;
    return;
  }

  if (!token.startsWith('npm_')) {
    logger.warn('Token does not start with "npm_"  -  this may not be a valid npm token');
  }

  // 1. Store in RevVault
  if (!options.skipVault) {
    const hasVault = await hasRevvault();
    if (hasVault) {
      const stored = await revvaultSet(REVVAULT_NPM_PATH, `NPM_TOKEN=${token}`);
      if (stored) {
        logger.success(`Stored in RevVault (${REVVAULT_NPM_PATH})`);
      } else {
        logger.error('Failed to store in RevVault');
      }
    } else {
      logger.warn('RevVault not installed  -  skipping vault storage');
    }
  }

  // 2. Ensure project .npmrc has token interpolation
  if (!options.skipNpmrc) {
    const paths = getNpmrcPaths();
    if (paths.project) {
      const hasInterpolation = await fileContains(paths.project, NPM_TOKEN_INTERPOLATION);
      if (!hasInterpolation) {
        try {
          const content = await fs.readFile(paths.project, 'utf-8');
          const updatedContent = `${content.trimEnd()}\n${NPMRC_AUTH_LINE}\n`;
          await fs.writeFile(paths.project, updatedContent, 'utf-8');
          logger.success(`Added NPM_TOKEN interpolation to ${paths.project}`);
        } catch (err) {
          logger.error(`Failed to update ${paths.project}: ${err}`);
        }
      } else {
        logger.info('Project .npmrc already uses NPM_TOKEN');
      }
    }
  }

  // 3. Remove any hardcoded token from ~/.npmrc (security hygiene)
  const userRc = path.join(os.homedir(), '.npmrc');
  try {
    const content = await fs.readFile(userRc, 'utf-8');
    const filtered = content
      .split('\n')
      .filter((line) => !line.includes('//registry.npmjs.org/:_authToken='))
      .join('\n');
    if (filtered !== content) {
      await fs.writeFile(userRc, filtered, 'utf-8');
      logger.success('Removed hardcoded token from ~/.npmrc (now managed via env var)');
    }
  } catch {
    // ~/.npmrc may not exist  -  fine
  }

  // 4. Verify
  write('\n');
  logger.info('Verifying...');

  // Export into current process for verification
  process.env.NPM_TOKEN = token;

  try {
    const { stdout } = await execa('npm', ['whoami'], { stdio: 'pipe' });
    logger.success(`Authenticated as: ${stdout.trim()}`);
  } catch {
    logger.error('npm whoami failed  -  token may be invalid or expired');
    process.exitCode = 1;
    return;
  }

  write('\n');
  logger.success('Token configured. Run `direnv reload` to load it in all terminals.');
}

// ---------------------------------------------------------------------------
// revealui auth verify
// ---------------------------------------------------------------------------

export async function runAuthVerifyCommand(options: { json?: boolean }): Promise<void> {
  const checks: Array<{ name: string; pass: boolean; detail: string }> = [];

  // 1. npm whoami
  let npmUser: string | undefined;
  try {
    const { stdout } = await execa('npm', ['whoami'], { stdio: 'pipe' });
    npmUser = stdout.trim();
    checks.push({ name: 'npm whoami', pass: true, detail: npmUser });
  } catch {
    checks.push({
      name: 'npm whoami',
      pass: false,
      detail: 'Not authenticated',
    });
  }

  // 2. Token source
  const envToken = await getTokenFromEnv();
  const npmrcToken = await getTokenFromNpmrc();
  const source = envToken ? '$NPM_TOKEN (env)' : npmrcToken ? '~/.npmrc (hardcoded)' : 'none';
  checks.push({
    name: 'Token source',
    pass: !!envToken,
    detail: source + (npmrcToken && !envToken ? '  -  consider migrating to RevVault' : ''),
  });

  // 3. RevVault
  const hasVault = await hasRevvault();
  if (hasVault) {
    const vaultValue = await revvaultGet(REVVAULT_NPM_PATH);
    checks.push({
      name: 'RevVault',
      pass: !!vaultValue,
      detail: vaultValue ? `${REVVAULT_NPM_PATH} configured` : 'Not stored in vault',
    });
  }

  // 4. Project .npmrc interpolation
  const paths = getNpmrcPaths();
  if (paths.project) {
    const usesEnvVar = await fileContains(paths.project, NPM_TOKEN_INTERPOLATION);
    checks.push({
      name: '.npmrc NPM_TOKEN',
      pass: usesEnvVar,
      detail: usesEnvVar
        ? 'Project .npmrc uses env var'
        : "Missing  -  direnv token won't reach npm",
    });
  }

  // 5. .envrc loads npm group
  const envrcPath = path.join(process.cwd(), '.envrc');
  const loadsNpm = await fileContains(envrcPath, REVVAULT_NPM_PATH);
  checks.push({
    name: '.envrc loads npm',
    pass: loadsNpm,
    detail: loadsNpm ? 'revealui/env/npm in .envrc' : "Missing  -  direnv won't export NPM_TOKEN",
  });

  // 6. No hardcoded token in ~/.npmrc
  const hardcodedToken = await getTokenFromNpmrc();
  checks.push({
    name: '~/.npmrc clean',
    pass: !hardcodedToken,
    detail: hardcodedToken
      ? `Hardcoded token found (${maskToken(hardcodedToken)})`
      : 'No hardcoded tokens',
  });

  if (options.json) {
    const allPass = checks.every((c) => c.pass);
    writeJson({ pass: allPass, checks });
    return;
  }

  logger.header('npm Auth Verification');

  for (const check of checks) {
    if (check.pass) {
      logger.success(`${check.name}: ${check.detail}`);
    } else {
      logger.error(`${check.name}: ${check.detail}`);
    }
  }

  const allPass = checks.every((c) => c.pass);
  write('\n');
  if (allPass) {
    logger.success('All checks passed  -  ready to publish');
  } else {
    logger.warn('Some checks failed. Run `revealui auth set-token` to fix.');
    process.exitCode = 1;
  }
}
