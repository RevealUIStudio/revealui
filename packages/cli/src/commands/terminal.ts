/**
 * Terminal Profile Installer (Phase 5.6.1)
 *
 * Auto-detects the platform and installed terminal emulators,
 * then installs the appropriate RevealUI terminal profile.
 *
 * Supported terminals:
 * - macOS: iTerm2, Terminal.app, Alacritty, Kitty
 * - Linux: Alacritty, Kitty, GNOME Terminal
 *
 * Config files live in config/terminal/ at the repo root.
 */

import { copyFile, mkdir, readdir, stat } from 'node:fs/promises';
import { homedir, platform } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createLogger } from '@revealui/setup/utils';

const logger = createLogger({ prefix: 'Terminal' });

interface TerminalProfile {
  name: string;
  /** Source filename in config/terminal/ */
  sourceFile: string;
  /** Destination path (~ expanded) */
  destPath: string;
  /** Human-readable install instructions */
  postInstall: string;
  /** Check if the terminal is installed */
  detect: () => Promise<boolean>;
}

/** Check if a directory exists */
async function dirExists(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isDirectory();
  } catch {
    return false;
  }
}

/** Check if a file exists */
async function fileExists(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isFile();
  } catch {
    return false;
  }
}

function getMacProfiles(home: string): TerminalProfile[] {
  return [
    {
      name: 'iTerm2',
      sourceFile: 'iterm2-revealui.json',
      destPath: join(
        home,
        'Library',
        'Application Support',
        'iTerm2',
        'DynamicProfiles',
        'revealui.json',
      ),
      postInstall:
        'Profile loaded automatically. Select "RevealUI" in iTerm2 > Settings > Profiles.',
      detect: async () => dirExists(join(home, 'Library', 'Application Support', 'iTerm2')),
    },
    {
      name: 'Terminal.app',
      sourceFile: 'Terminal.app-RevealUI.terminal',
      destPath: join(home, 'Desktop', 'RevealUI.terminal'),
      postInstall:
        'Double-click ~/Desktop/RevealUI.terminal to import, then set as default in Terminal > Settings > Profiles.',
      detect: async () =>
        fileExists('/System/Applications/Utilities/Terminal.app/Contents/MacOS/Terminal'),
    },
    {
      name: 'Alacritty',
      sourceFile: 'alacritty-revealui.toml',
      destPath: join(home, '.config', 'alacritty', 'revealui.toml'),
      postInstall:
        'Add `import = ["~/.config/alacritty/revealui.toml"]` to your alacritty.toml [general] section.',
      detect: async () => dirExists(join(home, '.config', 'alacritty')),
    },
    {
      name: 'Kitty',
      sourceFile: 'kitty-revealui.conf',
      destPath: join(home, '.config', 'kitty', 'revealui.conf'),
      postInstall: 'Add `include revealui.conf` to your ~/.config/kitty/kitty.conf.',
      detect: async () => dirExists(join(home, '.config', 'kitty')),
    },
  ];
}

function getLinuxProfiles(home: string): TerminalProfile[] {
  return [
    {
      name: 'Alacritty',
      sourceFile: 'alacritty-revealui.toml',
      destPath: join(home, '.config', 'alacritty', 'revealui.toml'),
      postInstall:
        'Add `import = ["~/.config/alacritty/revealui.toml"]` to your alacritty.toml [general] section.',
      detect: async () => dirExists(join(home, '.config', 'alacritty')),
    },
    {
      name: 'Kitty',
      sourceFile: 'kitty-revealui.conf',
      destPath: join(home, '.config', 'kitty', 'revealui.conf'),
      postInstall: 'Add `include revealui.conf` to your ~/.config/kitty/kitty.conf.',
      detect: async () => dirExists(join(home, '.config', 'kitty')),
    },
    {
      name: 'GNOME Terminal',
      sourceFile: 'gnome-terminal-revealui.dconf',
      destPath: join(home, '.config', 'revealui', 'gnome-terminal-revealui.dconf'),
      postInstall:
        'Import with: dconf load /org/gnome/terminal/legacy/profiles:/ < ~/.config/revealui/gnome-terminal-revealui.dconf',
      detect: async () => {
        // Check for GNOME Terminal config directory or gsettings
        const gnomeConfigDir = join(home, '.config', 'dconf');
        return dirExists(gnomeConfigDir);
      },
    },
  ];
}

export interface TerminalInstallOptions {
  /** Only install for a specific terminal */
  terminal?: string;
  /** List available profiles without installing */
  list?: boolean;
  /** Force overwrite existing files */
  force?: boolean;
  /** Output JSON */
  json?: boolean;
}

/**
 * Find the config/terminal/ directory relative to the CLI package.
 * Works both in dev (monorepo) and installed (npx) contexts.
 */
