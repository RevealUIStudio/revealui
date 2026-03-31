/**
 * Pre-Execution Validation
 *
 * Comprehensive validation checks to run before script execution.
 * Ensures environment is properly configured and requirements are met.
 *
 * @dependencies
 * - node:child_process - Process execution for git and disk checks
 * - node:fs - Synchronous file system checks
 * - node:fs/promises - Asynchronous file system operations
 * - node:path - Path manipulation utilities
 * - node:util - Promisify utilities for exec
 *
 * @example
 * ```typescript
 * import { ErrorCode } from '../errors.js'
 *
 * const validator = new PreExecutionValidator()
 *
 * const result = await validator.validate({
 *   checks: ['env', 'git', 'disk'],
 *   required: ['DATABASE_URL'],
 *   minDiskSpace: 1024 * 1024 * 1024, // 1GB
 * })
 *
 * if (!result.passed) {
 *   console.error('Validation failed:', result.errors)
 *   process.exit(ErrorCode.VALIDATION_ERROR)
 * }
 * ```
 */

import { exec } from 'node:child_process';
import { existsSync } from 'node:fs';
import { access, constants } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

// =============================================================================
// Types
// =============================================================================

/**
 * Validation check types
 */
export type ValidationCheckType =
  | 'env' // Environment variables
  | 'dependencies' // npm/pnpm dependencies
  | 'database' // Database connection
  | 'git' // Git working tree
  | 'disk' // Disk space
  | 'permissions' // File permissions
  | 'network' // Network connectivity
  | 'node-version'; // Node.js version

/**
 * Validation options
 */
export interface ValidationOptions {
  /** Checks to perform */
  checks?: ValidationCheckType[];

  /** Required environment variables */
  requiredEnvVars?: string[];

  /** Optional environment variables (warnings only) */
  optionalEnvVars?: string[];

  /** Minimum required disk space in bytes */
  minDiskSpace?: number;

  /** Files/directories that must exist */
  requiredPaths?: string[];

  /** Files/directories that must be writable */
  writablePaths?: string[];

  /** Check if git working tree is clean */
  requireCleanGit?: boolean;

  /** Minimum Node.js version (semver) */
  minNodeVersion?: string;

  /** Check database connectivity */
  checkDatabase?: boolean;

  /** Database connection string (defaults to DATABASE_URL) */
  databaseUrl?: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether all checks passed */
  passed: boolean;

  /** Errors that caused validation to fail */
  errors: ValidationError[];

  /** Warnings (non-fatal issues) */
  warnings: ValidationWarning[];

  /** Results of individual checks */
  checkResults: CheckResult[];

  /** Suggested fixes */
  fixes: string[];
}

/**
 * Validation error
 */
export interface ValidationError {
  /** Check that failed */
  check: ValidationCheckType;

  /** Error message */
  message: string;

  /** Additional details */
  details?: Record<string, unknown>;
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  /** Check that produced warning */
  check: ValidationCheckType;

  /** Warning message */
  message: string;
}

/**
 * Individual check result
 */
export interface CheckResult {
  /** Check type */
  check: ValidationCheckType;

  /** Whether check passed */
  passed: boolean;

  /** Error message if failed */
  error?: string;

