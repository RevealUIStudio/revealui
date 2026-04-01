import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock fs/promises
vi.mock('node:fs/promises', () => ({
  copyFile: vi.fn(),
  mkdir: vi.fn(),
  readdir: vi.fn(),
  stat: vi.fn(),
}));

// Mock os
vi.mock('node:os', () => ({
  homedir: vi.fn(() => '/home/testuser'),
  platform: vi.fn(() => 'linux'),
}));

// Mock logger
vi.mock('@revealui/setup/utils', () => ({
  createLogger: () => ({
    header: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { copyFile, mkdir, readdir, stat } from 'node:fs/promises';
import { platform } from 'node:os';
import { runTerminalInstallCommand, runTerminalListCommand } from './terminal.js';

const mockStat = vi.mocked(stat);
const mockReaddir = vi.mocked(readdir);
const mockCopyFile = vi.mocked(copyFile);
const mockMkdir = vi.mocked(mkdir);
const mockPlatform = vi.mocked(platform);

beforeEach(() => {
  vi.resetAllMocks();
  process.exitCode = undefined;
  mockPlatform.mockReturnValue('linux');
});

describe('Terminal Profile Installer', () => {
  describe('runTerminalInstallCommand', () => {
    it('rejects unsupported platforms', async () => {
      mockPlatform.mockReturnValue('win32');
      await runTerminalInstallCommand({});
      expect(process.exitCode).toBe(1);
    });

    it('lists profiles in list mode', async () => {
      const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
      mockStat.mockRejectedValue(new Error('ENOENT'));

      await runTerminalListCommand({ json: true });

      expect(stdout).toHaveBeenCalled();
      const output = JSON.parse(stdout.mock.calls[0][0] as string);
      expect(output.platform).toBe('linux');
      expect(output.profiles).toBeDefined();
      expect(output.profiles.length).toBeGreaterThan(0);
      stdout.mockRestore();
    });

    it('lists macOS profiles when platform is darwin', async () => {
      mockPlatform.mockReturnValue('darwin');
      const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
      mockStat.mockRejectedValue(new Error('ENOENT'));

      await runTerminalListCommand({ json: true });

      const output = JSON.parse(stdout.mock.calls[0][0] as string);
      expect(output.platform).toBe('darwin');
      // macOS should have iTerm2, Terminal.app, Alacritty, Kitty
      const names = output.profiles.map((p: { name: string }) => p.name);
      expect(names).toContain('iTerm2');
      expect(names).toContain('Terminal.app');
      stdout.mockRestore();
    });

    it('errors when config directory not found', async () => {
      mockStat.mockRejectedValue(new Error('ENOENT'));
      await runTerminalInstallCommand({});
      expect(process.exitCode).toBe(1);
    });

    it('errors with unknown terminal name', async () => {
      // Make config dir exist
      mockStat.mockImplementation(async (p) => {
        if (String(p).includes('config/terminal')) {
          return { isDirectory: () => true, isFile: () => false } as Awaited<
            ReturnType<typeof stat>
          >;
        }
        throw new Error('ENOENT');
      });
      mockReaddir.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof readdir>>);

      await runTerminalInstallCommand({ terminal: 'NonexistentTerminal' });
      expect(process.exitCode).toBe(1);
    });

    it('installs profile when terminal is detected', async () => {
      // Make config dir and kitty config dir exist, file does not
      mockStat.mockImplementation(async (p) => {
        const path = String(p);
        if (path.includes('config/terminal') || path.includes('.config/kitty')) {
          return { isDirectory: () => true, isFile: () => false } as Awaited<
            ReturnType<typeof stat>
          >;
        }
        throw new Error('ENOENT');
      });
      mockReaddir.mockResolvedValue([
        'alacritty-revealui.toml',
        'kitty-revealui.conf',
        'gnome-terminal-revealui.dconf',
      ] as unknown as Awaited<ReturnType<typeof readdir>>);
      mockMkdir.mockResolvedValue(undefined);
      mockCopyFile.mockResolvedValue(undefined);

      await runTerminalInstallCommand({ terminal: 'Kitty' });

      expect(mockCopyFile).toHaveBeenCalled();
      expect(process.exitCode).toBeUndefined();
    });

    it('skips existing files without --force', async () => {
      // Config dir exists, kitty dir exists, dest file already exists
      mockStat.mockImplementation(async (p) => {
        const path = String(p);
        // Dest file check must come first (path also includes .config/kitty)
        if (path.endsWith('revealui.conf')) {
          return { isDirectory: () => false, isFile: () => true } as Awaited<
            ReturnType<typeof stat>
          >;
        }
        if (path.includes('config/terminal') || path.includes('.config/kitty')) {
          return { isDirectory: () => true, isFile: () => false } as Awaited<
            ReturnType<typeof stat>
          >;
        }
        throw new Error('ENOENT');
      });
      mockReaddir.mockResolvedValue(['kitty-revealui.conf'] as unknown as Awaited<
        ReturnType<typeof readdir>
      >);

      await runTerminalInstallCommand({ terminal: 'Kitty' });

      expect(mockCopyFile).not.toHaveBeenCalled();
    });

    it('overwrites existing files with --force', async () => {
      mockStat.mockImplementation(async (p) => {
        const path = String(p);
        if (path.includes('config/terminal') || path.includes('.config/kitty')) {
          return { isDirectory: () => true, isFile: () => false } as Awaited<
            ReturnType<typeof stat>
          >;
        }
        if (path.includes('revealui.conf')) {
          return { isDirectory: () => false, isFile: () => true } as Awaited<
            ReturnType<typeof stat>
          >;
        }
        throw new Error('ENOENT');
      });
      mockReaddir.mockResolvedValue(['kitty-revealui.conf'] as unknown as Awaited<
        ReturnType<typeof readdir>
      >);
      mockMkdir.mockResolvedValue(undefined);
      mockCopyFile.mockResolvedValue(undefined);

      await runTerminalInstallCommand({ terminal: 'Kitty', force: true });

      expect(mockCopyFile).toHaveBeenCalled();
    });
  });
});
