#!/usr/bin/env tsx

/**
 * Environment Setup Script
 *
 * Sets up environment variables for the project by:
 * 1. Copying .env.template to .env.development.local (if not exists)
 * 2. Auto-generating all secrets (REVEALUI_SECRET, draft secret, revalidation key, admin password)
 * 3. Applying safe localhost defaults for all URL/flag variables
 * 4. Prompting for external credentials (POSTGRES_URL, Stripe, Blob) — skippable
 *
 * @dependencies
 * - scripts/lib/errors.ts - ErrorCode enum for exit codes
 * - scripts/lib/index.ts - Environment utilities, logger, file operations
 * - node:crypto - Secure random generation for secrets
 * - node:fs/promises - File system operations
 * - node:path - Path manipulation utilities
 *
 * Usage:
 *   pnpm setup:env
 *   pnpm setup:env --force     # Overwrite existing .env.development.local
 *   pnpm setup:env --generate  # Non-interactive: only generate secrets + apply defaults
 */

import { randomBytes, randomInt } from 'node:crypto';
import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ErrorCode } from '@revealui/scripts/errors.js';
import {
  confirm,
  createLogger,
  devEnvFileExists,
  envFileExists,
  fileExists,
  getProjectRoot,
  prompt,
} from '@revealui/scripts/index.js';

const logger = createLogger({ prefix: 'Setup' });

interface SetupOptions {
  force: boolean;
  generateOnly: boolean;
}

function parseArgs(): SetupOptions {
  const args = process.argv.slice(2);
  return {
    force: args.includes('--force') || args.includes('-f'),
    generateOnly: args.includes('--generate') || args.includes('-g'),
  };
}

// Variables that can be generated automatically from crypto
const AUTO_GENERATE: Record<string, () => string> = {
  REVEALUI_SECRET: () => generateSecret(32),
  REVEALUI_PUBLIC_DRAFT_SECRET: () => generateSecret(32),
  REVEALUI_REVALIDATION_KEY: () => generateSecret(32),
  REVEALUI_ADMIN_PASSWORD: () => generatePassword(16),
};

// Safe localhost defaults for local development
const DEV_DEFAULTS: Record<string, string> = {
  REVEALUI_PUBLIC_SERVER_URL: 'http://localhost:4000',
  NEXT_PUBLIC_SERVER_URL: 'http://localhost:4000',
  REVEALUI_API_URL: 'http://localhost:3004',
  NEXT_PUBLIC_API_URL: 'http://localhost:3004',
  NEXT_PUBLIC_CMS_URL: 'http://localhost:4000',
  VITE_API_URL: 'http://localhost:3004',
  API_URL: 'http://localhost:3004',
  REVEALUI_ADMIN_EMAIL: 'admin@localhost.dev',
  LOG_LEVEL: 'debug',
  LLM_PROVIDER: 'ollama',
  LLM_ENABLE_CACHE: 'true',
  LLM_ENABLE_RESPONSE_CACHE: 'true',
  LLM_ENABLE_SEMANTIC_CACHE: 'true',
  REVEALUI_PUBLIC_STRIPE_IS_TEST_KEY: 'true',
  NEXT_PUBLIC_IS_LIVE: 'false',
  STRIPE_PROXY: '0',
  SKIP_ONINIT: 'false',
  NODE_ENV: 'development',
};

// External credentials that require a real account — skippable during setup
const PROMPT_VARS: Array<{ name: string; description: string; hint: string }> = [
  {
    name: 'POSTGRES_URL',
    description: 'PostgreSQL connection string',
    hint: 'postgresql://user:pass@host/db?sslmode=require',
  },
  {
    name: 'STRIPE_SECRET_KEY',
    description: 'Stripe secret key',
    hint: 'sk_test_...',
  },
  {
    name: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    description: 'Stripe publishable key',
    hint: 'pk_test_...',
  },
  {
    name: 'BLOB_READ_WRITE_TOKEN',
    description: 'Vercel Blob token',
    hint: 'vercel_blob_rw_...',
  },
];

/**
 * Returns true if a value looks like an unfilled template placeholder.
 */
function isPlaceholder(value: string): boolean {
  return (
    value.includes('your-') ||
    value.includes('xxxxxxx') ||
    value.includes('user:password') ||
    value === '' ||
    value.startsWith('your-') ||
    (value.endsWith('-placeholder') &&
      isAlphanumericDashUnderscore(value.slice(0, -'-placeholder'.length)))
  );
}

/**
 * Check if a string contains only alphanumeric, dash, or underscore characters.
 */
function isAlphanumericDashUnderscore(s: string): boolean {
  if (s.length === 0) return false;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    const isAlphaNum =
      (c >= 48 && c <= 57) || // 0-9
      (c >= 65 && c <= 90) || // A-Z
      (c >= 97 && c <= 122); // a-z
    const isDashOrUnderscore = c === 45 || c === 95; // - or _
    if (!(isAlphaNum || isDashOrUnderscore)) return false;
  }
  return true;
}

/**
 * Generates a secure random hex secret.
 */
function generateSecret(length = 32): string {
  return randomBytes(length).toString('hex');
}

/**
 * Generates a secure random password with alphanumeric and special characters.
 */
function generatePassword(length = 16): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars[randomInt(chars.length)];
  }
  return password;
}

