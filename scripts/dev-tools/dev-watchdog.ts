/**
 * dev-watchdog: Monitors file activity and kills idle dev watchers.
 *
 * Runs alongside `pnpm dev` or `pnpm dev:focus`. When no source files have
 * been modified for the configured idle timeout, it sends SIGTERM to the
 * turbo/pnpm dev process group.
 *
 * Usage:
 *   pnpm dev:watched cms              # dev:focus cms + auto-kill after 30m idle
 *   WATCHDOG_TIMEOUT=15 pnpm dev:watched api   # 15 minute timeout
 *
 * Environment:
 *   WATCHDOG_TIMEOUT   -  idle timeout in minutes (default: 30)
 *   WATCHDOG_DIRS      -  comma-separated dirs to watch (default: src)
 */

import { type ChildProcess, spawn } from 'node:child_process';
import { readdirSync, statSync, watch } from 'node:fs';
import { join, resolve } from 'node:path';

interface WatchdogConfig {
  timeoutMinutes: number;
  watchDirs: string[];
}

const DEFAULT_CONFIG: WatchdogConfig = {
  timeoutMinutes: 30,
  watchDirs: ['src'],
};

const config: WatchdogConfig = {
  timeoutMinutes: Number(process.env.WATCHDOG_TIMEOUT) || DEFAULT_CONFIG.timeoutMinutes,
  watchDirs: process.env.WATCHDOG_DIRS?.split(',').map((d) => d.trim()) ?? DEFAULT_CONFIG.watchDirs,
};

const targets = process.argv.slice(2);
if (targets.length === 0) {
  console.error('Usage: pnpm dev:watched <package|app> [...more]');
  process.exit(1);
}

const root = resolve(new URL('../../', import.meta.url).pathname);
const timeoutMs = config.timeoutMinutes * 60 * 1000;

let lastActivity = Date.now();
let devProcess: ChildProcess | null = null;

function resetTimer(): void {
  lastActivity = Date.now();
}

// Collect directories to watch (packages/*/src, apps/*/src)
function getWatchPaths(): string[] {
  const paths: string[] = [];
  for (const dir of ['packages', 'apps']) {
    const base = join(root, dir);
    try {
      for (const entry of readdirSync(base)) {
        for (const watchDir of config.watchDirs) {
          const candidate = join(base, entry, watchDir);
          try {
            if (statSync(candidate).isDirectory()) {
              paths.push(candidate);
            }
          } catch {
            // dir doesn't exist for this package
          }
        }
      }
    } catch {
      // packages/ or apps/ doesn't exist
    }
  }
  return paths;
}

// Set up recursive file watchers
const watchers: ReturnType<typeof watch>[] = [];
function startWatching(): void {
  const paths = getWatchPaths();
  for (const dir of paths) {
    try {
      const w = watch(dir, { recursive: true }, (_event, filename) => {
        if (filename && /\.(ts|tsx|js|jsx|css|json)$/.test(filename)) {
          resetTimer();
        }
      });
      watchers.push(w);
    } catch {
      // Some dirs may not support recursive watch
    }
  }
  console.log(`Watchdog: monitoring ${paths.length} directories for activity`);
}

// Idle check interval
function startIdleChecker(): NodeJS.Timeout {
  return setInterval(() => {
    const idleMs = Date.now() - lastActivity;
    const idleMinutes = Math.floor(idleMs / 60_000);

    if (idleMs >= timeoutMs) {
      console.log(
        `\nWatchdog: No file activity for ${idleMinutes}m — killing dev servers to free memory.`,
      );
      shutdown(0);
    } else if (idleMs >= timeoutMs * 0.8) {
      const remaining = Math.ceil((timeoutMs - idleMs) / 60_000);
      console.log(
        `Watchdog: idle for ${idleMinutes}m — will kill in ~${remaining}m if no activity`,
      );
    }
  }, 60_000);
}

function shutdown(code: number): void {
  for (const w of watchers) w.close();
  if (devProcess?.pid) {
    // Kill the entire process group
    try {
      process.kill(-devProcess.pid, 'SIGTERM');
    } catch {
      devProcess.kill('SIGTERM');
    }
  }
  process.exit(code);
}

// Start the dev process
const args = ['tsx', 'scripts/dev-tools/dev-focus.ts', ...targets];
devProcess = spawn('pnpm', args, {
  stdio: 'inherit',
  cwd: root,
  detached: true, // Create process group so we can kill all children
});

devProcess.on('exit', (code) => {
  for (const w of watchers) w.close();
  process.exit(code ?? 0);
});

// Handle signals
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => shutdown(0));
}

startWatching();
const checker = startIdleChecker();

console.log(`Watchdog: dev servers will auto-stop after ${config.timeoutMinutes}m of inactivity\n`);

// Prevent the checker from keeping the process alive after dev exits
devProcess.on('exit', () => clearInterval(checker));
