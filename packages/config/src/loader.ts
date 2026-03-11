/**
 * @revealui/config - Environment-Aware Loader
 *
 * Loads environment variables based on NODE_ENV with proper fallback chain
 */

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// =============================================================================
// Environment Detection
// =============================================================================

export type Environment = 'development' | 'production' | 'test';

export function detectEnvironment(): Environment {
  const nodeEnv = process.env.NODE_ENV;

  if (nodeEnv === 'production') {
    return 'production';
  }
  if (nodeEnv === 'test') {
    return 'test';
  }
  return 'development';
}

// =============================================================================
// File Loading
// =============================================================================

/**
 * Get project root directory (assumes packages/config structure)
 *
 * Uses multiple strategies to find the project root:
 * 1. Try relative path from __dirname (works in source)
 * 2. Try process.cwd() (works when running from project root)
 * 3. Walk up from __dirname looking for package.json or .env.template
 */
function getProjectRoot(): string {
  // Strategy 1: Try relative path from __dirname (works in source/development)
  const relativePath = resolve(__dirname, '../../../..');
  if (
    existsSync(resolve(relativePath, '.env.template')) ||
    existsSync(resolve(relativePath, '.env'))
  ) {
    return relativePath;
  }

  // Strategy 2: Walk up from __dirname looking for .env.template or .env (most reliable)
  // This works even when bundled by Turbopack
  let current = __dirname;
  for (let i = 0; i < 10; i++) {
    // Check for .env.template first (definitive marker of project root)
    if (existsSync(resolve(current, '.env.template'))) {
      return current;
    }
    // Also check for .env file (project root has it, app directories usually don't)
    if (existsSync(resolve(current, '.env')) && !existsSync(resolve(current, 'next.config'))) {
      return current;
    }
    const parent = resolve(current, '..');
    if (parent === current) break; // Reached filesystem root
    current = parent;
  }

  // Strategy 3: Walk up from process.cwd() (works when running from app directory)
  const cwd = process.cwd();
  let cwdCurrent = cwd;
  for (let i = 0; i < 10; i++) {
    if (
      existsSync(resolve(cwdCurrent, '.env.template')) ||
      (existsSync(resolve(cwdCurrent, '.env')) && !existsSync(resolve(cwdCurrent, 'next.config')))
    ) {
      return cwdCurrent;
    }
    const parent = resolve(cwdCurrent, '..');
    if (parent === cwdCurrent) break;
    cwdCurrent = parent;
  }

  // Fallback: return relative path (might work in some cases)
  return relativePath;
}

/**
 * Load environment variables from files based on environment
 */
export function loadEnvFiles(env: Environment): Record<string, string> {
  const projectRoot = getProjectRoot();
  const loaded: Record<string, string> = {};

  if (env === 'production') {
    // Production: Only use process.env, no file loading
    return {};
  }

  if (env === 'test') {
    // Test: Try .env.test.local, then .env.test
    const testLocal = resolve(projectRoot, '.env.test.local');
    const testFile = resolve(projectRoot, '.env.test');

    if (existsSync(testLocal)) {
      const result = config({ path: testLocal });
      if (result.parsed) {
        Object.assign(loaded, result.parsed);
      }
    } else if (existsSync(testFile)) {
      const result = config({ path: testFile });
      if (result.parsed) {
        Object.assign(loaded, result.parsed);
      }
    }

    return loaded;
  }

  // Development: Try .env.development.local, .env.local, .env (in order)
  const devLocal = resolve(projectRoot, '.env.development.local');
  const envLocal = resolve(projectRoot, '.env.local');
  const envFile = resolve(projectRoot, '.env');

  if (existsSync(devLocal)) {
    const result = config({ path: devLocal });
    if (result.parsed) {
      Object.assign(loaded, result.parsed);
    }
  } else if (existsSync(envLocal)) {
    const result = config({ path: envLocal });
    if (result.parsed) {
      Object.assign(loaded, result.parsed);
    }
  } else if (existsSync(envFile)) {
    const result = config({ path: envFile });
    if (result.parsed) {
      Object.assign(loaded, result.parsed);
    }
  }

  return loaded;
}

// =============================================================================
// Environment Variable Merging
// =============================================================================

/**
 * Merge environment variables with proper precedence:
 * 1. process.env (highest priority)
 * 2. File-loaded variables (lower priority)
 */
export function mergeEnvVars(
  fileVars: Record<string, string>,
  processEnv: NodeJS.ProcessEnv,
): Record<string, string> {
  const merged: Record<string, string> = {};

  // First, add file-loaded variables
  for (const [key, value] of Object.entries(fileVars)) {
    if (value !== undefined && value !== null) {
      merged[key] = value;
    }
  }

  // Then, override with process.env (process.env wins)
  for (const [key, value] of Object.entries(processEnv)) {
    if (value !== undefined && value !== null) {
      merged[key] = value;
    }
  }

  return merged;
}

// =============================================================================
// Database URL Fallback
// =============================================================================

/**
 * Handle POSTGRES_URL / DATABASE_URL fallback
 * Standardizes to POSTGRES_URL, but accepts DATABASE_URL as fallback
 */
export function normalizeDatabaseUrl(env: Record<string, string>): Record<string, string> {
  const normalized = { ...env };

  // If POSTGRES_URL is not set but DATABASE_URL is, use DATABASE_URL
  if (!normalized.POSTGRES_URL && normalized.DATABASE_URL) {
    normalized.POSTGRES_URL = normalized.DATABASE_URL;
  }

  return normalized;
}

// =============================================================================
// Main Loader Function
// =============================================================================

/**
 * Load and merge environment variables based on current environment
 */
export function loadEnvironment(): Record<string, string> {
  const env = detectEnvironment();
  const fileVars = loadEnvFiles(env);
  const merged = mergeEnvVars(fileVars, process.env);
  const normalized = normalizeDatabaseUrl(merged);

  return normalized;
}
