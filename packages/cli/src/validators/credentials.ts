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
