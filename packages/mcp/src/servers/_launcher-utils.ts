/**
 * MCP Launcher Utilities
 *
 * Self-contained logger and exit codes for MCP server launcher scripts.
 * Replaces the @revealui/scripts dependency so the MCP package has no
 * cross-package imports beyond its own declared dependencies.
 */

// =============================================================================
// Exit Codes
// =============================================================================

export const ExitCode = {
  SUCCESS: 0,
  GENERAL_ERROR: 1,
  CONFIG_ERROR: 2,
  EXECUTION_ERROR: 3,
} as const;

export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode];

// =============================================================================
// Logger
// =============================================================================

interface LauncherLogger {
  info(msg: string): void;
  error(msg: string): void;
  warning(msg: string): void;
  success(msg: string): void;
  header(msg: string): void;
}

/**
 * Create a lightweight launcher logger that writes to stderr
 * (so it doesn't interfere with MCP JSON-RPC on stdout).
 */
export function createLauncherLogger(): LauncherLogger {
  return {
    info(msg: string) {
      // biome-ignore lint/suspicious/noConsole: MCP launcher logger intentionally writes to stderr
      console.error(`\x1b[36m[mcp]\x1b[0m ${msg}`); // console-allowed
    },
    error(msg: string) {
      // biome-ignore lint/suspicious/noConsole: MCP launcher logger intentionally writes to stderr
      console.error(`\x1b[31m[mcp] ERROR:\x1b[0m ${msg}`); // console-allowed
    },
    warning(msg: string) {
      // biome-ignore lint/suspicious/noConsole: MCP launcher logger intentionally writes to stderr
      console.error(`\x1b[33m[mcp] WARN:\x1b[0m ${msg}`); // console-allowed
    },
    success(msg: string) {
      // biome-ignore lint/suspicious/noConsole: MCP launcher logger intentionally writes to stderr
      console.error(`\x1b[32m[mcp]\x1b[0m ${msg}`); // console-allowed
    },
    header(msg: string) {
      // biome-ignore lint/suspicious/noConsole: MCP launcher logger intentionally writes to stderr
      console.error(`\n\x1b[1m\x1b[36m${msg}\x1b[0m\n`); // console-allowed
    },
  };
}