async function findConfigDir(): Promise<string | null> {
  // In the monorepo, config/terminal/ is at the repo root
  // The CLI package is at packages/cli/
  const monorepoPath = resolve(
    dirname(new URL(import.meta.url).pathname),
    '..',
    '..',
    '..',
    '..',
    'config',
    'terminal',
  );
  if (await dirExists(monorepoPath)) return monorepoPath;

  // When installed via npm, config files are bundled alongside
  const npmPath = resolve(dirname(new URL(import.meta.url).pathname), '..', 'config', 'terminal');
  if (await dirExists(npmPath)) return npmPath;

  return null;
}

export async function runTerminalInstallCommand(options: TerminalInstallOptions): Promise<void> {
  const os = platform();
  const home = homedir();

  if (os !== 'darwin' && os !== 'linux') {
    logger.error(
      `Unsupported platform: ${os}. Terminal profiles are available for macOS and Linux.`,
    );
    if (os === 'win32') {
      logger.info('For Windows Terminal, copy config/terminal/ profiles manually.');
    }
    process.exitCode = 1;
    return;
  }

  const profiles = os === 'darwin' ? getMacProfiles(home) : getLinuxProfiles(home);

  // List mode
  if (options.list) {
    if (options.json) {
      const detected = await Promise.all(
        profiles.map(async (p) => ({
          name: p.name,
          sourceFile: p.sourceFile,
          destPath: p.destPath,
          detected: await p.detect(),
        })),
      );
      process.stdout.write(`${JSON.stringify({ platform: os, profiles: detected }, null, 2)}\n`);
      return;
    }

    logger.header('Available Terminal Profiles');
    logger.info(`Platform: ${os === 'darwin' ? 'macOS' : 'Linux'}`);

    for (const profile of profiles) {
      const detected = await profile.detect();
      const icon = detected ? '[detected]' : '[not found]';
      logger.info(`  ${profile.name} ${icon} — ${profile.sourceFile}`);
    }
    return;
  }

  // Find config directory
  const configDir = await findConfigDir();
  if (!configDir) {
    logger.error('Could not find config/terminal/ directory.');
    logger.info(
      'Run this command from the RevealUI monorepo root, or install via npx create-revealui.',
    );
    process.exitCode = 1;
    return;
  }

  // Verify source files exist
  const sourceFiles = await readdir(configDir);

  // Filter to specific terminal if requested
  let targetProfiles = profiles;
  if (options.terminal) {
    const match = profiles.find((p) => p.name.toLowerCase() === options.terminal?.toLowerCase());
    if (!match) {
      logger.error(`Unknown terminal: ${options.terminal}`);
      logger.info(`Available: ${profiles.map((p) => p.name).join(', ')}`);
      process.exitCode = 1;
      return;
    }
    targetProfiles = [match];
  }

  // Detect and install
  let installed = 0;
  let skipped = 0;

  logger.header('RevealUI Terminal Profile Installer');
  logger.info(`Platform: ${os === 'darwin' ? 'macOS' : 'Linux'}`);

  for (const profile of targetProfiles) {
    const detected = await profile.detect();
    if (!(detected || options.terminal)) {
      // Skip undetected terminals unless explicitly requested
      continue;
    }

    if (!detected && options.terminal) {
      logger.warn(`${profile.name} not detected, installing anyway (--terminal flag).`);
    }

    // Check source file exists
    if (!sourceFiles.includes(profile.sourceFile)) {
      logger.warn(`Source file missing: ${profile.sourceFile} — skipping ${profile.name}`);
      skipped++;
      continue;
    }

    const sourcePath = join(configDir, profile.sourceFile);
    const destPath = profile.destPath;

    // Check if destination exists
    if (await fileExists(destPath)) {
      if (!options.force) {
        logger.warn(`${profile.name}: ${destPath} already exists. Use --force to overwrite.`);
        skipped++;
        continue;
      }
    }

    // Create destination directory
    await mkdir(dirname(destPath), { recursive: true });

    // Copy file
    await copyFile(sourcePath, destPath);
    installed++;

    logger.success(`${profile.name}: installed to ${destPath}`);
    logger.info(`  ${profile.postInstall}`);
  }

  if (installed === 0 && skipped === 0) {
    logger.info('No supported terminal emulators detected.');
    logger.info(`Supported: ${profiles.map((p) => p.name).join(', ')}`);
    logger.info('Use --terminal <name> to install for a specific terminal.');
  } else if (installed > 0) {
    logger.success(
      `Installed ${installed} profile(s). ${skipped > 0 ? `Skipped ${skipped}.` : ''}`,
    );
  }

  if (options.json) {
    process.stdout.write(`${JSON.stringify({ installed, skipped, platform: os }, null, 2)}\n`);
  }
}

export async function runTerminalListCommand(options: { json?: boolean }): Promise<void> {
  await runTerminalInstallCommand({ list: true, json: options.json });
}