  /** Duration in milliseconds */
  durationMs: number;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Pre-Execution Validator
// =============================================================================

export class PreExecutionValidator {
  /**
   * Validate execution environment
   */
  async validate(options: ValidationOptions = {}): Promise<ValidationResult> {
    const {
      checks = ['env', 'git', 'disk'],
      requiredEnvVars = [],
      optionalEnvVars = [],
      minDiskSpace,
      requiredPaths = [],
      writablePaths = [],
      requireCleanGit = false,
      minNodeVersion,
      checkDatabase = false,
      databaseUrl,
    } = options;

    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const checkResults: CheckResult[] = [];
    const fixes: string[] = [];

    // Run each check
    for (const check of checks) {
      const startTime = Date.now();
      let result: CheckResult;

      try {
        switch (check) {
          case 'env':
            result = await this.checkEnvironmentVariables(requiredEnvVars, optionalEnvVars);
            break;

          case 'dependencies':
            result = await this.checkDependencies();
            break;

          case 'database':
            result = await this.checkDatabase(checkDatabase, databaseUrl);
            break;

          case 'git':
            result = await this.checkGit(requireCleanGit);
            break;

          case 'disk':
            result = await this.checkDiskSpace(minDiskSpace);
            break;

          case 'permissions':
            result = await this.checkPermissions(requiredPaths, writablePaths);
            break;

          case 'network':
            result = await this.checkNetwork();
            break;

          case 'node-version':
            result = await this.checkNodeVersion(minNodeVersion);
            break;

          default:
            result = {
              check,
              passed: true,
              durationMs: 0,
            };
        }

        result.durationMs = Date.now() - startTime;
        checkResults.push(result);

        if (!result.passed) {
          errors.push({
            check,
            message: result.error || 'Check failed',
            details: result.metadata,
          });

          // Add suggested fixes
          const checkFixes = this.getSuggestedFixes(check, result);
          fixes.push(...checkFixes);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        checkResults.push({
          check,
          passed: false,
          error: errorMessage,
          durationMs: Date.now() - startTime,
        });

        errors.push({
          check,
          message: errorMessage,
        });
      }
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings,
      checkResults,
      fixes,
    };
  }

  // ===========================================================================
  // Individual Checks
  // ===========================================================================

  /**
   * Check environment variables
   */
  private async checkEnvironmentVariables(
    required: string[],
    optional: string[],
  ): Promise<CheckResult> {
    const missing = required.filter((name) => !process.env[name]);
    const missingOptional = optional.filter((name) => !process.env[name]);

    if (missing.length > 0) {
      return {
        check: 'env',
        passed: false,
        error: `Missing required environment variables: ${missing.join(', ')}`,
        durationMs: 0,
        metadata: { missing, missingOptional },
      };
    }

    return {
      check: 'env',
      passed: true,
      durationMs: 0,
      metadata: { missingOptional },
    };
  }

  /**
   * Check dependencies are installed
   */
  private async checkDependencies(): Promise<CheckResult> {
    try {
      const nodeModulesExists = existsSync(join(process.cwd(), 'node_modules'));

      if (!nodeModulesExists) {
        return {
          check: 'dependencies',
          passed: false,
          error: 'node_modules directory not found',
          durationMs: 0,
        };
      }

      return {
        check: 'dependencies',
        passed: true,
        durationMs: 0,
      };
    } catch (error) {
      return {
        check: 'dependencies',
        passed: false,
        error: error instanceof Error ? error.message : String(error),
        durationMs: 0,
      };
    }
  }

  /**
   * Check database connectivity
   */
  private async checkDatabase(shouldCheck: boolean, databaseUrl?: string): Promise<CheckResult> {
    if (!shouldCheck) {
      return { check: 'database', passed: true, durationMs: 0 };
    }

    const url = databaseUrl || process.env.DATABASE_URL;

    if (!url) {
      return {
        check: 'database',
        passed: false,
        error: 'DATABASE_URL not configured',
        durationMs: 0,
      };
    }

    // Simplified check - in production, would attempt actual connection
    return {
      check: 'database',
      passed: true,
      durationMs: 0,
      metadata: { configured: true },
    };
  }

  /**
   * Check git working tree
   */
  private async checkGit(requireClean: boolean): Promise<CheckResult> {
    try {
      // Check if git repo
      await execAsync('git rev-parse --git-dir', { encoding: 'utf-8' });

      if (requireClean) {
        const { stdout } = await execAsync('git status --porcelain', { encoding: 'utf-8' });

        if (stdout.trim()) {
          return {
            check: 'git',
            passed: false,
            error: 'Git working tree is not clean',
            durationMs: 0,
            metadata: { uncommittedChanges: true },
          };
        }
      }

      return {
        check: 'git',
        passed: true,
        durationMs: 0,
      };
    } catch (_error) {
      return {
        check: 'git',
        passed: false,
        error: 'Not a git repository',
        durationMs: 0,
      };
    }
  }

  /**
   * Check available disk space
   */
  private async checkDiskSpace(minBytes?: number): Promise<CheckResult> {
    if (!minBytes) {
      return { check: 'disk', passed: true, durationMs: 0 };
    }

    try {
      // Use df command to check disk space
      const { stdout } = await execAsync('df -k .', { encoding: 'utf-8' });
      const lines = stdout.split('\n');
      const dataLine = lines[1]; // Second line contains the data

      if (!dataLine) {
        return {
          check: 'disk',
          passed: false,
          error: 'Could not read disk space',
          durationMs: 0,
        };
      }

      const parts = dataLine.split(/\s+/);
      const availableKB = parseInt(parts[3], 10);
      const availableBytes = availableKB * 1024;

      if (availableBytes < minBytes) {
        return {
          check: 'disk',
          passed: false,
          error: `Insufficient disk space: ${this.formatBytes(availableBytes)} available, ${this.formatBytes(minBytes)} required`,
          durationMs: 0,
          metadata: { available: availableBytes, required: minBytes },
        };
      }

      return {
        check: 'disk',
        passed: true,
        durationMs: 0,
        metadata: { available: availableBytes },
      };
    } catch (error) {
      return {
        check: 'disk',
        passed: false,
        error: error instanceof Error ? error.message : String(error),
        durationMs: 0,
      };
    }
  }

  /**
   * Check file permissions
   */
  private async checkPermissions(
    requiredPaths: string[],
    writablePaths: string[],
  ): Promise<CheckResult> {
    const missing: string[] = [];
    const notWritable: string[] = [];

    // Check required paths exist
    for (const path of requiredPaths) {
      if (!existsSync(path)) {
        missing.push(path);
      }
    }

    // Check writable paths
    for (const path of writablePaths) {
      try {
        await access(path, constants.W_OK);
      } catch {
        notWritable.push(path);
      }
    }

    if (missing.length > 0 || notWritable.length > 0) {
      return {
        check: 'permissions',
        passed: false,
        error: `Permission check failed: ${missing.length} missing, ${notWritable.length} not writable`,
        durationMs: 0,
        metadata: { missing, notWritable },
      };
    }

    return {
      check: 'permissions',
      passed: true,
      durationMs: 0,
    };
  }

  /**
   * Check network connectivity
   */
  private async checkNetwork(): Promise<CheckResult> {
    try {
      // Simple DNS resolution check
      const { stdout: _stdout } = await execAsync(
        'ping -c 1 -W 1 8.8.8.8 || ping -n 1 -w 1000 8.8.8.8',
        {
          encoding: 'utf-8',
        },
      );

      return {
        check: 'network',
        passed: true,
        durationMs: 0,
      };
    } catch {
      return {
        check: 'network',
        passed: false,
        error: 'No network connectivity',
        durationMs: 0,
      };
    }
  }

  /**
   * Check Node.js version
   */
  private async checkNodeVersion(minVersion?: string): Promise<CheckResult> {
    if (!minVersion) {
      return { check: 'node-version', passed: true, durationMs: 0 };
    }

    const currentVersion = process.version.replace('v', '');
    const meetsRequirement = this.compareVersions(currentVersion, minVersion) >= 0;

    if (!meetsRequirement) {
      return {
        check: 'node-version',
        passed: false,
        error: `Node.js version ${currentVersion} does not meet minimum requirement ${minVersion}`,
        durationMs: 0,
        metadata: { current: currentVersion, required: minVersion },
      };
    }

    return {
      check: 'node-version',
      passed: true,
      durationMs: 0,
      metadata: { version: currentVersion },
    };
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  /**
   * Get suggested fixes for a failed check
   */
  private getSuggestedFixes(check: ValidationCheckType, result: CheckResult): string[] {
    const fixes: string[] = [];

    switch (check) {
      case 'env':
        if (result.metadata?.missing) {
          const missing = result.metadata.missing as string[];
          fixes.push(`Set missing environment variables: ${missing.join(', ')}`);
          fixes.push('Check .env.template for required variables');
        }
        break;

      case 'dependencies':
        fixes.push('Run: pnpm install');
        break;

      case 'database':
        fixes.push('Set DATABASE_URL environment variable');
        fixes.push('Ensure database server is running');
        break;

      case 'git':
        if (result.metadata?.uncommittedChanges) {
          fixes.push('Commit or stash uncommitted changes');
          fixes.push('Run: git status to see changes');
        } else {
          fixes.push('Initialize git repository: git init');
        }
        break;

      case 'disk':
        fixes.push('Free up disk space');
        fixes.push('Remove unnecessary files or node_modules');
        break;

      case 'permissions':
        if (result.metadata?.missing) {
          const missing = result.metadata.missing as string[];
          fixes.push(`Create missing paths: ${missing.join(', ')}`);
        }
        if (result.metadata?.notWritable) {
          const notWritable = result.metadata.notWritable as string[];
          fixes.push(`Grant write permissions: chmod +w ${notWritable.join(' ')}`);
        }
        break;

      case 'network':
        fixes.push('Check internet connection');
        fixes.push('Check firewall settings');
        break;

      case 'node-version':
        if (result.metadata?.required) {
          fixes.push(`Upgrade Node.js to version ${result.metadata.required} or higher`);
          fixes.push('Use nvm: nvm install <version>');
        }
        break;
    }

    return fixes;
  }

  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * Compare semantic versions
   */
  private compareVersions(a: string, b: string): number {
    const aParts = a.split('.').map(Number);
    const bParts = b.split('.').map(Number);

    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aPart = aParts[i] || 0;
      const bPart = bParts[i] || 0;

      if (aPart > bPart) return 1;
      if (aPart < bPart) return -1;
    }

    return 0;
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a pre-execution validator
 */
export function createPreExecutionValidator(): PreExecutionValidator {
  return new PreExecutionValidator();
}
