/**
 * Coding Tools Safety Module
 * Path sandboxing and command denylist for secure tool execution
 */

import { relative, resolve } from 'node:path';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface SafetyConfig {
  /** Project root directory — all file operations are sandboxed here */
  projectRoot: string;
  /** Additional directories to allow (e.g., /tmp for scratch files) */
  allowedPaths?: string[];
  /** Extra commands to deny beyond the built-in denylist */
  extraDeniedCommands?: string[];
  /** Extra path patterns to deny (e.g., '.env', 'credentials') */
  deniedPathPatterns?: RegExp[];
}

const DEFAULT_SAFETY: Required<Omit<SafetyConfig, 'projectRoot'>> = {
  allowedPaths: [],
  extraDeniedCommands: [],
  deniedPathPatterns: [
    /\.env(?:\.|$)/,
    /credentials?\.\w+$/,
    /\.pem$/,
    /\.key$/,
    /id_(?:rsa|ed25519|ecdsa)/,
  ],
};

// Commands that should never be executed by the agent
const DENIED_COMMANDS = [
  // Destructive system commands
  'rm -rf /',
  'mkfs',
  'dd if=',
  'chmod -R 777',
  // Network exfiltration
  'curl.*--upload',
  'wget.*--post',
  'nc -l',
  'ncat',
  // Process/system manipulation
  'kill -9 1',
  'shutdown',
  'reboot',
  'systemctl',
  // Package-level destruction
  'npm publish',
  'pnpm publish',
  'yarn publish',
  // Git force operations
  'git push.*--force',
  'git reset --hard',
  'git clean -fd',
  // Credential access
  'cat.*\\.env',
  'cat.*id_rsa',
  'cat.*credentials',
];

// ---------------------------------------------------------------------------
// Path Validation
// ---------------------------------------------------------------------------

export function validatePath(
  filePath: string,
  config: SafetyConfig,
): { safe: boolean; reason?: string } {
  const resolvedPath = resolve(config.projectRoot, filePath);
  const rel = relative(config.projectRoot, resolvedPath);

  // Must be within project root (no ../ escapes)
  if (rel.startsWith('..') || resolve(resolvedPath) !== resolvedPath.replace(/\/$/, '')) {
    // Check allowed paths
    const allowed = config.allowedPaths ?? DEFAULT_SAFETY.allowedPaths;
    const inAllowed = allowed.some((dir) => resolvedPath.startsWith(resolve(dir)));
    if (!inAllowed) {
      return { safe: false, reason: `Path escapes project root: ${filePath}` };
    }
  }

  // Check denied path patterns
  const deniedPatterns = [
    ...DEFAULT_SAFETY.deniedPathPatterns,
    ...(config.deniedPathPatterns ?? []),
  ];
  for (const pattern of deniedPatterns) {
    if (pattern.test(filePath)) {
      return { safe: false, reason: `Path matches denied pattern: ${filePath}` };
    }
  }

  return { safe: true };
}

export function resolveSafePath(filePath: string, config: SafetyConfig): string {
  return resolve(config.projectRoot, filePath);
}

// ---------------------------------------------------------------------------
// Command Validation
// ---------------------------------------------------------------------------

export function validateCommand(
  command: string,
  config: SafetyConfig,
): { safe: boolean; reason?: string } {
  const allDenied = [
    ...DENIED_COMMANDS,
    ...(config.extraDeniedCommands ?? DEFAULT_SAFETY.extraDeniedCommands),
  ];

  for (const pattern of allDenied) {
    if (new RegExp(pattern, 'i').test(command)) {
      return { safe: false, reason: `Command matches denied pattern: ${pattern}` };
    }
  }

  return { safe: true };
}

// ---------------------------------------------------------------------------
// Shared Config Builder
// ---------------------------------------------------------------------------

let _activeConfig: SafetyConfig | undefined;

export function configureSafety(config: SafetyConfig): void {
  _activeConfig = config;
}

export function getSafetyConfig(): SafetyConfig {
  if (!_activeConfig) {
    throw new Error('Safety not configured. Call configureSafety() before using coding tools.');
  }
  return _activeConfig;
}
