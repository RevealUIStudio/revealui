/**
 * @revealui/config - Runtime Validator
 *
 * Validates environment variables with detailed error messages
 */

import { z } from 'zod/v4';
import { detectEnvironment } from './loader.js';
import { type EnvConfig, envSchema, validateEnvironment } from './schema.js';

// =============================================================================
// Validation Result
// =============================================================================

export interface ValidationResult {
  success: boolean;
  config?: EnvConfig;
  errors: ValidationError[];
  warnings: string[];
}

export interface ValidationError {
  type: 'missing' | 'invalid' | 'format' | 'environment';
  variable?: string;
  message: string;
}

// =============================================================================
// Validation Function
// =============================================================================

/**
 * Validate environment variables and return detailed results
 */
export function validateEnvVars(env: Record<string, string>): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  // Check warnings before validation (so they appear even if validation fails)
  // Warnings for deprecated variables
  if (env.REVEALUI_WHITELISTORIGINS && !env.REVEALUI_CORS_ORIGINS) {
    warnings.push('REVEALUI_WHITELISTORIGINS is deprecated, use REVEALUI_CORS_ORIGINS instead');
  }

  // Handle DATABASE_URL → POSTGRES_URL fallback with warning
  let normalizedEnv = env;
  if (!env.POSTGRES_URL && env.DATABASE_URL) {
    warnings.push(
      'DATABASE_URL found without POSTGRES_URL  -  consider renaming to POSTGRES_URL (DATABASE_URL is used as fallback)',
    );
    normalizedEnv = { ...env, POSTGRES_URL: env.DATABASE_URL };
  }

  // Try to parse with Zod schema
  let config: EnvConfig;
  try {
    config = envSchema.parse(normalizedEnv);
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Handle Zod validation errors
      for (const issue of error.issues) {
        const path = issue.path.join('.');
        const variable = path || 'unknown';

        // Check if variable is missing (undefined) vs invalid (wrong type)
        const isMissing =
          issue.code === 'invalid_type' &&
          ((issue as { received?: string }).received === 'undefined' ||
            (issue as { received?: unknown }).received === undefined);

        if (isMissing) {
          errors.push({
            type: 'missing',
            variable,
            message: `${variable} is required but not set`,
          });
        } else {
          errors.push({
            type: 'invalid',
            variable,
            message: `${variable}: ${issue.message}`,
          });
        }
      }
    } else {
      errors.push({
        type: 'invalid',
        message: `Unexpected validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }

    return {
      success: false,
      errors,
      warnings,
    };
  }

  // Environment-specific validation
  const nodeEnv = detectEnvironment();
  const envValidation = validateEnvironment(config, nodeEnv);

  if (!envValidation.valid) {
    for (const errorMsg of envValidation.errors) {
      errors.push({
        type: 'environment',
        message: errorMsg,
      });
    }
  }

  const result: ValidationResult = {
    success: errors.length === 0,
    errors,
    warnings,
  };

  if (errors.length === 0) {
    result.config = config;
  }

  return result;
}

// =============================================================================
// Error Formatting
// =============================================================================

/**
 * Get caller information from stack trace
 */
function getCallerInfo(): { file?: string; line?: number } {
  const stack = new Error().stack;
  if (!stack) return {};

  const lines = stack.split('\n');
  // Find the first line that's not from this file or node internals
  for (const line of lines) {
    const match = line.match(/at .* \((.+):(\d+):\d+\)/) || line.match(/at (.+):(\d+):\d+/);
    if (match) {
      const file = match[1];
      // Skip node internals and this file
      if (
        file &&
        !file.includes('node:') &&
        !file.includes('validator.ts') &&
        !file.includes('index.ts')
      ) {
        return {
          file: file.replace(process.cwd(), '.').replace(/\\/g, '/'),
          line: parseInt(match[2] || '0', 10),
        };
      }
    }
  }
  return {};
}

/**
 * Format validation errors into a human-readable message with context
 */
export function formatValidationErrors(result: ValidationResult, includeStack = true): string {
  if (result.success) {
    return '✅ Environment validation passed';
  }

  const lines: string[] = [];
  lines.push('❌ Environment Configuration Error\n');

  // Add context about where the error occurred
  if (includeStack) {
    const caller = getCallerInfo();
    if (caller.file) {
      lines.push(`📍 Error occurred when accessing config from:`);
      lines.push(`   ${caller.file}${caller.line ? `:${caller.line}` : ''}\n`);
    }
  }

  // Group errors by type
  const missing = result.errors.filter((e) => e.type === 'missing');
  const invalid = result.errors.filter((e) => e.type === 'invalid');
  const format = result.errors.filter((e) => e.type === 'format');
  const environment = result.errors.filter((e) => e.type === 'environment');

  if (missing.length > 0) {
    lines.push('Missing required variables:');
    for (const error of missing) {
      lines.push(`  - ${error.variable || 'unknown'}: ${error.message}`);
    }
    lines.push('');
  }

  if (invalid.length > 0) {
    lines.push('Invalid variables:');
    for (const error of invalid) {
      lines.push(`  - ${error.variable || 'unknown'}: ${error.message}`);
    }
    lines.push('');
  }

  if (format.length > 0) {
    lines.push('Format errors:');
    for (const error of format) {
      lines.push(`  - ${error.variable || 'unknown'}: ${error.message}`);
    }
    lines.push('');
  }

  if (environment.length > 0) {
    lines.push('Environment-specific errors:');
    for (const error of environment) {
      lines.push(`  - ${error.message}`);
    }
    lines.push('');
  }

  if (result.warnings.length > 0) {
    lines.push('⚠️  Warnings:');
    for (const warning of result.warnings) {
      lines.push(`  - ${warning}`);
    }
    lines.push('');
  }

  lines.push('💡 Fix: See .env.template for required variables and documentation');
  lines.push('💡 Tip: Set SKIP_ENV_VALIDATION=true during builds if needed');

  return lines.join('\n');
}

// =============================================================================
// Validation with Error Throwing
// =============================================================================

/**
 * Validate environment variables and throw if invalid
 * Includes stack trace and caller information for better debugging
 */
export function validateAndThrow(env: Record<string, string>): EnvConfig {
  const result = validateEnvVars(env);

  if (!(result.success && result.config)) {
    const message = formatValidationErrors(result, true);
    const error = new Error(message);
    error.name = 'ConfigValidationError';
    // Preserve stack trace
    Error.captureStackTrace?.(error, validateAndThrow);
    throw error;
  }

  return result.config;
}
