/**
 * Environment secret and password generators
 */

import { randomBytes } from 'node:crypto';

/**
 * Generates a secure random secret.
 *
 * @param length - Length in bytes (default: 32 bytes = 64 hex chars)
 * @returns Hex-encoded random secret
 *
 * @example
 * ```typescript
 * const secret = generateSecret() // 64 char hex string
 * ```
 */
export function generateSecret(length = 32): string {
  return randomBytes(length).toString('hex');
}

/**
 * Generates a secure password with alphanumeric and special characters.
 *
 * @param length - Password length (default: 16)
 * @returns Random password
 *
 * @example
 * ```typescript
 * const password = generatePassword(16) // e.g., "aB3!xY9@pQ5#mN7$"
 * ```
 */
export function generatePassword(length = 16): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  const randomValues = randomBytes(length);
  for (let i = 0; i < length; i++) {
    password += chars[randomValues[i] % chars.length];
  }
  return password;
}

/**
 * Updates a value in environment file content.
 *
 * @param content - Original env file content
 * @param key - Environment variable name
 * @param value - New value
 * @returns Updated env file content
 *
 * @example
 * ```typescript
 * const updated = updateEnvValue(content, 'DB_URL', 'postgresql://...')
 * ```
 */
export function updateEnvValue(content: string, key: string, value: string): string {
  const regex = new RegExp(`^${key}=.*$`, 'm');

  if (regex.test(content)) {
    // Replace existing value
    return content.replace(regex, `${key}=${value}`);
  }

  // Add new line at the end
  return `${content.trimEnd()}\n${key}=${value}\n`;
}

/**
 * Parses environment file content into key-value pairs.
 *
 * @param content - Environment file content
 * @returns Parsed environment variables
 *
 * @example
 * ```typescript
 * const env = parseEnvContent('DB_URL=postgresql://...\nAPI_KEY=abc123')
 * // { DB_URL: 'postgresql://...', API_KEY: 'abc123' }
 * ```
 */
export function parseEnvContent(content: string): Record<string, string> {
  const env: Record<string, string> = {};
  const lines = content.split('\n');

  for (const line of lines) {
    // Skip comments and empty lines
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Parse key=value
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const [, key, value] = match;
      env[key.trim()] = value.trim();
    }
  }

  return env;
}
