/**
 * API credential validation
 */

import { createLogger } from '@revealui/setup/utils';

const logger = createLogger({ prefix: 'Validator' });

export interface CredentialValidation {
  valid: boolean;
  message?: string;
}

export function validateStripeKey(key: string): CredentialValidation {
  if (!(key.startsWith('sk_test_') || key.startsWith('sk_live_'))) {
    return {
      valid: false,
      message: 'Stripe key must start with sk_test_ or sk_live_',
    };
  }
  // Basic validation - full validation would require API call
  return { valid: true };
}

export function validateNeonUrl(url: string): CredentialValidation {
  try {
    const parsed = new URL(url);
    if (!parsed.protocol.startsWith('postgres')) {
      return {
        valid: false,
        message: 'Database URL must use postgres:// or postgresql:// protocol',
      };
    }
    return { valid: true };
  } catch {
    return {
      valid: false,
      message: 'Invalid database URL format',
    };
  }
}

export function validateVercelToken(token: string): CredentialValidation {
  if (!token || token.length < 20) {
    return {
      valid: false,
      message: 'Vercel token appears invalid (too short)',
    };
  }
  return { valid: true };
}

export function validateSupabaseUrl(url: string): CredentialValidation {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('supabase')) {
      logger.warn('URL does not appear to be a Supabase URL');
    }
    return { valid: true };
  } catch {
    return {
      valid: false,
      message: 'Invalid Supabase URL format',
    };
  }
}

// =============================================================================
// Cloudflare R2 (canonical object-storage backend)
// =============================================================================

/**
 * Validates the R2 public base URL — the address objects are served from
 * (a bound custom domain like https://media.example.com, or the dev URL
 * https://<account-id>.r2.cloudflarestorage.com/<bucket>). Required by the
 * R2 storage provider, so this is the credential most worth checking.
 */
export function validateR2PublicBaseUrl(url: string): CredentialValidation {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, message: 'R2 public base URL must use http:// or https://' };
    }
    return { valid: true };
  } catch {
    return {
      valid: false,
      message:
        'R2 public base URL must be a valid URL (e.g. https://media.example.com or ' +
        'https://<account-id>.r2.cloudflarestorage.com/<bucket>)',
    };
  }
}

// Allowed characters in an S3/R2 bucket name. Set lookup keeps this regex-free
// per the fleet no-regex rule.
const R2_BUCKET_CHARS = new Set('abcdefghijklmnopqrstuvwxyz0123456789-.');

/**
 * Validates an R2 (S3-compatible) bucket name: 3–63 chars, lowercase letters,
 * digits, hyphens, and dots, starting and ending with a letter or digit.
 */
export function validateR2BucketName(name: string): CredentialValidation {
  const value = name.trim();
  if (value.length < 3 || value.length > 63) {
    return { valid: false, message: 'R2 bucket name must be 3–63 characters' };
  }
  if (![...value].every((char) => R2_BUCKET_CHARS.has(char))) {
    return {
      valid: false,
      message: 'R2 bucket name may contain only lowercase letters, digits, hyphens, and dots',
    };
  }
  const first = value[0];
  const last = value[value.length - 1];
  if (first === '-' || first === '.' || last === '-' || last === '.') {
    return { valid: false, message: 'R2 bucket name must start and end with a letter or digit' };
  }
  return { valid: true };
}

export function validateNpmToken(token: string): CredentialValidation {
  if (!token.startsWith('npm_')) {
    return {
      valid: false,
      message: 'npm token must start with npm_',
    };
  }
  if (token.length < 20) {
    return {
      valid: false,
      message: 'npm token appears invalid (too short)',
    };
  }
  return { valid: true };
}

export function validateOpenAIKey(key: string): CredentialValidation {
  if (!key.startsWith('sk-')) {
    return {
      valid: false,
      message: 'OpenAI key must start with sk-',
    };
  }
  return { valid: true };
}
