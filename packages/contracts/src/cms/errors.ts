/**
 * Configuration Validation Errors
 *
 * Provides detailed error reporting for config validation failures.
 * Errors include:
 * - Specific field paths that failed
 * - Human-readable error messages
 * - Links to documentation
 *
 * @module @revealui/contracts/core/contracts/errors
 */

import type { ZodError, ZodIssue } from 'zod/v4';

/**
 * Configuration validation error with detailed diagnostics
 */
export class ConfigValidationError extends Error {
  /** All validation issues found */
  public readonly issues: ZodIssue[];
  /** Type of configuration being validated */
  public readonly configType: 'collection' | 'global' | 'field' | 'config';
  /** Name/slug of the config (if available) */
  public readonly configName?: string;
  /** The original Zod error */
  public readonly zodError: ZodError;

  constructor(
    error: ZodError,
    configType: 'collection' | 'global' | 'field' | 'config',
    configName?: string,
  ) {
    const message = ConfigValidationError.formatMessage(error, configType, configName);
    super(message);
    this.name = 'ConfigValidationError';
    this.issues = error.issues;
    this.configType = configType;
    if (configName !== undefined) {
      this.configName = configName;
    }
    this.zodError = error;

    // Maintains proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ConfigValidationError);
    }
  }

  /**
   * Format error message with all issues
   */
  static formatMessage(error: ZodError, configType: string, configName?: string): string {
    const header = configName
      ? `Invalid ${configType} configuration "${configName}":`
      : `Invalid ${configType} configuration:`;

    const issueLines = error.issues.map((issue, i) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
      return `  ${i + 1}. [${path}] ${issue.message}`;
    });

    const docsUrl = ConfigValidationError.getDocsUrl(configType);

    return [header, '', ...issueLines, '', `See ${docsUrl} for valid configuration options.`].join(
      '\n',
    );
  }

  /**
   * Get documentation URL for config type
   */
  static getDocsUrl(configType: string): string {
    const baseUrl = 'https://revealui.dev/docs';
    switch (configType) {
      case 'collection':
        return `${baseUrl}/api-reference/collections`;
      case 'global':
        return `${baseUrl}/api-reference/globals`;
      case 'field':
        return `${baseUrl}/api-reference/fields`;
      default:
        return `${baseUrl}/api-reference/config`;
    }
  }

  /**
   * Get a specific issue by path
   */
  getIssue(path: string): ZodIssue | undefined {
    return this.issues.find((issue) => issue.path.join('.') === path);
  }

  /**
   * Get all issues for a specific path prefix
   */
  getIssuesForPath(pathPrefix: string): ZodIssue[] {
    return this.issues.filter((issue) => issue.path.join('.').startsWith(pathPrefix));
  }

  /**
   * Check if a specific field has an error
   */
  hasFieldError(fieldName: string): boolean {
    return this.issues.some((issue) => issue.path.includes(fieldName));
  }

  /**
   * Get error messages as a simple array of strings
   */
  getMessages(): string[] {
    return this.issues.map((issue) => {
      const path = issue.path.length > 0 ? `[${issue.path.join('.')}] ` : '';
      return `${path}${issue.message}`;
    });
  }

  /**
   * Convert to a plain object for serialization
   */
  toJSON(): {
    name: string;
    message: string;
    configType: string;
    configName?: string;
    issues: Array<{
      path: (string | number)[];
      message: string;
      code: string;
    }>;
  } {
    return {
      name: this.name,
      message: this.message,
      configType: this.configType,
      ...(this.configName && { configName: this.configName }),
      issues: this.issues.map((issue) => ({
        path: issue.path as (string | number)[],
        message: issue.message,
        code: issue.code as string,
      })),
    };
  }
}

/**
 * Result type for validation operations
 */
export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: ConfigValidationError };

/**
 * Validate data against a Zod schema with detailed error reporting
 *
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @param configType - Type of config for error messages
 * @param configName - Optional name/slug for error messages
 * @returns Validated data
 * @throws {ConfigValidationError} If validation fails
 *
 * @example
 * ```typescript
 * const config = validateWithErrors(
 *   CollectionStructureSchema,
 *   userInput,
 *   'collection',
 *   userInput.slug
 * );
 * ```
 */
export function validateWithErrors<T>(
  schema: {
    safeParse: (data: unknown) => {
      success: boolean;
      data?: T;
      error?: ZodError;
    };
  },
  data: unknown,
  configType: 'collection' | 'global' | 'field' | 'config',
  configName?: string,
): T {
  const result = schema.safeParse(data);

  if (!result.success) {
    throw new ConfigValidationError(result.error as ZodError, configType, configName);
  }

  return result.data as T;
}

/**
 * Safe validation that returns a result object instead of throwing
 *
 * @example
 * ```typescript
 * const result = safeValidate(CollectionStructureSchema, userInput, 'collection');
 * if (result.success) {
 *   console.log(result.data);
 * } else {
 *   console.error(result.error.getMessages());
 * }
 * ```
 */
export function safeValidate<T>(
  schema: {
    safeParse: (data: unknown) => {
      success: boolean;
      data?: T;
      error?: ZodError;
    };
  },
  data: unknown,
  configType: 'collection' | 'global' | 'field' | 'config',
  configName?: string,
): ValidationResult<T> {
  const result = schema.safeParse(data);

  if (!result.success) {
    return {
      success: false,
      error: new ConfigValidationError(result.error as ZodError, configType, configName),
    };
  }

  return { success: true, data: result.data as T };
}