/**
 * Updates a value in the env file content string.
 */
function updateEnvValue(content: string, key: string, value: string): string {
  const newLine = `${key}=${value}`;
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith(`${key}=`)) {
      lines[i] = newLine;
      return lines.join('\n');
    }
  }
  return `${content.trimEnd()}\n${newLine}\n`;
}

/**
 * Main setup function.
 */
async function setupEnvironment() {
  const options = parseArgs();
  const projectRoot = await getProjectRoot(import.meta.url);

  logger.header('Environment Setup');

  const templatePath = join(projectRoot, '.env.template');
  const devLocalPath = join(projectRoot, '.env.development.local');
  const envPath = join(projectRoot, '.env');

  // Check if template exists
  if (!(await fileExists(templatePath))) {
    logger.error('.env.template not found!');
    logger.info('Please ensure .env.template exists in the project root.');
    process.exit(ErrorCode.EXECUTION_ERROR);
  }

  // Check if .env.development.local already exists
  const devLocalExists = await devEnvFileExists(import.meta.url);

  if (devLocalExists && !options.force) {
    logger.warn('.env.development.local already exists');
    const overwrite = await confirm('Overwrite existing file?');
    if (!overwrite) {
      logger.info('Setup cancelled. Use --force to overwrite.');
      return;
    }
  }

  // Copy template as starting point
  logger.info('Copying .env.template to .env.development.local...');
  await copyFile(templatePath, devLocalPath);
  logger.success('Template copied');

  let envContent = await readFile(devLocalPath, 'utf-8');
  const generated: string[] = [];
  const defaulted: string[] = [];
  const skipped: string[] = [];

  // Pass 1: Auto-generate secrets
  logger.info('Generating secrets...');
  for (const [key, generator] of Object.entries(AUTO_GENERATE)) {
    const value = generator();
    envContent = updateEnvValue(envContent, key, value);
    generated.push(key);
    logger.success(`  Generated ${key}`);
  }

  // Pass 2: Apply localhost defaults (only if value looks like a placeholder)
  const currentEnv = parseEnvContent(envContent);
  for (const [key, defaultVal] of Object.entries(DEV_DEFAULTS)) {
    const existing = currentEnv[key];
    if (!existing || isPlaceholder(existing)) {
      envContent = updateEnvValue(envContent, key, defaultVal);
      defaulted.push(key);
    }
  }
  logger.success(`Applied ${defaulted.length} development defaults`);

  // Pass 3: Prompt for external credentials (skipped in --generate mode)
  if (!options.generateOnly) {
    const refreshedEnv = parseEnvContent(envContent);
    if (PROMPT_VARS.some((v) => isPlaceholder(refreshedEnv[v.name] ?? ''))) {
      logger.info('');
      logger.info('External credentials (press Enter to skip and fill in later):');
      logger.divider();
    }

    for (const variable of PROMPT_VARS) {
      const current = refreshedEnv[variable.name] ?? '';
      if (!isPlaceholder(current)) {
        // Already set to a real value — don't overwrite
        continue;
      }

      logger.info(`${variable.name}: ${variable.description}`);
      logger.info(`  Example: ${variable.hint}`);
      const value = await prompt('  Enter value (or press Enter to skip): ');

      if (value.trim()) {
        envContent = updateEnvValue(envContent, variable.name, value.trim());
        generated.push(variable.name);
        logger.success(`  Set ${variable.name}`);
      } else {
        skipped.push(variable.name);
        logger.warn(`  Skipped ${variable.name}`);
      }
      logger.info('');
    }
  } else {
    // In generate-only mode, mark prompt vars as skipped if still placeholders
    const refreshedEnv = parseEnvContent(envContent);
    for (const variable of PROMPT_VARS) {
      if (isPlaceholder(refreshedEnv[variable.name] ?? '')) {
        skipped.push(variable.name);
      }
    }
  }

  // Write the final file once
  await writeFile(devLocalPath, envContent);

  // Also create .env if it doesn't exist
  if (!(await envFileExists(import.meta.url))) {
    await copyFile(devLocalPath, envPath);
    logger.success('.env file created');
  }

  // Summary
  logger.divider();
  logger.success(`Generated (${generated.length}): ${generated.join(', ')}`);
  if (defaulted.length > 0) {
    logger.success(`Defaulted (${defaulted.length}): ${defaulted.join(', ')}`);
  }
  if (skipped.length > 0) {
    logger.warn(`Still needed (${skipped.length}): ${skipped.join(', ')}`);
    logger.info('  Edit .env.development.local to add the missing values.');
  }

  logger.divider();

  if (skipped.length === 0) {
    logger.success('Environment setup complete! Run: pnpm dev');
  } else {
    logger.info(`Setup complete with ${skipped.length} credential(s) still needed.`);
    logger.info('The app will start but features requiring those credentials will be unavailable.');
    logger.info('Run: pnpm dev');
  }
}

/**
 * Parses env file content string into key-value pairs (inline, no fs).
 */
function parseEnvContent(content: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.substring(0, eqIndex).trim();
    let value = trimmed.substring(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

// Run setup
setupEnvironment().catch((error) => {
  logger.error(`Setup failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(ErrorCode.EXECUTION_ERROR);
});
